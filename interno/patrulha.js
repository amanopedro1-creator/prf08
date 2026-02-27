const $ = (id) => document.getElementById(id);

const el = {
  unidade: $('patrulha-unidade'),
  unidadePreset: $('patrulhaUnidadePreset'),
  unidadeDropdown: $('patrulhaUnidadeDropdown'),
  unidadeDropdownBtn: $('patrulhaUnidadeDropdownBtn'),
  unidadeDropdownText: $('patrulhaUnidadeDropdownText'),
  unidadeDropdownMenu: $('patrulhaUnidadeDropdownMenu'),
  area: $('patrulha-area'),
  dataInicio: $('patrulha-data-inicio'),
  horaInicio: $('patrulha-hora-inicio'),
  dataTermino: $('patrulha-data-termino'),
  horaTermino: $('patrulha-hora-termino'),
  ocorrencias: $('patrulha-ocorrencias'),
  abordagens: $('patrulha-abordagens'),
  prisoes: $('patrulha-prisoes'),
  observacoes: $('patrulha-observacoes'),
  motorista: $('patrulha-motorista'),
  chefe: $('patrulha-chefe'),
  auxiliar1: $('patrulha-auxiliar-1'),
  auxiliar2: $('patrulha-auxiliar-2'),
  linksBou: $('patrulhaLinksBou'),
  linksAit: $('patrulhaLinksAit'),
  linksAluno: $('patrulhaLinksAluno'),
  btnEnviar: $('btnEnviarPatrulha'),
  btnLimpar: $('btnLimparPatrulha'),
  status: $('statusEntradaPatrulha')
};

const currentEditId = new URLSearchParams(window.location.search).get('edit');
const originalCounts = { ocorrencias: 0, abordagens: 0, prisoes: 0 };
const equipeConfig = {
  motorista: { allowNA: false, root: 'patrulhaMotoristaDropdown', btn: 'patrulhaMotoristaDropdownBtn', text: 'patrulhaMotoristaDropdownText', menu: 'patrulhaMotoristaDropdownMenu', input: 'patrulha-motorista' },
  chefe: { allowNA: false, root: 'patrulhaChefeDropdown', btn: 'patrulhaChefeDropdownBtn', text: 'patrulhaChefeDropdownText', menu: 'patrulhaChefeDropdownMenu', input: 'patrulha-chefe' },
  auxiliar1: { allowNA: true, root: 'patrulhaAuxiliar1Dropdown', btn: 'patrulhaAuxiliar1DropdownBtn', text: 'patrulhaAuxiliar1DropdownText', menu: 'patrulhaAuxiliar1DropdownMenu', input: 'patrulha-auxiliar-1' },
  auxiliar2: { allowNA: true, root: 'patrulhaAuxiliar2Dropdown', btn: 'patrulhaAuxiliar2DropdownBtn', text: 'patrulhaAuxiliar2DropdownText', menu: 'patrulhaAuxiliar2DropdownMenu', input: 'patrulha-auxiliar-2' }
};

const equipeOptions = { motorista: [], chefe: [], auxiliar1: [], auxiliar2: [] };
const relatedState = { bou: [], ait: [], aluno: [] };
const relatedView = {
  bou: { visible: 3, batch: 3, selected: new Set() },
  ait: { visible: 3, batch: 3, selected: new Set() },
  aluno: { visible: 3, batch: 3, selected: new Set() }
};
const relatedDays = { bou: 1, ait: 1, aluno: 5 };

function setStatus(msg, isError = false) {
  if (!el.status) return;
  el.status.textContent = msg || '';
  el.status.style.color = isError ? '#b42318' : '#166534';
}

