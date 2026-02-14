const $ = (id) => document.getElementById(id);

const el = {
  numeroAit: $("numeroAit"),
  policial: $("policial"),
  nomeInfrator: $("nomeInfrator"),
  rgInfrator: $("rgInfrator"),
  infracao: $("infracao"),
  valorMulta: $("valorMulta"),
  apreensao: $("apreensao"),
  datahora: $("datahora"),
  local: $("local"),
  marcaModelo: $("marcaModelo"),
  emplacamento: $("emplacamento"),
  btnEnviarAit: $("btnEnviarAit"),
  btnLimparCampos: $("btnLimparCampos"),
  statusEntradaAit: $("statusEntradaAit")
};

const currentEditId = new URLSearchParams(window.location.search).get("edit");

function setStatus(msg, isError = false) {
  if (!el.statusEntradaAit) return;
  el.statusEntradaAit.textContent = msg;
  el.statusEntradaAit.style.color = isError ? "#b42318" : "#166534";
}

function getSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) return { client: null, user: null, error: "Supabase não disponível na página." };
  const sessionResult = await client.auth.getSession();
  const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  const user = session ? session.user : null;
  return { client, user, error: user ? null : "Usuário não autenticado." };
}

function v(inputEl, fallback = "") {
  if (!inputEl) return fallback;
  const value = (inputEl.value || "").trim();
  return value || fallback;
}

function formatDatePt(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatDateTimePt(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = formatDatePt(d);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} ${hours}:${minutes}`;
}

function prefillDataHora() {
  if (currentEditId) return;
  if (!el.datahora) return;
  if ((el.datahora.value || "").trim()) return;
  el.datahora.value = formatDateTimePt(new Date());
}

async function preencherPolicialResponsavel() {
  if (!el.policial) return;
  const { client, user } = await getCurrentUser();
  if (!client || !user) return;

  try {
    const profileResult = await client
      .from("profiles")
      .select("nome_guerra, rg")
      .eq("id", user.id)
      .maybeSingle();

    const nome = profileResult && profileResult.data && profileResult.data.nome_guerra
      ? String(profileResult.data.nome_guerra).trim()
      : "";
    const rg = profileResult && profileResult.data && profileResult.data.rg
      ? String(profileResult.data.rg).trim()
      : "";
    const fallback = user.email ? String(user.email).trim() : "Usuário";

    if (nome && rg) el.policial.value = `${nome} - ${rg}`;
    else if (nome) el.policial.value = nome;
    else if (rg) el.policial.value = `RG: ${rg}`;
    else el.policial.value = fallback;
  } catch {
    /* ignore */
  }
}

function buildPayload() {
  return {
    texto_original: [
      "# AUTO DE INFRAÇÃO DE TRÂNSITO - AIT",
      "",
      `Número do AIT: ${v(el.numeroAit, "N/A")}`,
      `Policial responsável: ${v(el.policial, "N/A")}`,
      `Nome do Infrator: ${v(el.nomeInfrator, "N/A")}`,
      `RG do Infrator: ${v(el.rgInfrator, "N/A")}`,
      "",
      "# Dados da infração",
      "",
      `Infrações cometidas: ${v(el.infracao, "N/A")}`,
      `Valor da multa em R$: ${v(el.valorMulta, "N/A")}`,
      `Houve apreensão do veículo?: ${v(el.apreensao, "N/A")}`,
      `Data e horário: ${v(el.datahora, "N/A")}`,
      `Local de Autuação: ${v(el.local, "N/A")}`,
      `Marca e modelo do veículo: ${v(el.marcaModelo, "N/A")}`,
      `Emplacamento: ${v(el.emplacamento, "N/A")}`
    ].join("\n"),
    data_envio: new Date().toISOString(),
    campos: {
      numero_ait: v(el.numeroAit),
      policial_responsavel: v(el.policial),
      nome_infrator: v(el.nomeInfrator),
      rg_infrator: v(el.rgInfrator),
      infracoes: v(el.infracao),
      valor_multa: v(el.valorMulta),
      apreensao_veiculo: v(el.apreensao),
      datahora: v(el.datahora),
      local_autuacao: v(el.local),
      marca_modelo: v(el.marcaModelo),
      emplacamento: v(el.emplacamento)
    }
  };
}

async function salvarAitNoBanco(payload) {
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) {
    throw new Error(error || "Sem sessão válida para salvar AIT.");
  }

  const numeroAit = payload && payload.campos && payload.campos.numero_ait
    ? payload.campos.numero_ait
    : "AIT sem número";
  const infrator = payload && payload.campos && payload.campos.nome_infrator
    ? payload.campos.nome_infrator
    : "N/A";
  const conteudo = JSON.stringify(payload || {});

  if (currentEditId) {
    const result = await client
      .from("aits")
      .update({ numero_ait: numeroAit, infrator, conteudo_completo: conteudo })
      .eq("id", Number(currentEditId))
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (result.error) throw new Error(`Falha ao atualizar AIT: ${result.error.message}`);
    if (!result.data) throw new Error("AIT não encontrado para edição ou sem permissão.");
    return result.data.id;
  }

  const insertResult = await client
    .from("aits")
    .insert({ user_id: user.id, numero_ait: numeroAit, infrator, conteudo_completo: conteudo })
    .select("id")
    .single();
  if (insertResult.error) throw new Error(`Falha ao salvar AIT: ${insertResult.error.message}`);
  return insertResult.data.id;
}

async function enviarAitParaDiscord(client, aitId) {
  const rpc = await client.rpc("send_ait_to_discord", { p_ait_ids: [Number(aitId)] });
  if (rpc.error) {
    throw new Error(`AIT salvo no banco, mas falhou no envio ao Discord: ${rpc.error.message}`);
  }
}

async function enviarAit() {
  const numero = v(el.numeroAit);
  const infracao = v(el.infracao);
  const nomeInfrator = v(el.nomeInfrator);
  if (!numero || !infracao || !nomeInfrator) {
    setStatus("Preencha ao menos Número do AIT, Nome do Infrator e Infrações.", true);
    return;
  }

  setStatus("Salvando AIT...");
  const payload = buildPayload();
  try {
    const { client } = await getCurrentUser();
    const aitId = await salvarAitNoBanco(payload);
    setStatus("AIT salvo no banco. Enviando para Discord...");
    await enviarAitParaDiscord(client, aitId);
    setStatus(currentEditId ? `AIT #${aitId} atualizado e enviado ao Discord.` : `AIT #${aitId} salvo e enviado ao Discord.`);
  } catch (err) {
    setStatus(err.message || "Falha ao enviar AIT.", true);
  }
}

