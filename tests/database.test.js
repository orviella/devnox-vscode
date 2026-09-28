import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { telegramPayload } from "../supabase/functions/_shared/providers.ts";
import { PGlite } from "@electric-sql/pglite";

test("migração, isolamento entre usuários, fila atômica e cancelamento", async () => {
  const db = new PGlite();
  const one = "11111111-1111-4111-8111-111111111111",
    two = "22222222-2222-4222-8222-222222222222";
  // Contratos mínimos de Auth/Storage; não substituem um Supabase hospedado.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/sql-editor/01-INSTALAR-BANCO-NOVO.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609230002_telegram_only.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values ($1,$3),($2,$3)", [
    one,
    two,
    "{}",
  ]);
  await db.query("insert into public.dispatch_account(user_id) values ($1)", [
    one,
  ]);
  const asUser = async (id) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  await asUser(one);
  const {
    rows: [contact],
  } = await db.query(
    "insert into contacts(user_id,name,telegram_chat_id,consent) values ($1,$2,$3,true) returning *",
    [one, "Ana", "123"],
  );
  assert.ok(contact.consent_at);
  const payload = {
    name: "Teste",
    channel: "telegram",
    body: "Olá, {{nome}}",
    interval_seconds: 5,
  };
  const {
    rows: [saved],
  } = await db.query("select save_campaign($1,$2) id", [payload, [contact.id]]);
  const cid = saved.id;
  await asUser(two);
  assert.equal((await db.query("select * from contacts")).rows.length, 0);
  assert.equal((await db.query("select * from campaigns")).rows.length, 0);
  await assert.rejects(
    db.query("select save_campaign($1,$2)", [payload, [contact.id]]),
    /Contato inválido/,
  );
  await assert.rejects(db.query("select enqueue_campaign($1)", [cid]));
  await assert.rejects(
    db.query(
      "insert into campaigns(user_id,name,channel) values ($1,'Bypass','telegram')",
      [two],
    ),
    /permission denied/,
  );
  await asUser(one);
  await db.query("select enqueue_campaign($1)", [cid]);
  await assert.rejects(db.query("select enqueue_campaign($1)", [cid]));
  await assert.rejects(
    db.query("select claim_delivery($1)", [one]),
    /permission denied/,
  );
  await db.exec("reset role;set role service_role");
  const first = (await db.query("select claim_delivery($1) job", [one])).rows[0]
    .job;
  assert.equal(first.delivery.contact_id, contact.id);
  assert.equal(
    (await db.query("select claim_delivery($1) job", [one])).rows[0].job,
    null,
  );
  await asUser(one);
  await db.query("select cancel_campaign($1)", [cid]);
  assert.equal(
    (await db.query("select status from campaigns where id=$1", [cid])).rows[0]
      .status,
    "cancelled",
  );
  assert.equal(
    (
      await db.query("select status from deliveries where campaign_id=$1", [
        cid,
      ])
    ).rows[0].status,
    "sending",
  );
  const {
    rows: [draft],
  } = await db.query("select save_campaign($1,$2) id", [payload, [contact.id]]);
  await db.query("update contacts set consent=false where id=$1", [contact.id]);
  assert.equal(
    (
      await db.query("select consent_at from contacts where id=$1", [
        contact.id,
      ])
    ).rows[0].consent_at,
    null,
  );
  await assert.rejects(
    db.query("select enqueue_campaign($1)", [draft.id]),
    /autorização/,
  );

  await db.query("update contacts set consent=true where id=$1", [contact.id]);
  const second = (
    await db.query(
      "insert into contacts(user_id,name,telegram_chat_id,consent) values ($1,'Bruno','456',true) returning *",
      [one],
    )
  ).rows[0];
  await assert.rejects(
    db.query("select save_campaign($1,$2)", [
      { ...payload, channel: "whatsapp" },
      [contact.id],
    ]),
    /Somente Telegram/,
  );
  const multi = (
    await db.query("select save_campaign($1,$2) id", [
      { ...payload, body: "Oi, {nome}!" },
      [contact.id, second.id],
    ])
  ).rows[0].id;
  await db.query("select enqueue_campaign($1)", [multi]);
  const snapshots = (
    await db.query(
      "select * from deliveries where campaign_id=$1 order by recipient_name",
      [multi],
    )
  ).rows;
  assert.deepEqual(
    snapshots.map((x) => telegramPayload({ body: "Oi, {nome}!" }, x).body.text),
    ["Oi, Ana!", "Oi, Bruno!"],
  );
  assert.deepEqual(
    snapshots.map((x) => x.destination),
    ["123", "456"],
  );
  assert.equal(
    (await db.query("select body from campaigns where id=$1", [multi])).rows[0]
      .body,
    "Oi, {nome}!",
  );
  await db.exec("reset role");
  await db.exec(
    await readFile(
      new URL(
        "../supabase/sql-editor/01-ATUALIZAR-BANCO-EXISTENTE.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    (await db.query("select count(*)::int total from contacts")).rows[0].total,
    2,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int total from deliveries where campaign_id=$1",
        [multi],
      )
    ).rows[0].total,
    2,
  );
  // CRUD real sobre PostgreSQL em memória, incluindo isolamento da exclusão.
  await asUser(two);
  assert.equal((await db.query('delete from contacts where id=$1 returning id', [second.id])).rows.length, 0);
  await asUser(one);
  await db.query("update contacts set name='Bruno editado' where id=$1", [second.id]);
  assert.equal((await db.query('select name from contacts where id=$1', [second.id])).rows[0].name, 'Bruno editado');
  assert.equal((await db.query('delete from contacts where id=$1 returning id', [second.id])).rows.length, 1);
  assert.equal((await db.query('select id from contacts where id=$1', [second.id])).rows.length, 0);
  assert.equal((await db.query('select recipient_name from deliveries where campaign_id=$1 and destination=$2', [multi,'456'])).rows[0].recipient_name, 'Bruno');
  await db.close();
});