function formatDatePt(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

function prefillDates() {
  if (currentEditId) return;
  const today = formatDatePt(new Date());
  if (el.dataInicio && !(el.dataInicio.value || '').trim()) el.dataInicio.value = today;
  if (el.dataTermino && !(el.dataTermino.value || '').trim()) el.dataTermino.value = today;
}

function getSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) return { client: null, user: null, error: 'Supabase nao disponivel na p?gina.' };
  const sessionResult = await client.auth.getSession();
  const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  const user = session ? session.user : null;
  return { client, user, error: user ? null : 'Usuario nao autenticado.' };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseCount(value) {
  const matches = String(value || '').match(/\d+/g);
  if (!matches || !matches.length) return 0;
  return matches
    .map((val) => Number(val))
    .filter((val) => Number.isFinite(val) && val >= 0)
    .reduce((sum, val) => sum + val, 0);
}

function randomKm() {
  return Math.floor(Math.random() * 21) + 60;
}

function parseRowPayload(row) {
  try {
    if (!row || !row.conteudo_completo) return {};
    if (typeof row.conteudo_completo === 'object' && row.conteudo_completo) return row.conteudo_completo;
    const parsed = JSON.parse(String(row.conteudo_completo));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function getRowDateMs(row) {
  const raw = row && (row.created_at || row.data_criacao) ? (row.created_at || row.data_criacao) : null;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isWithinDays(row, days) {
  const ms = getRowDateMs(row);
  if (!ms) return false;
  const now = Date.now();
  const limit = days * 24 * 60 * 60 * 1000;
  return (now - ms) <= limit && now >= ms;
}


function formatEquipeOption(profile) {
  const nome = profile && profile.nome_guerra ? String(profile.nome_guerra).trim() : '';
  const rg = profile && profile.rg ? String(profile.rg).trim() : '';
  if (nome && rg) return `${nome} - ${rg}`;
  return nome || rg || '';
}

function ui(field) {
  const cfg = equipeConfig[field];
  return {
    cfg,
    root: $(cfg.root),
    btn: $(cfg.btn),
    text: $(cfg.text),
    menu: $(cfg.menu),
    input: $(cfg.input)
  };
}

function closeAllDropdowns(except = '') {
  ['motorista', 'chefe', 'auxiliar1', 'auxiliar2'].forEach((field) => {
    if (field === except) return;
    const x = ui(field);
    if (!x.root || !x.btn) return;
    x.root.classList.remove('is-open');
    x.btn.setAttribute('aria-expanded', 'false');
  });
}

function applySelection(field, value, label) {
  const x = ui(field);
  if (!x.input || !x.text || !x.menu) return;
  const safe = (value || '').trim();
  x.input.value = safe;
  x.text.textContent = safe ? (label || safe) : 'Selecionar policial...';
  x.menu.querySelectorAll('.bou-dd-item[data-equipe]').forEach((node) => {
    const selected = (node.getAttribute('data-equipe') || '') === safe;
    node.classList.toggle('is-selected', selected);
    const input = node.querySelector('input[type="checkbox"]');
    const icon = node.querySelector('i');
    if (input) input.checked = selected;
    if (icon) icon.classList.toggle('is-hidden', !selected);
  });
}

function renderDropdown(field) {
  const x = ui(field);
  if (!x.menu) return;
  const list = Array.from(new Set((equipeOptions[field] || []).map((v) => (v || '').trim()).filter(Boolean)));
  const current = x.input ? (x.input.value || '').trim() : '';
  x.menu.innerHTML = '';

  if (x.cfg.allowNA) {
    const na = document.createElement('button');
    na.type = 'button';
    na.className = `bou-dd-item tone-e voo-dd-check-item${current === 'N/A' ? ' is-selected' : ''}`;
    na.setAttribute('data-equipe', 'N/A');
    na.innerHTML = '<span class="voo-dd-check-left"><input type="checkbox" tabindex="-1" ' + (current === 'N/A' ? 'checked' : '') + '><span>N/A</span></span><i class="fas fa-check' + (current === 'N/A' ? '' : ' is-hidden') + '"></i>';
    x.menu.appendChild(na);
    if (list.length) {
      const sep = document.createElement('div');
      sep.className = 'bou-dd-sep';
      x.menu.appendChild(sep);
    }
  }

  list.forEach((value, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `bou-dd-item ${idx % 2 === 0 ? 'tone-a' : 'tone-b'} voo-dd-check-item${current === value ? ' is-selected' : ''}`;
    item.setAttribute('data-equipe', value);
    item.innerHTML = `<span class="voo-dd-check-left"><input type="checkbox" tabindex="-1" ${current === value ? 'checked' : ''}><span>${value}</span></span><i class="fas fa-check${current === value ? '' : ' is-hidden'}"></i>`;
    x.menu.appendChild(item);
  });

  const fallback = x.cfg.allowNA ? 'N/A' : '';
  applySelection(field, current || fallback, current || fallback || 'Selecionar policial...');
}

function setupDropdown(field) {
  const x = ui(field);
  if (!x.root || !x.btn || !x.menu || !x.input) return;

  x.btn.addEventListener('click', () => {
    const open = x.root.classList.contains('is-open');
    closeAllDropdowns(field);
    x.root.classList.toggle('is-open', !open);
    x.btn.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  x.menu.addEventListener('click', (event) => {
    const item = event.target.closest('.bou-dd-item[data-equipe]');
    if (!item) return;
    const value = item.getAttribute('data-equipe') || '';
    const label = (item.querySelector('span') ? item.querySelector('span').textContent : value) || value;
    applySelection(field, value, label);
    x.root.classList.remove('is-open');
    x.btn.setAttribute('aria-expanded', 'false');
  });
}

function applyUnidadeSelection(value, labelText) {
  if (!el.unidadePreset) return;
  const safe = (value || '').trim();
  el.unidadePreset.value = safe;
  if (el.unidadeDropdownText) el.unidadeDropdownText.textContent = labelText || 'Selecionar unidade...';
  if (el.unidade) el.unidade.value = safe;
  document.querySelectorAll('#patrulhaUnidadeDropdownMenu .bou-dd-item[data-unidade]').forEach((node) => {
    const isSelected = (node.getAttribute('data-unidade') || '') === safe;
    node.classList.toggle('is-selected', isSelected);
  });
}

function setupUnidadeDropdown() {
  if (!el.unidadeDropdown || !el.unidadeDropdownBtn || !el.unidadeDropdownMenu) return;

  const setOpen = (open) => {
    el.unidadeDropdown.classList.toggle('is-open', open);
    el.unidadeDropdownBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  el.unidadeDropdownBtn.addEventListener('click', () => {
    const isOpen = el.unidadeDropdown.classList.contains('is-open');
    setOpen(!isOpen);
  });

  el.unidadeDropdownMenu.addEventListener('click', (event) => {
    const item = event.target.closest('.bou-dd-item[data-unidade]');
    if (!item) return;
    const value = item.getAttribute('data-unidade') || '';
    const labelText = (item.querySelector('span') ? item.querySelector('span').textContent : value) || value;
    applyUnidadeSelection(value, labelText);
    setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!el.unidadeDropdown.contains(event.target)) setOpen(false);
  });
}

function syncManualUnidade() {
  if (!el.unidade || !el.unidadePreset || !el.unidadeDropdownText) return;
  const typed = (el.unidade.value || '').trim();
  const selected = (el.unidadePreset.value || '').trim();
  if (!typed) {
    el.unidadePreset.value = '';
    el.unidadeDropdownText.textContent = 'Selecionar unidade...';
    document.querySelectorAll('#patrulhaUnidadeDropdownMenu .bou-dd-item[data-unidade]').forEach((node) => {
      node.classList.remove('is-selected');
    });
    return;
  }
  if (typed === selected) return;
  el.unidadePreset.value = '';
  el.unidadeDropdownText.textContent = 'Selecionar unidade...';
  document.querySelectorAll('#patrulhaUnidadeDropdownMenu .bou-dd-item[data-unidade]').forEach((node) => {
    node.classList.remove('is-selected');
  });
}

function getMentionTokens(profile, user) {
  const tokens = [
    profile && profile.nome_guerra ? profile.nome_guerra : '',
    profile && profile.rg ? profile.rg : '',
    user && user.email ? user.email : ''
  ]
    .map(normalizeText)
    .filter((t) => t && t.length >= 3);

  const parts = String(profile && profile.nome_guerra ? profile.nome_guerra : '')
    .split(' ')
    .map(normalizeText)
    .filter((t) => t && t.length >= 4);

  return Array.from(new Set(tokens.concat(parts)));
}

function hasMention(row, tokens) {
  if (!row || !tokens.length) return false;
  const source = normalizeText([
    row.conteudo_completo,
    row.texto,
    row.observacoes,
    row.detalhes,
    row.titulo,
    row.subtitulo,
    row.infrator,
    row.numero_ait
  ].join(' '));
  return tokens.some((token) => source.includes(token));
}

function buildLinkUrl(type, row) {
  if (type === 'bou') return row && row.id ? ('/interno/bou.html?edit=' + row.id) : '/interno/bou-envios.html';
  if (type === 'ait') return row && row.id ? ('/interno/ait.html?edit=' + row.id) : '/interno/ait.html';
  return row && row.id ? ('/interno/relatorio-aluno.html?ref=' + row.id) : '/interno/relatorio-aluno.html';
}

function getCardTitle(type, item, payload) {
  const campos = payload && payload.campos ? payload.campos : {};
  if (type === 'bou') return campos.titulo || item.titulo || ('BOU #' + item.id);
  if (type === 'ait') return 'AIT ' + (campos.numero_ait || item.numero_ait || ('#' + item.id));
  return item.titulo || ('Relatório aluno #' + item.id);
}

function getCardSuspect(type, item, payload) {
  const campos = payload && payload.campos ? payload.campos : {};
  let nome = 'N/A';
  let rg = 'N/A';
  if (type === 'bou') {
    nome = (campos.nome_acusado || '').trim() || 'N/A';
    rg = (campos.rg_acusado || '').trim() || 'N/A';
  } else if (type === 'ait') {
    nome = (campos.nome_infrator || item.infrator || '').trim() || 'N/A';
    rg = (campos.rg_infrator || '').trim() || 'N/A';
  } else {
    nome = (campos.nome_acusado || campos.nome_infrator || '').trim() || 'N/A';
    rg = (campos.rg_acusado || campos.rg_infrator || '').trim() || 'N/A';
  }
  return nome + ' - ' + rg;
}

function renderRelatedList(type, container, items) {
  if (!container) return;
  const view = relatedView[type];
  if (!view) return;
  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = '<div class="approvals-empty">Nenhum registro recente disponível.</div>';
    return;
  }

  const totalVisible = Math.min(view.visible, items.length);
  const visibleItems = items.slice(0, totalVisible);
  container.innerHTML = visibleItems.map((item) => {
    const checked = view.selected.has(String(item.id)) ? 'checked' : '';
    const payload = parseRowPayload(item);
    const title = getCardTitle(type, item, payload);
    const suspect = getCardSuspect(type, item, payload);
    const whenRaw = item.created_at || item.data_criacao || '';
    const when = whenRaw ? new Date(whenRaw).toLocaleString('pt-BR') : '-';
    const href = buildLinkUrl(type, item);

    return '<label class="patrulha-link-item">' +
      '<input type="checkbox" data-link-type="' + type + '" value="' + String(item.id) + '" ' + checked + '>' +
      '<span class="patrulha-link-main">' +
        '<strong>' + escapeHtml(title) + '</strong>' +
        '<small>' + escapeHtml(when) + '</small>' +
        '<span class="patrulha-link-suspect">' + escapeHtml(suspect) + '</span>' +
        '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">Abrir</a>' +
      '</span>' +
    '</label>';
  }).join('');

  container.querySelectorAll('input[data-link-type="' + type + '"]').forEach((node) => {
    node.addEventListener('change', () => {
      const id = String(node.value || '').trim();
      if (!id) return;
      if (node.checked) view.selected.add(id);
      else view.selected.delete(id);
    });
  });
}

function collectSelectedLinks() {
  const pick = (type) => Array.from((relatedView[type] && relatedView[type].selected) ? relatedView[type].selected : []).filter(Boolean);
  return {
    bou_ids: pick('bou'),
    ait_ids: pick('ait'),
    relatorio_aluno_ids: pick('aluno')
  };
}

function setupRelatedInfiniteScroll(type, container) {
  if (!container) return;
  container.addEventListener('scroll', () => {
    const items = relatedState[type] || [];
    const view = relatedView[type];
    if (!items.length || !view || view.visible >= items.length) return;
    const nearBottom = (container.scrollTop + container.clientHeight) >= (container.scrollHeight - 20);
    if (!nearBottom) return;
    view.visible = Math.min(view.visible + view.batch, items.length);
    renderRelatedList(type, container, items);
  });
}

async function loadRelatedRecords(prefilled) {
  const { client, user } = await getCurrentUser();
  if (!client || !user) return;

  const selected = {
    bou: (prefilled && prefilled.bou_ids ? prefilled.bou_ids : []).map(String),
    ait: (prefilled && prefilled.ait_ids ? prefilled.ait_ids : []).map(String),
    aluno: (prefilled && prefilled.relatorio_aluno_ids ? prefilled.relatorio_aluno_ids : []).map(String)
  };
  relatedView.bou.selected = new Set(selected.bou);
  relatedView.ait.selected = new Set(selected.ait);
  relatedView.aluno.selected = new Set(selected.aluno);
  relatedView.bou.visible = 3;
  relatedView.ait.visible = 3;
  relatedView.aluno.visible = 3;

  let profile = null;
  const profileResult = await client.from('profiles').select('nome_guerra, rg').eq('id', user.id).maybeSingle();
  if (!profileResult.error) profile = profileResult.data || null;
  const tokens = getMentionTokens(profile, user);

  const fetchRecent = async (table, fields, fallbackOrderField) => {
    let q = await client.from(table).select(fields).order('created_at', { ascending: false }).limit(120);
    if (q.error && fallbackOrderField) {
      q = await client.from(table).select(fields).order(fallbackOrderField, { ascending: false }).limit(120);
    }
    if (q.error || !Array.isArray(q.data)) return [];
    return q.data;
  };

  const fetchRecentBous = async () => {
    const rpc = await client.rpc('list_recent_bous_for_user', { p_days: relatedDays.bou });
    if (!rpc.error && Array.isArray(rpc.data)) return rpc.data;
    return fetchRecent('bous', 'id,user_id,titulo,conteudo_completo,created_at,data_criacao,sent_to_discord_at', 'data_criacao');
  };

  const fetchRecentAits = async () => {
    const rpc = await client.rpc('list_recent_aits_for_user', { p_days: relatedDays.ait });
    if (!rpc.error && Array.isArray(rpc.data)) return rpc.data;
    return fetchRecent('aits', 'id,user_id,numero_ait,infrator,conteudo_completo,created_at,data_criacao', 'data_criacao');
  };

  const fetchRecentAluno = async () => {
    const rpc = await client.rpc('list_recent_relatorios_aluno_for_user', { p_days: relatedDays.aluno });
    if (!rpc.error && Array.isArray(rpc.data)) return rpc.data;

    const principal = await fetchRecent('relatorios_aluno', 'id,user_id,titulo,texto,detalhes,conteudo_completo,created_at', null);
    if (Array.isArray(principal) && principal.length) return principal;
    return fetchRecent('relatorio_aluno', 'id,user_id,titulo,texto,detalhes,conteudo_completo,created_at', null);
  };

  const bouRows = await fetchRecentBous();
  const aitRows = await fetchRecentAits();
  const alunoRows = await fetchRecentAluno();

  relatedState.bou = bouRows
    .filter((row) => Boolean(row.sent_to_discord_at))
    .filter((row) => (String(row.user_id || '') === String(user.id) || hasMention(row, tokens)) && isWithinDays(row, relatedDays.bou))
    .slice(0, 60);
  relatedState.ait = aitRows
    .filter((row) => (String(row.user_id || '') === String(user.id) || hasMention(row, tokens)) && isWithinDays(row, relatedDays.ait))
    .slice(0, 60);
  relatedState.aluno = alunoRows
    .filter((row) => (String(row.user_id || '') === String(user.id) || hasMention(row, tokens)) && isWithinDays(row, relatedDays.aluno))
    .slice(0, 60);

  renderRelatedList('bou', el.linksBou, relatedState.bou);
  renderRelatedList('ait', el.linksAit, relatedState.ait);
  renderRelatedList('aluno', el.linksAluno, relatedState.aluno);
}

async function loadEquipeOptions() {
  const { client, user } = await getCurrentUser();
  if (!client || !user) return;

  let labels = [];
  const result = await client.from('profiles').select('nome_guerra, rg').eq('aprovado', true).order('nome_guerra', { ascending: true });
  if (!result.error && Array.isArray(result.data)) {
    labels = result.data.map(formatEquipeOption).filter(Boolean);
  }

  ['motorista', 'chefe', 'auxiliar1', 'auxiliar2'].forEach((field) => {
    equipeOptions[field] = labels.slice();
    const x = ui(field);
    if (x.input && !x.input.value && x.cfg.allowNA) x.input.value = 'N/A';
    renderDropdown(field);
  });
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPayload() {
  const links = collectSelectedLinks();
  const campos = {
    unidade: (el.unidade.value || '').trim(),
    area: (el.area.value || '').trim(),
    data_inicio: (el.dataInicio.value || '').trim(),
    hora_inicio: (el.horaInicio.value || '').trim(),
    data_termino: (el.dataTermino.value || '').trim(),
    hora_termino: (el.horaTermino.value || '').trim(),
    ocorrencias: (el.ocorrencias.value || '').trim(),
    abordagens: (el.abordagens.value || '').trim(),
    prisoes: (el.prisoes.value || '').trim(),
    observacoes: (el.observacoes.value || '').trim(),
    motorista: (el.motorista.value || '').trim(),
    chefe: (el.chefe.value || '').trim(),
    auxiliar_1: (el.auxiliar1.value || '').trim(),
    auxiliar_2: (el.auxiliar2.value || '').trim(),
    links: links
  };

  const titulo = `Relatório de Patrulha - ${campos.unidade || 'Unidade não informada'}`;
  const texto = [
    '# RELATORIO DE PATRULHA',
    '',
    '# Dados do patrulhamento',
    '',
    `Unidade: ${campos.unidade || 'N/A'}`,
    `Área de patrulhamento: ${campos.area || 'N/A'}`,
    `Data de início: ${campos.data_inicio || 'N/A'}`,
    `Hora de início: ${campos.hora_inicio || 'N/A'}`,
    `Data de término: ${campos.data_termino || 'N/A'}`,
    `Hora de término: ${campos.hora_termino || 'N/A'}`,
    '',
    '# Dados da equipe',
    '',
    `Motorista: ${campos.motorista || 'N/A'}`,
    `Chefe de viatura: ${campos.chefe || 'N/A'}`,
    `Auxiliar 1: ${campos.auxiliar_1 || 'N/A'}`,
    `Auxiliar 2: ${campos.auxiliar_2 || 'N/A'}`,
    '',
    '# Atuação',
    '',
    `Ocorrências atendidas: ${campos.ocorrencias || 'N/A'}`,
    `Abordagens realizadas: ${campos.abordagens || 'N/A'}`,
    `Prisões efetuadas: ${campos.prisoes || 'N/A'}`,
    `Vínculos BOU: ${(links.bou_ids || []).join(', ') || 'N/A'}`,
    `Vínculos AIT: ${(links.ait_ids || []).join(', ') || 'N/A'}`,
    `Vínculos Relatório Aluno: ${(links.relatorio_aluno_ids || []).join(', ') || 'N/A'}`,
    `Observações: ${campos.observacoes || 'N/A'}`
  ].join('\n');

  return {
    titulo,
    area: campos.area,
    observacoes: campos.observacoes,
    conteudo_completo: JSON.stringify({ texto_original: texto, data_envio: new Date().toISOString(), campos })
  };
}

async function savePatrulha(payload) {
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) throw new Error(error || 'Sem sessao valida para salvar relatorio.');

  if (currentEditId) {
    const result = await client
      .from('patrulhas')
      .update(payload)
      .eq('id', Number(currentEditId))
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (result.error) throw new Error('Falha ao atualizar relatório: ' + result.error.message);
    if (!result.data) throw new Error('Relatório não encontrado para edição ou sem permissão.');
    return { client, id: result.data.id };
  }

  const result = await client
    .from('patrulhas')
    .insert({ user_id: user.id, ...payload })
    .select('id')
    .single();
  if (result.error) throw new Error('Falha ao salvar relatório: ' + result.error.message);
  return { client, id: result.data.id };
}

async function sendPatrulhaWebhook(client, id) {
  const rpc = await client.rpc('send_patrulha_to_discord', { p_patrulha_ids: [Number(id)] });
  if (rpc.error) {
    throw new Error('Relatório salvo no banco, mas falhou no envio ao Discord: ' + rpc.error.message);
  }
}

async function submitPatrulha() {
  try {
    setStatus('Salvando relatório...');
    const payload = buildPayload();
    if (!payload.area) {
      setStatus('Preencha a área de patrulhamento.', true);
      return;
    }

    const result = await savePatrulha(payload);
    setStatus('Relatório salvo no banco. Enviando para Discord...');
    await sendPatrulhaWebhook(result.client, result.id);
    const ocorrencias = parseCount(el.ocorrencias ? el.ocorrencias.value : '');
    const abordagens = parseCount(el.abordagens ? el.abordagens.value : '');
    const prisoes = parseCount(el.prisoes ? el.prisoes.value : '');
    const km = currentEditId ? 0 : randomKm();
    const deltas = {
      ocorrencias: currentEditId ? (ocorrencias - originalCounts.ocorrencias) : ocorrencias,
      abordagens: currentEditId ? (abordagens - originalCounts.abordagens) : abordagens,
      prisoes: currentEditId ? (prisoes - originalCounts.prisoes) : prisoes,
      km
    };

    if (typeof window.incrementPatrulhaTotals === 'function') {
      window.incrementPatrulhaTotals(deltas);
    }

    if (currentEditId) {
      originalCounts.ocorrencias = ocorrencias;
      originalCounts.abordagens = abordagens;
      originalCounts.prisoes = prisoes;
    }
    setStatus(currentEditId ? `Relatório #${result.id} atualizado e enviado ao Discord.` : `Relatório #${result.id} salvo e enviado ao Discord.`);
  } catch (e) {
    setStatus(e.message || 'Falha ao enviar relatório.', true);
  }
}

function clearForm() {
  ['unidade', 'area', 'dataInicio', 'horaInicio', 'dataTermino', 'horaTermino', 'ocorrencias', 'abordagens', 'prisoes', 'observacoes'].forEach((key) => {
    if (el[key]) el[key].value = '';
  });

  applyUnidadeSelection('', 'Selecionar unidade...');
  if (el.motorista) el.motorista.value = '';
  if (el.chefe) el.chefe.value = '';
  if (el.auxiliar1) el.auxiliar1.value = 'N/A';
  if (el.auxiliar2) el.auxiliar2.value = 'N/A';

  renderDropdown('motorista');
  renderDropdown('chefe');
  renderDropdown('auxiliar1');
  renderDropdown('auxiliar2');

  relatedView.bou.selected.clear();
  relatedView.ait.selected.clear();
  relatedView.aluno.selected.clear();
  renderRelatedList('bou', el.linksBou, relatedState.bou);
  renderRelatedList('ait', el.linksAit, relatedState.ait);
  renderRelatedList('aluno', el.linksAluno, relatedState.aluno);
  setStatus('Campos limpos.');
}

async function applyPayloadToFields(payload) {
  if (!payload || !payload.campos) return;
  const c = payload.campos;
  if (el.unidade) el.unidade.value = c.unidade || '';
  if (c.unidade) applyUnidadeSelection(c.unidade, c.unidade);
  if (el.area) el.area.value = c.area || '';
  if (el.dataInicio) el.dataInicio.value = c.data_inicio || '';
  if (el.horaInicio) el.horaInicio.value = c.hora_inicio || '';
  if (el.dataTermino) el.dataTermino.value = c.data_termino || '';
  if (el.horaTermino) el.horaTermino.value = c.hora_termino || '';
  if (el.ocorrencias) el.ocorrencias.value = c.ocorrencias || c['ocorr?ncias'] || '';
  if (el.abordagens) el.abordagens.value = c.abordagens || '';
  if (el.prisoes) el.prisoes.value = c.prisoes || '';
  if (el.observacoes) el.observacoes.value = c.observacoes || '';

  if (el.motorista) el.motorista.value = c.motorista || '';
  if (el.chefe) el.chefe.value = c.chefe || '';
  if (el.auxiliar1) el.auxiliar1.value = c.auxiliar_1 || 'N/A';
  if (el.auxiliar2) el.auxiliar2.value = c.auxiliar_2 || 'N/A';

  renderDropdown('motorista');
  renderDropdown('chefe');
  renderDropdown('auxiliar1');
  renderDropdown('auxiliar2');

  originalCounts.ocorrencias = parseCount(c.ocorrencias || '');
  originalCounts.abordagens = parseCount(c.abordagens || '');
  originalCounts.prisoes = parseCount(c.prisoes || '');

  await loadRelatedRecords(c.links || {});
}

async function loadForEdit() {
  if (!currentEditId) return;
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) {
    setStatus(error || 'Sessao invalida para carregar edicao.', true);
    return;
  }

  const result = await client
    .from('patrulhas')
    .select('id,user_id,conteudo_completo')
    .eq('id', Number(currentEditId))
    .eq('user_id', user.id)
    .maybeSingle();

  if (result.error || !result.data) {
    setStatus('Nao foi possivel carregar este relatorio para edicao.', true);
    return;
  }

  let payload = null;
  try {
    payload = result.data.conteudo_completo ? JSON.parse(result.data.conteudo_completo) : null;
  } catch (e) {
    payload = null;
  }

  if (payload) await applyPayloadToFields(payload);
  if (el.btnEnviar) el.btnEnviar.textContent = 'Atualizar relatório';
  setStatus(`Editando relatório #${currentEditId}. Atualize e envie novamente.`);
}

document.addEventListener('DOMContentLoaded', async () => {
  ['motorista', 'chefe', 'auxiliar1', 'auxiliar2'].forEach((field) => setupDropdown(field));
  setupUnidadeDropdown();
  applyUnidadeSelection('', 'Selecionar unidade...');

  document.addEventListener('click', (event) => {
    const inside = event.target.closest('.equipe-dropdown');
    if (!inside) closeAllDropdowns();
  });

  if (el.btnEnviar) el.btnEnviar.addEventListener('click', submitPatrulha);
  if (el.btnLimpar) el.btnLimpar.addEventListener('click', clearForm);
  if (el.unidade) el.unidade.addEventListener('input', syncManualUnidade);
  setupRelatedInfiniteScroll('bou', el.linksBou);
  setupRelatedInfiniteScroll('ait', el.linksAit);
  setupRelatedInfiniteScroll('aluno', el.linksAluno);

  setStatus('Pronto para enviar.');
  prefillDates();
  await loadEquipeOptions();
  await loadRelatedRecords({});
  await loadForEdit();
});
