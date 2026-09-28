import { personalizeTemplate } from "../supabase/functions/_shared/personalization.js";
export function validateContact(contact) {
  const value = Object.fromEntries(["name", "company", "phone", "telegram_chat_id", "link"].map((key) => [key, String(contact[key] || "").trim()]));
  if (!value.name || value.name.length > 100) throw new Error("Informe um nome entre 1 e 100 caracteres.");
  if (value.phone && !/^\+[1-9][0-9]{7,14}$/.test(value.phone)) throw new Error("Informe o telefone com DDI, por exemplo +5511999999999.");
  if (value.telegram_chat_id && !/^-?\d+$/.test(value.telegram_chat_id)) throw new Error("O chat ID do Telegram deve ser numérico.");
  if (value.link) {
    let parsed;
    try { parsed = new URL(value.link); } catch { throw new Error("Informe um link válido com http:// ou https://."); }
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Use um link http:// ou https://.");
  }
  return { ...value, consent: !!contact.consent };
}
export function personalize(text, contact = {}) {
  return personalizeTemplate(text, {
    nome: contact.name || "seu contato",
    empresa: contact.company || "",
    link: contact.link || "",
  });
}
export function recipientPreview(contacts, selectedIds, activeId) {
  const recipients = contacts.filter((c) => selectedIds.has(c.id));
  const contact = recipients.find((c) => c.id === activeId) || recipients[0];
  return { recipients, contact };
}
export function eligible(contact, channel = "telegram") {
  return (
    !!contact.consent &&
    channel === "telegram" &&
    /^-?\d+$/.test(contact.telegram_chat_id || "")
  );
}
export function validateCampaign(c, contacts) {
  if (!c.name?.trim()) throw new Error("Dê um nome à campanha.");
  if (c.channel !== "telegram")
    throw new Error("Esta versão envia somente pelo Telegram.");
  if (!contacts.length) throw new Error("Selecione pelo menos um contato.");
  if (contacts.length > 500)
    throw new Error("Selecione no máximo 500 contatos por campanha.");
  if (contacts.some((x) => !eligible(x, c.channel)))
    throw new Error(
      "Os contatos precisam de autorização e um destino válido para este canal.",
    );
  if (
    !Number.isInteger(c.interval_seconds) ||
    c.interval_seconds < 5 ||
    c.interval_seconds > 3600
  )
    throw new Error("Use um intervalo inteiro entre 5 e 3600 segundos.");
  if (
    c.scheduled_at &&
    (!Number.isFinite(Date.parse(c.scheduled_at)) ||
      Date.parse(c.scheduled_at) <= Date.now())
  )
    throw new Error("Escolha um agendamento no futuro.");
  if (c.channel === "telegram") {
    if (!c.body?.trim()) throw new Error("Escreva a mensagem.");
    const limit = c.media_path ? 1024 : 4096;
    if (contacts.some((x) => !personalize(c.body, x).trim()))
      throw new Error(
        "A mensagem fica vazia para um dos contatos após personalização.",
      );
    if (contacts.some((x) => personalize(c.body, x).length > limit))
      throw new Error(
        `A mensagem personalizada deve ter até ${limit} caracteres.`,
      );
  }
}
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
