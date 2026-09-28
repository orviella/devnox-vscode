import { admin, env, headers, json, configured } from "../_shared/server.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return json({ error: "Método não permitido" }, 405);
  const db = admin();
  const token = (req.headers.get("Authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return json({ error: "Login obrigatório" }, 401);
  const { data: account, error: accountError } = await db
    .from("dispatch_account")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (accountError)
    return json({
      telegram: false,
      reason:
        "Não foi possível consultar dispatch_account. Confira a instalação SQL do banco.",
    });
  const authorized = data.user.id === env("INTEGRATION_OWNER_ID") && !!account;
  if (!authorized)
    return json({
      telegram: false,
      reason:
        "Autorize seu UUID em dispatch_account e configure INTEGRATION_OWNER_ID nas secrets.",
    });
  if (!configured("telegram"))
    return json({
      telegram: false,
      reason: "Configure TELEGRAM_BOT_TOKEN nas secrets do Supabase.",
    });
  if (env("WORKER_SECRET").length < 32)
    return json({
      telegram: false,
      reason:
        "Configure WORKER_SECRET com pelo menos 32 caracteres e o mesmo valor no Vault para ativar a fila.",
    });
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/getMe`,
      { signal: AbortSignal.timeout(8000) },
    );
    const bot = await response.json();
    if (!response.ok || !bot.ok)
      return json({
        telegram: false,
        reason: "O Telegram não validou o token. Confira o token do BotFather.",
      });
    return json({ telegram: true, username: bot.result.username });
  } catch {
    return json({
      telegram: false,
      reason: "Não foi possível consultar o Telegram agora. Tente novamente.",
    });
  }
});
