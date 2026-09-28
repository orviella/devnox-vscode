import {
  admin,
  env,
  json,
  configured,
  secureEqual,
} from "../_shared/server.ts";
import { telegramPayload, telegramFailure } from "../_shared/providers.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST")
    return json({ error: "Método não permitido" }, 405);
  if (
    env("WORKER_SECRET").length < 32 ||
    !(await secureEqual(
      req.headers.get("x-worker-secret") || "",
      env("WORKER_SECRET"),
    ))
  )
    return json({ error: "Não autorizado" }, 401);
  const owner = env("INTEGRATION_OWNER_ID");
  if (!owner) return json({ error: "Configure INTEGRATION_OWNER_ID" }, 503);
  const db = admin();
  const started = Date.now();
  let processed = 0;
  // Uma execução curta. Cron repete a cada minuto; não depende de navegador aberto.
  while (Date.now() - started < 40000 && processed < 8) {
    const { data: job, error } = await db.rpc("claim_delivery", {
      owner_id: owner,
    });
    if (error) return json({ error: "Falha ao obter fila" }, 500);
    if (!job) break;
    const { delivery: d, campaign: c } = job;
    let requestStarted = false;
    try {
      if (c.user_id !== owner || d.user_id !== owner || !configured(c.channel))
        throw new Error("Canal não configurado para esta conta.");
      const { data: contact, error: contactError } = await db
        .from("contacts")
        .select("consent,telegram_chat_id")
        .eq("id", d.contact_id)
        .eq("user_id", owner)
        .maybeSingle();
      if (contactError)
        throw new Error("Não foi possível verificar o contato.");
      if (!contact?.consent || contact.telegram_chat_id !== d.destination)
        throw new Error("Autorização revogada ou destino alterado.");
      let url: string, body: unknown;
      {
        let mediaURL: string | undefined;
        if (c.media_path) {
          if (!c.media_path.startsWith(owner + "/"))
            throw new Error("Anexo inválido.");
          const { data, error } = await db.storage
            .from("campaign-assets")
            .createSignedUrl(c.media_path, 300);
          if (error) throw new Error("Anexo indisponível.");
          mediaURL = data.signedUrl;
        }
        const payload = telegramPayload(c, d, mediaURL);
        url = `https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/${payload.method}`;
        body = payload.body;
      }
      requestStarted = true;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.ok === false || result.error) {
        // Não guardar resposta inteira: pode incluir telefone ou conteúdo sensível.
        const code = result.error?.code || result.error_code || response.status;
        const { error } = await db
          .from("deliveries")
          .update({
            status: response.status >= 500 ? "unknown" : "failed",
            error: telegramFailure(Number(code)),
            updated_at: new Date().toISOString(),
          })
          .eq("id", d.id)
          .eq("status", "sending");
        if (error) return json({ error: "Falha ao registrar resultado" }, 500);
      } else {
        const id = result.result?.message_id;
        if (!id) throw new Error("API não retornou confirmação.");
        const { error } = await db
          .from("deliveries")
          .update({
            status: "accepted",
            provider_id: String(id),
            updated_at: new Date().toISOString(),
          })
          .eq("id", d.id)
          .eq("status", "sending");
        if (error)
          return json(
            {
              error:
                "Falha ao registrar confirmação; revisar antes de reenviar",
            },
            500,
          );
      }
    } catch (err) {
      const message = requestStarted
        ? "Resposta incerta da API. Verifique no canal antes de reenviar."
        : err instanceof Error
          ? err.message
          : "Falha na validação.";
      const { error } = await db
        .from("deliveries")
        .update({
          status: requestStarted ? "unknown" : "failed",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", d.id)
        .eq("status", "sending");
      if (error) return json({ error: "Falha ao registrar erro" }, 500);
    }
    processed++;
    if (c.interval_seconds > 10) break;
    if (Date.now() - started + c.interval_seconds * 1000 >= 40000) break;
    await new Promise((resolve) =>
      setTimeout(resolve, c.interval_seconds * 1000),
    );
  }
  return json({ processed });
});