async function carregarAitParaEdicao() {
  if (!currentEditId) return;
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) {
    setStatus(error || "Sessão inválida para carregar edição.", true);
    return;
  }

  const result = await client
    .from("aits")
    .select("id, user_id, conteudo_completo, numero_ait, infrator")
    .eq("id", Number(currentEditId))
    .eq("user_id", user.id)
    .maybeSingle();

  if (result.error || !result.data) {
    setStatus("Não foi possível carregar este AIT para edição.", true);
    return;
  }

  let payload = null;
  try {
    payload = result.data.conteudo_completo ? JSON.parse(result.data.conteudo_completo) : null;
  } catch {
    payload = null;
  }

  const campos = payload && payload.campos ? payload.campos : null;
  if (campos) {
    if (el.numeroAit) el.numeroAit.value = campos.numero_ait || result.data.numero_ait || "";
    if (el.nomeInfrator) el.nomeInfrator.value = campos.nome_infrator || result.data.infrator || "";
    if (el.rgInfrator) el.rgInfrator.value = campos.rg_infrator || "";
    if (el.infracao) el.infracao.value = campos.infracoes || "";
    if (el.valorMulta) el.valorMulta.value = campos.valor_multa || "";
    if (el.apreensao) el.apreensao.value = campos.apreensao_veiculo || "";
    if (el.datahora) el.datahora.value = campos.datahora || "";
    if (el.local) el.local.value = campos.local_autuacao || "";
    if (el.marcaModelo) el.marcaModelo.value = campos.marca_modelo || "";
    if (el.emplacamento) el.emplacamento.value = campos.emplacamento || "";
  }

  if (el.btnEnviarAit) el.btnEnviarAit.textContent = "Atualizar AIT";
  setStatus(`Editando AIT #${currentEditId}. Atualize e envie novamente.`);
}

function limparCampos() {
  const ids = [
    "numeroAit", "nomeInfrator", "rgInfrator", "infracao", "valorMulta",
    "apreensao", "datahora", "local", "marcaModelo", "emplacamento"
  ];

  ids.forEach((id) => {
    const node = $(id);
    if (!node) return;
    node.value = "";
  });

  preencherPolicialResponsavel();
  setStatus("Campos limpos.");
}

if (el.btnEnviarAit) el.btnEnviarAit.addEventListener("click", enviarAit);
if (el.btnLimparCampos) el.btnLimparCampos.addEventListener("click", limparCampos);

setStatus("Pronto para enviar.");
preencherPolicialResponsavel();
prefillDataHora();
carregarAitParaEdicao();
