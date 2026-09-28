import { personalizeTemplate } from "./personalization.js";
// Mensagens locais: nunca persistir respostas brutas que possam conter dados privados.
export function telegramFailure(code: number) {
  const reasons: Record<number, string> = {
    400: "Destino ou conteúdo inválido. Confira o chat ID, se a pessoa enviou /start ao seu bot e o formato do anexo.",
    401: "Token do bot inválido. Atualize TELEGRAM_BOT_TOKEN nas secrets do Supabase.",
    403: "Bot sem acesso ao chat. A pessoa pode ter bloqueado o bot ou ele foi removido do grupo.",
    429: "Limite de envio do Telegram atingido. Aguarde e aumente o intervalo antes de tentar novamente.",
  };
  return (
    reasons[code] ||
    `API não confirmou o envio (código ${code}). Verifique no Telegram antes de reenviar.`
  );
}
export function personalize(text: string, d: Record<string, string>) {
  return personalizeTemplate(text, {
    nome: d.recipient_name,
    empresa: d.recipient_company,
    link: d.recipient_link,
  });
}
export function telegramPayload(c: any, d: any, mediaURL?: string) {
  const text = personalize(c.body, d);
  const limit = c.media_path ? 1024 : 4096;
  if (!text.trim() || text.length > limit)
    throw new Error(
      `Mensagem personalizada fora do limite de ${limit} caracteres.`,
    );
  if (c.media_path && !mediaURL)
    throw new Error(
      "Anexo indisponível. O envio foi interrompido para não enviar apenas o texto.",
    );
  if (!c.media_path && mediaURL)
    throw new Error("Anexo sem caminho de armazenamento.");
  if (!mediaURL)
    return { method: "sendMessage", body: { chat_id: d.destination, text } };
  const [method, field] =
    c.media_type === "video/mp4"
      ? ["sendVideo", "video"]
      : c.media_type === "application/pdf"
        ? ["sendDocument", "document"]
        : ["sendPhoto", "photo"];
  return {
    method,
    body: { chat_id: d.destination, [field]: mediaURL, caption: text },
  };
}
