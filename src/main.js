import { pages, pageUrl, navigate } from "./navigation.js";
const currentPage = document.body.dataset.page;
const {
  createIcons,
  Send,
  ChevronsUpDown,
  SquarePen,
  Layers,
  Users,
  Plug,
  Sparkles,
  Settings2,
  CircleUserRound,
  ArrowUpRight,
  SunMoon,
  MessageCircle,
  Search,
  CloudUpload,
  Clock3,
  ArrowRight,
  Eye,
  EllipsisVertical,
  Mic,
  ShieldCheck,
  X,
  Plus,
  FilePenLine,
  CheckCheck,
  RefreshCw,
  MessagesSquare,
  UserPlus,
  Info,
  Sun,
  Moon,
  Monitor,
  UserRound,
  LogOut,
} = globalThis.lucide;
const icons = {
  Send,
  ChevronsUpDown,
  SquarePen,
  Layers,
  Users,
  Plug,
  Sparkles,
  Settings2,
  CircleUserRound,
  ArrowUpRight,
  SunMoon,
  MessageCircle,
  Search,
  CloudUpload,
  Clock3,
  ArrowRight,
  Eye,
  EllipsisVertical,
  Mic,
  ShieldCheck,
  X,
  Plus,
  FilePenLine,
  CheckCheck,
  RefreshCw,
  MessagesSquare,
  UserPlus,
  Info,
  Sun,
  Moon,
  Monitor,
  UserRound,
  LogOut,
};
import * as api from "./data.js";
import {
  personalize,
  recipientPreview,
  eligible,
  validateCampaign,
  escapeHTML as e,
} from "./domain.js";
const $ = (s) => document.querySelector(s);
const icon = (n) => `<i data-lucide="${n}"></i>`;
const labels = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Em andamento",
  completed: "Processada",
  cancelled: "Cancelada",
  pending: "Aguardando",
  sending: "Enviando",
  accepted: "Aceita pela API",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  unknown: "Verificar envio",
};
let previewContactId = null;
let state,
  currentUser,
  view = "compose",
  selected = new Set(),
  media = null,
  draftId = null,
  channel = "telegram",
  avatarUrl = "",
  busy = false;
let theme = localStorage.getItem("devnox-theme") || "light";
function applyTheme() {
  document.documentElement.dataset.theme =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  applyTheme,
);
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $("#toast").classList.remove("show"),
    6500,
  );
}
function enhance() {
  document.querySelectorAll('a[href]').forEach((link) => {
    const target = Object.entries(pages).find(([, file]) => link.getAttribute('href').split('?')[0] === './' + file);
    if (target) link.href = pageUrl(target[0]);
  });
  createIcons({ icons });
}
async function action(fn) {
  if (busy) return;
  busy = true;
  document.body.classList.add("busy");
  try {
    await fn();
  } catch (err) {
    toast(err.message || "Não foi possível concluir. Tente novamente.");
  } finally {
    busy = false;
    document.body.classList.remove("busy");
  }
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
}
function badge(text, cls = "") {
  return `<span class="badge ${cls}">${e(text)}</span>`;
}
function updateAccountAvatar() {
  const avatar = $("#account-avatar");
  if (!avatar) return;
  const initial = (state.profile.name || "D").slice(0, 1).toUpperCase();
  avatar.textContent = initial;
  if (!avatarUrl) return;
  const image = document.createElement("img");
  image.alt = "Sua foto de perfil";
  // Se a imagem não carregar, o menu continua mostrando a inicial.
  image.onerror = () => { avatar.textContent = initial; };
  image.src = avatarUrl;
  avatar.replaceChildren(image);
}
function shell() {
  $("#app").replaceChildren($("#workspace-template").content.cloneNode(true));
  updateAccountAvatar();
  $("#account-name").textContent = state.profile.name || "Minha conta";
  $("#account-email").textContent = api.demo ? "Espaço de demonstração" : currentUser.email;
  $("#connection-badge").textContent = api.demo ? "Demonstração" : "Supabase conectado";
  $("#connection-badge").classList.add(api.demo ? "demo" : "green");
  $("#theme-toggle").onclick = () => {
    theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("devnox-theme", theme);
    applyTheme();
  };
  $("#account").onclick = () => navigate("profile");
  render();
}
// Os títulos estão nos arquivos HTML de cada página.

