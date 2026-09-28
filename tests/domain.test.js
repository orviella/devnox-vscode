import test from "node:test";
import assert from "node:assert/strict";
import {
  personalize,
  recipientPreview,
  eligible,
  validateCampaign,
  escapeHTML,
} from "../src/domain.js";
const contact = {
  name: "Ana",
  company: "Flora",
  link: "https://example.com",
  phone: "+5511999999999",
  telegram_chat_id: "1234",
  consent: true,
};
const c = {
  name: "Novidades",
  channel: "telegram",
  body: "Olá, {{nome}}",
  interval_seconds: 5,
};
test("mensagem vazia após personalização é recusada antes da fila", () => {
  assert.throws(
    () =>
      validateCampaign({ ...c, body: "{empresa}" }, [
        { ...contact, company: "" },
      ]),
    /fica vazia/,
  );
});
test("limite de destinatários é validado antes de salvar", () => {
  assert.throws(() => validateCampaign(c, Array(501).fill(contact)), /500/);
});
test("personalização substitui todas as ocorrências sem interpretar outros marcadores", () =>
  assert.equal(
    personalize("{{nome}} / {{nome}} / {{empresa}} / {{outro}}", contact),
    "Ana / Ana / Flora / {{outro}}",
  ));
test("autorização e endereço válido são necessários", () => {
  assert.equal(eligible(contact, "telegram"), true);
  assert.equal(eligible({ ...contact, consent: false }, "telegram"), false);
  assert.equal(
    eligible({ ...contact, phone: "1199999999" }, "whatsapp"),
    false,
  );
  assert.equal(
    eligible({ ...contact, telegram_chat_id: "@ana" }, "telegram"),
    false,
  );
});
test("campanha exige destinatário e autorização", () => {
  assert.throws(() => validateCampaign(c, []));
  assert.throws(() => validateCampaign(c, [{ ...contact, consent: false }]));
  assert.doesNotThrow(() => validateCampaign(c, [contact]));
});
test("limite é aplicado após personalização e a legenda de mídia", () => {
  assert.throws(() =>
    validateCampaign({ ...c, body: "{{nome}}".repeat(1500) }, [contact]),
  );
  assert.throws(() =>
    validateCampaign({ ...c, body: "a".repeat(1025), media_path: "x" }, [
      contact,
    ]),
  );
});
test("agendamento e intervalo inválidos são recusados", () => {
  for (const interval_seconds of [0, 4, 5.5, 3601, NaN])
    assert.throws(() =>
      validateCampaign({ ...c, interval_seconds }, [contact]),
    );
  assert.throws(() =>
    validateCampaign({ ...c, scheduled_at: "2020-01-01" }, [contact]),
  );
  assert.throws(() =>
    validateCampaign({ ...c, scheduled_at: "inválido" }, [contact]),
  );
});
test("canal removido é recusado mesmo com contato válido", () =>
  assert.throws(
    () => validateCampaign({ ...c, channel: "whatsapp" }, [contact]),
    /somente pelo Telegram/,
  ));
test("dados exibidos não são HTML executável", () =>
  assert.equal(
    escapeHTML('<img src="x" onerror="alert(1)">'),
    "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;",
  ));

test("aceita chaves simples e duplas sem personalização recursiva", () => {
  assert.equal(
    personalize("Olá {nome}, {{nome}}! {empresa} / {{empresa}}", contact),
    "Olá Ana, Ana! Flora / Flora",
  );
  assert.equal(
    personalize("{nome} {empresa}", { name: "{empresa}", company: "Flora" }),
    "{empresa} Flora",
  );
});
test("prévia acompanha o contato escolhido e recua quando ele é desmarcado", () => {
  const rows = [
    { id: "a", name: "Ana" },
    { id: "b", name: "Bruno" },
    { id: "c", name: "Carla" },
  ];
  assert.equal(
    recipientPreview(rows, new Set(["a", "b"]), "b").contact.name,
    "Bruno",
  );
  assert.equal(recipientPreview(rows, new Set(["a"]), "b").contact.name, "Ana");
  assert.equal(recipientPreview(rows, new Set(), "b").contact, undefined);
});
