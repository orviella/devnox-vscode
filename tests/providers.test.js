import test from "node:test";
import assert from "node:assert/strict";
import {
  telegramPayload,
  telegramFailure,
} from "../supabase/functions/_shared/providers.ts";
const d = {
  destination: "12345",
  recipient_name: "Ana",
  recipient_company: "Flora",
  recipient_link: "https://example.com",
};
test("anexo indisponível não vira envio de texto silencioso", () => {
  assert.throws(
    () => telegramPayload({ body: "Oi", media_path: "x" }, d),
    /Anexo indisponível/,
  );
});
test("erros Telegram orientam a correção sem expor resposta bruta", () => {
  assert.match(telegramFailure(400), /chat ID/);
  assert.match(telegramFailure(401), /TELEGRAM_BOT_TOKEN/);
  assert.match(telegramFailure(403), /bloqueado/);
  assert.match(telegramFailure(429), /intervalo/);
  assert.match(telegramFailure(502), /Verifique no Telegram/);
});
test("Telegram gera texto personalizado sem parse_mode", () => {
  const p = telegramPayload({ body: "Oi, {{nome}}!" }, d);
  assert.equal(p.method, "sendMessage");
  assert.equal(p.body.text, "Oi, Ana!");
  assert.equal(p.body.parse_mode, undefined);
});
test("Telegram escolhe método e campo de mídia corretos", () => {
  for (const [type, method, field] of [
    ["image/png", "sendPhoto", "photo"],
    ["video/mp4", "sendVideo", "video"],
    ["application/pdf", "sendDocument", "document"],
  ]) {
    const p = telegramPayload(
      { body: "Oi", media_path: "x", media_type: type },
      d,
      "https://example.com/a",
    );
    assert.equal(p.method, method);
    assert.equal(p.body[field], "https://example.com/a");
    assert.equal(p.body.caption, "Oi");
  }
});
test("Telegram valida limite já personalizado", () =>
  assert.throws(
    () =>
      telegramPayload(
        { body: "{{nome}}".repeat(500), media_path: "x" },
        d,
        "https://example.com/a",
      ),
    /1024/,
  ));

test("cada destino recebe seu nome; a seleção de prévia não muda o envio", () => {
  const campaign = { body: "Olá, {nome}! Sua empresa é {{empresa}}." };
  const people = [
    {
      ...d,
      destination: "1",
      recipient_name: "Ana",
      recipient_company: "Flora",
    },
    {
      ...d,
      destination: "2",
      recipient_name: "Bruno",
      recipient_company: "Aurora",
    },
    {
      ...d,
      destination: "3",
      recipient_name: "Carla",
      recipient_company: "Ateliê",
    },
  ];
  const payloads = people.map((p) => telegramPayload(campaign, p).body);
  assert.deepEqual(
    payloads.map((p) => p.chat_id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    payloads.map((p) => p.text),
    [
      "Olá, Ana! Sua empresa é Flora.",
      "Olá, Bruno! Sua empresa é Aurora.",
      "Olá, Carla! Sua empresa é Ateliê.",
    ],
  );
  assert.equal(campaign.body, "Olá, {nome}! Sua empresa é {{empresa}}.");
});