function render() {
  window.scrollTo(0, 0);
  view = currentPage;
  document
    .querySelectorAll("[data-nav]")
    .forEach((x) => x.classList.toggle("active", x.dataset.nav === view));
  $("#breadcrumb").textContent = {
    compose: "Nova campanha",
    campaigns: "Campanhas",
    contacts: "Contatos",
    channels: "Canais",
    settings: "Configurações",
    profile: "Meu perfil",
  }[view];
  ({
    compose: () => {
      const id = new URLSearchParams(location.search).get("draft");
      const draft = state.campaigns.find((c) => c.id === id && c.status === "draft");
      compose(draft);
      if (id && !draft) toast("Rascunho não encontrado. Você pode criar uma nova campanha.");
    },
    campaigns: campaigns,
    contacts: contacts,
    channels: channels,
    settings: settings,
    profile: profile,
  })[view]();
  enhance();
}
function compose(c) {
  draftId = c?.id || null;
  channel = "telegram";
  previewContactId = null;
  selected = new Set(c?.contact_ids || []);
  media = c?.media_path
    ? { path: c.media_path, type: c.media_type, url: "" }
    : null;
  $("#page-content").innerHTML =
    `<div class="steps"><span class="current"><b>1</b>Escolha seu público</span><i></i><span><b>2</b>Crie a mensagem</span><i></i><span><b>3</b>Revise e envie</span></div><form id="campaign-form"><div class="compose-grid"><div class="editor"><section class="card"><div class="section-title"><span class="step-number">01</span><div><h2>Para quem vamos enviar?</h2><p>Selecione os contatos que autorizaram mensagens do seu bot.</p></div></div><div class="channel-options telegram-only"><button type="button" class="channel-option" data-channel="telegram"><span class="channel-icon tg">${icon("send")}</span><span><strong>Telegram</strong><small>Mensagens pelo seu bot</small></span><span class="radio-dot"></span></button></div><div class="contact-label"><label for="contact-search">Destinatários</label><span id="selected-count">0 selecionados</span></div><div class="search">${icon("search")}<input id="contact-search" placeholder="Buscar nome ou empresa" autocomplete="off"></div><div id="contact-picker" class="contact-picker"></div><div class="contact-bottom"><button type="button" class="text-button" id="select-all">Selecionar disponíveis</button><a href="./contatos.html">Gerenciar contatos ${icon("arrow-up-right")}</a></div></section><section class="card"><div class="section-title"><span class="step-number">02</span><div><h2>Dê voz à sua campanha</h2><p>Uma boa mensagem começa com um toque pessoal.</p></div></div>${field("Nome da campanha", "name", c?.name || "", "text", 'required maxlength="100" placeholder="Ex.: Novidades de setembro"')}<label class="field" for="message">Sua mensagem <span class="optional" id="message-hint"></span></label><div class="message-editor"><textarea id="message" name="body" rows="6" placeholder="Olá, {{nome}}! Temos uma novidade para compartilhar com você.">${e(c?.body || "")}</textarea><div class="message-toolbar"><span>Personalizar</span>${["nome", "empresa", "link"].map((x) => `<button type="button" data-token="${x}">{{${x}}}</button>`).join("")}<span id="char-count">0</span></div></div><div class="attachment-title">Anexo <span class="optional">opcional · Telegram</span></div><label class="dropzone" id="dropzone" for="media-file">${icon("cloud-upload")}<strong id="media-name">Clique para anexar <span>ou arraste um arquivo</span></strong><small>JPG, PNG, MP4 ou PDF · até 5 MB · 1 arquivo</small><input id="media-file" type="file" accept="image/jpeg,image/png,video/mp4,application/pdf" hidden></label><button type="button" class="text-button" id="remove-media" hidden>Remover anexo</button></section><section class="card"><div class="section-title"><span class="step-number">03</span><div><h2>No momento certo</h2><p>Envie assim que a fila processar ou escolha um horário.</p></div></div><div class="two-col"><label class="field">Quando enviar?<select name="timing" id="timing"><option value="now">Assim que possível</option><option value="later">Agendar envio</option></select></label>${field("Intervalo mínimo (segundos)", "interval_seconds", c?.interval_seconds || 5, "number", 'min="5" max="3600" required')}</div><label class="field" id="schedule-field" hidden>Data e hora local<input type="datetime-local" name="schedule"></label><p class="help">${icon("clock-3")}Horário do navegador: ${e(Intl.DateTimeFormat().resolvedOptions().timeZone)}. A fila verifica novos envios a cada minuto.</p></section><div class="form-actions"><span id="draft-note">Você pode salvar e continuar depois.</span><button type="button" id="save-draft" class="button secondary">Salvar rascunho</button><button type="submit" class="button primary">Revisar campanha ${icon("arrow-right")}</button></div></div><aside class="preview-column"><div class="preview-sticky"><div class="preview-title"><span>${icon("eye")}Prévia da mensagem</span>${badge("Ao vivo", "green")}</div><div class="recipient-preview"><label class="field">Prévia para<select id="preview-recipient" aria-label="Prévia para"></select></label><div class="preview-nav"><button type="button" id="preview-previous" class="button secondary" aria-label="Destinatário anterior">←</button><span id="preview-position" aria-live="polite"></span><button type="button" id="preview-next" class="button secondary" aria-label="Próximo destinatário">→</button></div><button type="button" id="preview-all" class="text-button">Conferir todas as mensagens</button><p class="help">Cada pessoa receberá a mensagem com os próprios dados. Aceita {nome} e {{nome}}.</p></div><div class="phone"><div class="phone-top"><span>9:41</span><span>● ▰</span></div><div class="chat-header"><span>‹</span><span class="chat-avatar">D</span><div>DevNox<small id="preview-channel">Telegram · bot</small></div>${icon("ellipsis-vertical")}</div><div class="chat-body"><span class="chat-date">HOJE</span><div class="bubble"><div id="preview-media"></div><p id="preview-text">Sua próxima conversa começa aqui. ✨</p><small>09:41 <span>✓✓</span></small></div></div><div class="chat-input">Mensagem ${icon("mic")}</div><div class="phone-bottom"></div></div><p class="preview-caption">É assim que sua mensagem pode aparecer.<br>A aparência varia conforme o aplicativo.</p><div class="summary-card"><h3>Resumo da campanha</h3><div><span>Canal de envio</span><strong id="summary-channel">Telegram</strong></div><div><span>Destinatários</span><strong id="summary-count">0 contatos</strong></div><div><span>Envio</span><strong id="summary-time">Assim que possível</strong></div></div><div class="privacy-note">${icon("shield-check")}Envie para pessoas que autorizaram receber suas mensagens.</div></div></aside></div></form>`;
  if (c?.scheduled_at) {
    $("#timing").value = "later";
    const dt = new Date(c.scheduled_at);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    $("[name=schedule]").value = dt.toISOString().slice(0, 16);
  }
  document.querySelectorAll("[data-channel]").forEach(
    (b) =>
      (b.onclick = () => {
        channel = b.dataset.channel;
        selected = new Set(
          [...selected].filter((id) =>
            eligible(state.contacts.find((x) => x.id === id) || {}, channel),
          ),
        );
        updateChannel();
      }),
  );
  $("#preview-recipient").onchange = (ev) => {
    previewContactId = ev.target.value;
    preview();
  };
  for (const [id, step] of [
    ["preview-previous", -1],
    ["preview-next", 1],
  ])
    $("#" + id).onclick = () => {
      const { recipients, contact } = recipientPreview(
        state.contacts,
        selected,
        previewContactId,
      );
      previewContactId =
        recipients[recipients.indexOf(contact) + step]?.id || contact?.id;
      preview();
    };
  $("#preview-all").onclick = () => showAllPreviews();
  $("#contact-search").oninput = picker;
  $("#select-all").onclick = () => {
    const all = state.contacts.filter((x) => eligible(x, channel));
    if (all.every((x) => selected.has(x.id))) selected.clear();
    else all.forEach((x) => selected.add(x.id));
    picker();
  };
  $("#message").oninput = preview;
  document.querySelectorAll("[data-token]").forEach(
    (b) =>
      (b.onclick = () => {
        const t = $("#message");
        t.setRangeText(
          `{{${b.dataset.token}}}`,
          t.selectionStart,
          t.selectionEnd,
          "end",
        );
        t.focus();
        preview();
      }),
  );
  $("#timing").onchange = () => {
    $("#schedule-field").hidden = $("#timing").value !== "later";
    $("[name=schedule]").required = $("#timing").value === "later";
    preview();
  };
  $("#timing").onchange();
  $("#media-file").onchange = () => attach($("#media-file").files[0]);
  $("#dropzone").ondragover = (ev) => {
    ev.preventDefault();
  };
  $("#dropzone").ondrop = (ev) => {
    ev.preventDefault();
    attach(ev.dataTransfer.files[0]);
  };
  $("#remove-media").onclick = () => {
    media = null;
    $("#media-file").value = "";
    updateMedia();
  };
  $("#save-draft").onclick = () =>
    action(async () => {
      const c = collect();
      if (!c.name.trim()) throw new Error("Dê um nome ao rascunho.");
      draftId = await api.saveCampaign(c, [...selected]);
      state = await api.load();
      toast("Rascunho salvo.");
    });
  $("#campaign-form").onsubmit = (ev) => {
    ev.preventDefault();
    action(async () => {
      const c = collect();
      validateCampaign(
        c,
        state.contacts.filter((x) => selected.has(x.id)),
      );
      review(c);
    });
  };
  updateChannel();
  updateMedia();
  if (media && !api.demo)
    api
      .signedUrl(media.path)
      .then((url) => {
        if (media) {
          media.url = url;
          preview();
        }
      })
      .catch((err) => toast(err.message));
}
function picker() {
  const q = $("#contact-search").value.toLowerCase();
  $("#contact-picker").innerHTML =
    state.contacts
      .filter((x) => `${x.name} ${x.company}`.toLowerCase().includes(q))
      .map(
        (x) =>
          `<label class="contact-row ${eligible(x, channel) ? "" : "unavailable"}"><input type="checkbox" value="${e(x.id)}" ${selected.has(x.id) ? "checked" : ""} ${eligible(x, channel) ? "" : "disabled"}><span class="contact-avatar">${e(x.name.slice(0, 1))}</span><span><strong>${e(x.name)}</strong><small>${e(x.company || "Sem empresa")}${!eligible(x, channel) ? " · Sem autorização ou destino" : ""}</small></span>${icon("send")}</label>`,
      )
      .join("") || '<p class="empty-inline">Nenhum contato encontrado.</p>';
  $("#contact-picker")
    .querySelectorAll("input")
    .forEach(
      (x) =>
        (x.onchange = () => {
          x.checked ? selected.add(x.value) : selected.delete(x.value);
          preview();
        }),
    );
  preview();
}
function updateChannel() {
  document
    .querySelectorAll("[data-channel]")
    .forEach((x) => x.classList.add("selected"));
  $("#message-hint").textContent = "individual para cada contato";
  updateMedia();
  picker();
}
async function attach(file) {
  if (!file) return;
  if (channel !== "telegram") {
    toast("Anexos disponíveis para Telegram.");
    return;
  }
  await action(async () => {
    media = await api.upload(file);
    media.name = file.name;
    updateMedia();
    toast(
      api.demo
        ? "Anexo apenas nesta prévia; não será enviado."
        : "Anexo carregado.",
    );
  });
}
function updateMedia() {
  if (!$("#media-name")) return;
  $("#media-name").textContent = media
    ? media.name || media.path.split("/").pop()
    : "Clique para anexar ou arraste um arquivo";
  $("#remove-media").hidden = !media;
  preview();
}
function preview() {
  if (!$("#message")) return;
  const { recipients, contact } = recipientPreview(
    state.contacts,
    selected,
    previewContactId,
  );
  previewContactId = contact?.id || null;
  const select = $("#preview-recipient");
  select.innerHTML = recipients.length
    ? recipients
        .map((c) => `<option value="${e(c.id)}">${e(c.name)}</option>`)
        .join("")
    : '<option value="">Selecione um contato</option>';
  select.value = previewContactId || "";
  select.disabled = !recipients.length;
  $("#preview-position").textContent = contact
    ? `${recipients.indexOf(contact) + 1} de ${recipients.length} · prévia individual`
    : "Selecione os destinatários para conferir.";
  $("#preview-all").disabled = !recipients.length;
  const idx = recipients.indexOf(contact);
  $("#preview-previous").disabled = idx <= 0;
  $("#preview-next").disabled = idx < 0 || idx >= recipients.length - 1;
  $("#preview-text").textContent =
    personalize($("#message").value, contact) ||
    "Sua próxima conversa começa aqui. ✨";
  $("#char-count").textContent = `${$("#message").value.length} caracteres`;
  $("#preview-channel").textContent = "Telegram · bot";
  $("#summary-channel").textContent = "Telegram";
  $("#selected-count").textContent =
    `${selected.size} ${selected.size === 1 ? "selecionado" : "selecionados"}`;
  $("#summary-count").textContent =
    `${selected.size} ${selected.size === 1 ? "contato" : "contatos"}`;
  $("#summary-time").textContent =
    $("#timing").value === "later" ? "Agendado" : "Assim que possível";
  $("#preview-media").innerHTML = media
    ? media.type?.startsWith("image/") && media.url
      ? `<img src="${e(media.url)}" alt="Prévia do anexo">`
      : `<span class="file-preview">Anexo: ${e(media.name || "Arquivo")}</span>`
    : "";
}
function collect() {
  const f = new FormData($("#campaign-form"));
  if (f.get("timing") === "later" && !f.get("schedule"))
    throw new Error("Escolha a data e a hora do agendamento.");
  return {
    id: draftId,
    name: f.get("name").trim(),
    channel,
    body: f.get("body"),
    interval_seconds: Number(f.get("interval_seconds")),
    scheduled_at:
      f.get("timing") === "later" && f.get("schedule")
        ? new Date(f.get("schedule")).toISOString()
        : null,
    media_path: media?.path || null,
    media_type: media?.type || null,
  };
}
function modal(html) {
  const el = $("#modal");
  el.innerHTML = `<button class="icon-button modal-close" aria-label="Fechar">${icon("x")}</button>${html}`;
  el.querySelector(".modal-close").onclick = () => el.close();
  el.showModal();
  enhance();
}
function review(c) {
  modal(
    `<p class="eyebrow">ÚLTIMA CONFERÊNCIA</p><h2>Pronto para conectar?</h2><p>Campanha <strong>${e(c.name)}</strong> para <strong>${selected.size} ${selected.size === 1 ? "contato" : "contatos"}</strong> pelo ${e(c.channel)}.</p><div class="all-previews">${state.contacts
      .filter((x) => selected.has(x.id))
      .map(
        (x) =>
          `<article><h3>${e(x.name)}</h3><p class="review-message">${e(personalize(c.body, x))}</p></article>`,
      )
      .join(
        "",
      )}</div><p class="help">${c.scheduled_at ? `Agendada para ${new Date(c.scheduled_at).toLocaleString("pt-BR")}` : "O envio começa na próxima execução da fila."}</p>${api.demo ? '<div class="notice">Modo demonstração: salve o rascunho e configure o Supabase para enviar.</div>' : ""}<button id="confirm-send" class="button primary" ${api.demo ? "disabled" : ""}>Confirmar e colocar na fila ${icon("send")}</button>`,
  );
  $("#confirm-send").onclick = () =>
    action(async () => {
      const data = await api.channelStatus();
      if (!data[channel])
        throw new Error(
          data.reason ||
            "Este canal ainda não está configurado para sua conta. Veja Canais.",
        );
      draftId = await api.saveCampaign({ ...c, id: draftId }, [...selected]);
      await api.enqueue(draftId);
      $("#modal").close();
      toast("Campanha adicionada à fila. Acompanhe o resultado em Campanhas.");
      draftId = null;
      state = await api.load();
      navigate("campaigns");
      toast("Campanha adicionada à fila.");
    });
}
function campaigns() {
  const rows = state.campaigns;
  $("#page-content").innerHTML =
    `<div class="metrics">${[
      ["Campanhas", rows.length, "layers"],
      [
        "Rascunhos",
        rows.filter((x) => x.status === "draft").length,
        "file-pen-line",
      ],
      [
        "Na fila",
        rows.filter((x) => ["queued", "running"].includes(x.status)).length,
        "clock-3",
      ],
      [
        "Aceitas pela API",
        rows.reduce(
          (n, c) =>
            n +
            (c.deliveries || []).filter((x) =>
              ["accepted", "delivered", "read"].includes(x.status),
            ).length,
          0,
        ),
        "check-check",
      ],
    ]
      .map(
        ([t, n, ic]) =>
          `<div class="card metric">${icon(ic)}<span>${t}</span><strong>${n}</strong></div>`,
      )
      .join(
        "",
      )}</div><section class="card"><div class="section-title"><h2>Suas campanhas</h2><button class="text-button" id="refresh">${icon("refresh-cw")}Atualizar</button></div>${rows.length ? `<div class="table-scroll"><table><thead><tr><th>Campanha</th><th>Canal</th><th>Status</th><th>Criada em</th><th>Ações</th></tr></thead><tbody>${rows.map((c) => `<tr><td><strong>${e(c.name)}</strong></td><td>${e(c.channel)}</td><td>${badge(labels[c.status] || c.status, c.status === "completed" ? "green" : "")}</td><td>${new Date(c.created_at).toLocaleDateString("pt-BR")}</td><td><button class="text-button" data-campaign="${e(c.id)}">${c.status === "draft" ? "Continuar" : "Detalhes"} ${icon("arrow-up-right")}</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">' + icon("messages-square") + '<h3>Sua primeira campanha está por vir.</h3><p>Crie uma mensagem, escolha seu público e salve seu rascunho.</p><a class="button secondary" href="./nova-campanha.html">Criar campanha</a></div>'}</section>`;
  $("#refresh").onclick = () =>
    action(async () => {
      state = await api.load();
      campaigns();
      enhance();
    });
  document.querySelectorAll("[data-campaign]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = rows.find((x) => x.id === b.dataset.campaign);
        if (c.status === "draft") {
          navigate("compose", { draft: c.id });
        } else {
          modal(
            `<h2>${e(c.name)}</h2><p>${labels[c.status]}</p><div class="delivery-list">${(c.deliveries || []).map((d) => `<p><strong>${e(d.recipient_name)}</strong> · ${e(labels[d.status])}<small>${e(d.error || "")}</small></p>`).join("") || "Nenhum envio registrado."}</div>${["queued", "running"].includes(c.status) ? '<button class="button secondary" id="cancel-campaign">Cancelar mensagens pendentes</button>' : ""}`,
          );
          if ($("#cancel-campaign"))
            $("#cancel-campaign").onclick = () =>
              action(async () => {
                await api.cancel(c.id);
                $("#modal").close();
                state = await api.load();
                render();
                toast(
                  "Pendentes canceladas; mensagens em processamento podem concluir.",
                );
              });
        }
      }),
  );
}
function contacts() {
  $("#page-content").replaceChildren($("#contacts-template").content.cloneNode(true));
  $("#refresh-contacts").onclick = () => action(async () => {
    state = await api.load(); contacts(); enhance(); toast("Contatos atualizados.");
  });
  const draw = () => {
    $("#contacts-body").innerHTML =
      state.contacts
        .filter((c) =>
          `${c.name} ${c.company}`
            .toLowerCase()
            .includes($("#list-search").value.toLowerCase()),
        )
        .map(
          (c) =>
            `<tr><td><strong>${e(c.name)}</strong><small>${e(c.company)}</small></td><td>${e(c.phone || "—")}</td><td>${e(c.telegram_chat_id || "—")}</td><td>${badge(c.consent ? "Autorizado" : "Não autorizado", c.consent ? "green" : "")}</td><td><button class="text-button" data-contact="${e(c.id)}">Editar</button> <button class="text-button" data-delete-contact="${e(c.id)}">Excluir</button></td></tr>`,
        )
        .join("") || '<tr><td colspan="5">Nenhum contato encontrado.</td></tr>';
    document
      .querySelectorAll("[data-contact]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            contactForm(
              state.contacts.find((c) => c.id === b.dataset.contact),
            )),
      );
  };
  $("#contacts-body").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-contact]");
    if (!button) return;
    const contact = state.contacts.find((c) => c.id === button.dataset.deleteContact);
    if (!contact) return;
    modal(`<h2>Excluir contato?</h2><p>Confirma a exclusão de <strong>${e(contact.name)}</strong>?</p><p>O histórico de campanhas será preservado. Envios pendentes para este contato não poderão ser concluídos.</p><div class="two-col"><button class="button secondary" id="keep-contact">Cancelar</button><button class="button primary" id="confirm-delete-contact">Excluir contato</button></div>`);
    $("#keep-contact").onclick = () => $("#modal").close();
    $("#confirm-delete-contact").onclick = () => action(async () => {
      await api.deleteContact(contact.id);
      selected.delete(contact.id);
      $("#modal").close();
      state = await api.load(); render(); toast("Contato excluído.");
    });
  });
  $("#list-search").oninput = draw;
  $("#add-contact").onclick = () => contactForm();
  draw();
}
function contactForm(c = {}) {
  modal($("#contact-form-template").innerHTML);
  $("#contact-form-title").textContent = c.id ? "Editar contato" : "Novo contato";
  for (const name of ["name", "company", "phone", "telegram_chat_id", "link"]) {
    $("#contact-form").elements[name].value = c[name] || "";
  }
  $("#contact-form").elements.consent.checked = !!c.consent;
  $("#contact-form").onsubmit = (ev) => {
    ev.preventDefault();
    action(async () => {
      const data = Object.fromEntries(new FormData(ev.target));
      data.consent = !!data.consent;
      if (c.id) data.id = c.id;
      await api.saveContact(data);
      state = await api.load();
      $("#modal").close();
      render();
      toast("Contato salvo.");
    });
  };
}
function channels() {
  $("#page-content").innerHTML =
    `<section class="card integration narrow"><span class="channel-icon tg">${icon("send")}</span><h2>Telegram Bot</h2><p>Mensagens individuais com texto, foto, vídeo ou PDF.</p><div id="status-telegram">${badge(api.demo ? "Demonstração · sem envio" : "Conexão ainda não verificada")}</div><hr><p>Crie o bot com @BotFather, configure TELEGRAM_BOT_TOKEN nas secrets do Supabase e autorize sua conta. Cada destinatário precisa iniciar uma conversa com o bot e ter o chat ID cadastrado.</p><button class="button secondary" id="check-channels">${icon("refresh-cw")}Verificar bot</button><p class="help" id="bot-details">Siga o arquivo COMECE-AQUI.md incluído no projeto.</p></section><section class="card flow"><h2>O caminho da mensagem</h2><p>Site → Supabase → fila → seu bot Telegram → cada contato</p><p class="help">O servidor personaliza a mensagem para cada pessoa, sem depender de quem aparece na prévia.</p></section>`;
  $("#check-channels").onclick = () =>
    action(async () => {
      if (api.demo) {
        toast(api.demoReason);
        return;
      }
      const data = await api.channelStatus();
      $("#status-telegram").innerHTML = badge(
        data.telegram ? "Bot verificado" : "Configuração pendente",
        data.telegram ? "green" : "",
      );
      $("#bot-details").textContent = data.telegram
        ? `Bot: @${data.username}. Abra https://t.me/${data.username} e envie /start. A verificação do bot não confirma se o Cron está ativo; confira o passo 6 do COMECE-AQUI.md.`
        : data.reason;
    });
}
function showAllPreviews() {
  const list = state.contacts.filter((c) => selected.has(c.id));
  const text = $("#message").value;
  modal(
    `<h2>Uma mensagem para cada pessoa</h2><p>${list.length} destinatários selecionados. O texto abaixo é personalizado individualmente.</p><div class="all-previews">${list.map((c) => `<article><h3>${e(c.name)}</h3><small>Chat ID: ${e(c.telegram_chat_id)}</small><p class="review-message">${e(personalize(text, c)) || "Escreva uma mensagem no editor."}</p></article>`).join("")}</div>`,
  );
}
function settings() {
  $("#page-content").innerHTML =
    `<section class="card narrow"><h2>Aparência</h2><p>Escolha como você prefere trabalhar.</p><div class="theme-options">${[
      ["light", "sun", "Claro"],
      ["dark", "moon", "Escuro"],
      ["system", "monitor", "Sistema"],
    ]
      .map(
        ([v, i, t]) =>
          `<button class="theme-option ${v === theme ? "selected" : ""}" data-theme-choice="${v}">${icon(i)}${t}</button>`,
      )
      .join(
        "",
      )}</div><hr><h2>Ambiente</h2><p>${api.demo ? "Demonstração local · dados salvos somente neste navegador." : "Supabase · autenticação, dados e arquivos conectados."}</p><p class="help">${api.demo ? "Para ativar, confira config.js e remova ?demo=1 do endereço. Os contatos fictícios não são transferidos." : "Credenciais dos canais são configuradas nas Edge Function Secrets."}</p></section>`;
  document.querySelectorAll("[data-theme-choice]").forEach(
    (b) =>
      (b.onclick = () => {
        theme = b.dataset.themeChoice;
        localStorage.setItem("devnox-theme", theme);
        applyTheme();
        settings();
        enhance();
      }),
  );
}
function profile() {
  const p = state.profile;
  $("#page-content").innerHTML =
    `<section class="card narrow"><div class="profile-head"><span class="profile-avatar" id="profile-avatar">${avatarUrl ? `<img src="${e(avatarUrl)}" alt="Sua foto">` : icon("user-round")}</span><div><h2>${e(p.name || "Seu perfil")}</h2><label class="text-button" for="avatar-file">Alterar foto</label><input type="file" id="avatar-file" accept="image/png,image/jpeg" hidden></div></div><form id="profile-form"><div class="two-col">${field("Nome", "name", p.name || "", "text", "required")}${field("Telefone", "phone", p.phone || "", "tel")}</div>${field("E-mail", "email", currentUser.email, "email", "disabled")}<h3>Endereço</h3><div class="two-col">${field("Cidade", "city", p.city || "")}${field("Estado", "state", p.state || "")}${field("Bairro", "neighborhood", p.neighborhood || "")}${field("Logradouro", "street", p.street || "")}</div><button class="button primary">Salvar alterações</button></form><hr><div class="profile-actions"><button class="button secondary" id="password">Alterar senha</button><button class="text-button" id="logout">${icon("log-out")}${api.demo ? "Ver tela de login" : "Sair da conta"}</button></div></section>`;
  $("#profile-form").onsubmit = (ev) => {
    ev.preventDefault();
    action(async () => {
      await api.saveProfile(Object.fromEntries(new FormData(ev.target)));
      state = await api.load();
      shell();
      toast("Perfil atualizado.");
    });
  };
  $("#avatar-file").onchange = () =>
    action(async () => {
      const file = $("#avatar-file").files[0];
      if (!file) return;
      const result = await api.upload(file, "avatars");
      if (api.demo) {
        const reader = new FileReader();
        avatarUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await api.saveProfile({ avatar_path: avatarUrl });
      } else {
        await api.saveProfile({ avatar_path: result.path });
        avatarUrl = result.url;
      }
      state = await api.load();
      updateAccountAvatar();
      profile();
      enhance();
      toast("Foto atualizada.");
    });
  $("#logout").onclick = () =>
    action(async () => {
      if (api.db) await api.db.auth.signOut();
      navigate("login");
    });
  $("#password").onclick = () => {
    if (api.demo) {
      toast("A alteração de senha fica disponível com o Supabase conectado.");
      return;
    }
    modal(
      '<h2>Alterar senha</h2><form id="password-form">' +
        field(
          "Nova senha",
          "password",
          "",
          "password",
          'minlength="8" required autocomplete="new-password"',
        ) +
        '<button class="button primary">Salvar senha</button></form>',
    );
    $("#password-form").onsubmit = (ev) => {
      ev.preventDefault();
      action(async () => {
        const { error } = await api.db.auth.updateUser({
          password: new FormData(ev.target).get("password"),
        });
        if (error) throw error;
        $("#modal").close();
        toast("Senha atualizada.");
      });
    };
  };
}
function auth(signup = false) {
  $("#app").replaceChildren($("#auth-template").content.cloneNode(true));
  $("#auth-title").textContent = signup ? "Vamos começar?" : "Bem-vindo de volta.";
  $("#auth-description").textContent = signup ? "Crie sua conta para conectar suas conversas." : "Entre para dar vida à sua próxima campanha.";
  $("#signup-fields").hidden = !signup;
  const form = $("#auth-form");
  form.elements.name.disabled = !signup;
  form.elements.name.required = signup;
  form.elements.phone.disabled = !signup;
  form.elements.password.autocomplete = signup ? "new-password" : "current-password";
  $("#auth-submit").textContent = signup ? "Criar conta" : "Entrar";
  $("#auth-submit").disabled = api.demo;
  $("#auth-switch-label").textContent = signup ? "Já tem uma conta?" : "Primeira vez aqui?";
  $("#auth-switch").textContent = signup ? "Entrar" : "Criar conta";
  $("#auth-demo-notice").hidden = !api.demo;
  $("#demo-enter").hidden = !api.demo;
  $("#auth-switch").onclick = () => {
    const params = new URLSearchParams(location.search);
    navigate(signup ? "login" : "signup", {
      ...(params.get("next") ? { next: params.get("next") } : {}),
      ...(params.get("draft") ? { draft: params.get("draft") } : {}),
    });
  };
  if ($("#demo-enter")) $("#demo-enter").onclick = () => navigate("contacts");
  $("#auth-form").onsubmit = (ev) => {
    ev.preventDefault();
    action(async () => {
      const f = Object.fromEntries(new FormData(ev.target));
      const result = signup
        ? await api.db.auth.signUp({
            email: f.email,
            password: f.password,
            options: { data: { name: f.name, phone: f.phone } },
          })
        : await api.db.auth.signInWithPassword({
            email: f.email,
            password: f.password,
          });
      if (result.error) throw result.error;
      if (signup && !result.data.session) {
        $("#auth-feedback").textContent =
          "Confira seu e-mail para confirmar a conta. Depois, faça login.";
        return;
      }
      await boot();
    });
  };
  enhance();
}
async function boot() {
  try {
    currentUser = await api.user();
    if (!currentUser) {
      if (!["login", "signup"].includes(currentPage)) {
        location.replace(pageUrl("login", { next: currentPage, ...(new URLSearchParams(location.search).get("draft") ? { draft: new URLSearchParams(location.search).get("draft") } : {}) }));
        return;
      }
      auth(currentPage === "signup");
      return;
    }
    if (["login", "signup"].includes(currentPage)) {
      // Apenas nomes conhecidos são aceitos como destino após o login.
      const next = new URLSearchParams(location.search).get("next");
      if (api.demo) { auth(currentPage === "signup"); return; }
      location.replace(pageUrl(next && !["login", "signup"].includes(next) && pages[next] ? next : "contacts", {
        ...(new URLSearchParams(location.search).get("draft") ? { draft: new URLSearchParams(location.search).get("draft") } : {}),
      }));
      return;
    }
    state = await api.load();
    avatarUrl = api.demo
      ? state.profile.avatar_path || ""
      : await api.signedUrl(state.profile.avatar_path);
    shell();
  } catch (err) {
    $("#app").innerHTML =
      `<div class="startup-error"><h1>Não foi possível carregar seu espaço.</h1><p>${e(err.message)}</p><p>Confira config.js e a instalação do banco conforme o guia.</p><button class="button secondary" id="retry">Tentar novamente</button></div>`;
    $("#retry").onclick = boot;
  }
}

if (api.db)
  api.db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && !["login", "signup"].includes(currentPage)) navigate("login");
  });
boot();

