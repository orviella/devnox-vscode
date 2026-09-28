import { config } from "../config.js";
import { validateContact } from "./domain.js";
const { createClient } = globalThis.supabase;
const url = config.supabaseUrl;
const key = config.supabasePublishableKey;
const demoRequested = new URLSearchParams(location.search).get("demo") === "1";
export const db =
  url && key && !demoRequested
    ? createClient(url, key)
    : null;
export const demo = !db;
export const demoReason =
  demoRequested
    ? "Modo demonstração: remova ?demo=1 do endereço para entrar com sua conta Supabase."
    : "Preencha a URL e a chave pública do Supabase em config.js e recarregue a página.";

export async function channelStatus() {
  if (demo) throw new Error(demoReason);
  const { data, error } = await db.functions.invoke("channel-status");
  if (error) {
    let detail;
    try {
      detail = (await error.context?.json())?.error;
    } catch {
      /* Resposta sem JSON. */
    }
    throw new Error(
      detail ||
        "Não foi possível verificar o bot. Confira a publicação de channel-status, APP_ORIGIN e sua sessão de login.",
    );
  }
  if (!data || typeof data.telegram !== "boolean")
    throw new Error(
      "Resposta inválida de channel-status. Publique a versão atual da função.",
    );
  return data;
}
const seed = {
  contacts: [
    {
      id: "demo-1",
      name: "Ana Oliveira",
      company: "Estúdio Flora",
      phone: "+5511999990001",
      telegram_chat_id: "100001",
      consent: true,
      link: "https://example.com",
    },
    {
      id: "demo-2",
      name: "Lucas Santos",
      company: "Casa Aurora",
      phone: "+5511999990002",
      telegram_chat_id: "100002",
      consent: true,
      link: "",
    },
    {
      id: "demo-3",
      name: "Marina Costa",
      company: "Ateliê Costa",
      phone: "+5511999990003",
      telegram_chat_id: "100003",
      consent: true,
      link: "",
    },
    {
      id: "demo-4",
      name: "Pedro Lima",
      company: "Lima & Co.",
      phone: "+5511999990004",
      telegram_chat_id: "",
      consent: false,
      link: "",
    },
  ],
  campaigns: [],
  profile: {
    name: "Seu nome",
    phone: "",
    city: "",
    neighborhood: "",
    street: "",
    state: "",
  },
};
function local() {
  try {
    return (
      JSON.parse(localStorage.getItem("devnox-demo-v2")) ||
      structuredClone(seed)
    );
  } catch {
    return structuredClone(seed);
  }
}
function write(data) {
  localStorage.setItem("devnox-demo-v2", JSON.stringify(data));
}
export async function user() {
  if (demo) return { id: "demo", email: "demo@devnox.local" };
  const { data, error } = await db.auth.getUser();
  if (error) return null;
  return data.user;
}
export async function load() {
  if (demo) {
    const d = local();
    return {
      ...d,
      campaigns: d.campaigns.filter((c) => c.channel === "telegram"),
    };
  }
  const results = await Promise.all([
    db.from("contacts").select("*").order("name"),
    db
      .from("campaigns")
      .select("*, deliveries(id,status,error,recipient_name)")
      .eq("channel", "telegram")
      .order("created_at", { ascending: false }),
    db.from("profiles").select("*").single(),
  ]);
  for (const r of results) if (r.error) throw r.error;
  return {
    contacts: results[0].data,
    campaigns: results[1].data,
    profile: results[2].data,
  };
}
export async function saveContact(contact) {
  // Aceitamos somente os campos do formulário; o dono vem da sessão.
  const id = contact.id;
  contact = validateContact(contact);
  if (demo) {
    const d = local();
    if (id) {
      if (!d.contacts.some((x) => x.id === id))
        throw new Error("Contato não encontrado. Atualize a lista.");
      d.contacts = d.contacts.map((x) => (x.id === id ? { ...contact, id } : x));
    }
    else d.contacts.push({ ...contact, id: crypto.randomUUID() });
    write(d);
    return;
  }
  const u = await user();
  if (!u) throw new Error("Sua sessão expirou. Entre novamente.");
  // UPDATE altera um registro existente. CREATE insere um novo registro.
  // Separar as operações evita recriar um contato excluído em outra aba.
  const query = id
    ? db.from("contacts").update(contact).eq("id", id).eq("user_id", u.id)
    : db.from("contacts").insert({ ...contact, user_id: u.id });
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Contato não encontrado ou sem permissão. Atualize a lista.");
}
export async function deleteContact(id) {
  if (!id) throw new Error("Selecione um contato válido.");
  if (demo) {
    const d = local();
    if (!d.contacts.some((c) => c.id === id)) throw new Error("Contato não encontrado.");
    d.contacts = d.contacts.filter((c) => c.id !== id);
    d.campaigns = d.campaigns.map((c) => ({ ...c, contact_ids: (c.contact_ids || []).filter((x) => x !== id) }));
    write(d);
    return;
  }
  const u = await user();
  if (!u) throw new Error("Sua sessão expirou. Entre novamente.");
  const { data, error } = await db.from("contacts").delete().eq("id", id).eq("user_id", u.id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Contato não encontrado ou sem permissão para excluir.");
}
export async function saveProfile(profile) {
  if (demo) {
    const d = local();
    d.profile = { ...d.profile, ...profile };
    write(d);
    return;
  }
  const { error } = await db
    .from("profiles")
    .update(profile)
    .eq("id", (await user()).id);
  if (error) throw error;
}
export async function upload(file, kind = "media") {
  const allowed =
    kind === "avatars"
      ? ["image/jpeg", "image/png"]
      : ["image/jpeg", "image/png", "video/mp4", "application/pdf"];
  if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024)
    throw new Error("Use JPG, PNG, MP4 ou PDF de até 5 MB (foto: JPG/PNG).");
  if (demo)
    return {
      path: `demo/${file.name}`,
      url: URL.createObjectURL(file),
      type: file.type,
    };
  const path = `${(await user()).id}/${kind}/${crypto.randomUUID()}.${file.name.split(".").pop().toLowerCase()}`;
  const { error } = await db.storage.from("campaign-assets").upload(path, file);
  if (error) throw error;
  return { path, url: await signedUrl(path), type: file.type };
}
export async function signedUrl(path) {
  if (!path || demo) return "";
  const { data, error } = await db.storage
    .from("campaign-assets")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function saveCampaign(c, ids) {
  if (demo) {
    const d = local();
    const row = {
      ...c,
      id: c.id || crypto.randomUUID(),
      contact_ids: ids,
      status: "draft",
      created_at: new Date().toISOString(),
    };
    const old = d.campaigns.findIndex((x) => x.id === row.id);
    if (old < 0) d.campaigns.unshift(row);
    else d.campaigns[old] = row;
    write(d);
    return row.id;
  }
  const { data, error } = await db.rpc("save_campaign", {
    payload: c,
    recipient_ids: ids,
  });
  if (error) throw error;
  return data;
}
export async function enqueue(id) {
  if (demo)
    throw new Error(
      "A demonstração não envia mensagens. Configure o Supabase para ativar o envio.",
    );
  const { error } = await db.rpc("enqueue_campaign", { campaign_id: id });
  if (error) throw error;
}
export async function cancel(id) {
  if (demo) {
    const d = local();
    d.campaigns = d.campaigns.filter((x) => x.id !== id);
    write(d);
    return;
  }
  const { error } = await db.rpc("cancel_campaign", { campaign_id: id });
  if (error) throw error;
}
