const $ = (id) => document.getElementById(id);

const el = {
  titulo: $('titulo'),
  unidade: $('unidade'),
  unidadePreset: $('unidadePreset'),
  unidadeDropdown: $('unidadeDropdown'),
  unidadeDropdownBtn: $('unidadeDropdownBtn'),
  unidadeDropdownText: $('unidadeDropdownText'),
  unidadeDropdownMenu: $('unidadeDropdownMenu'),
  motoristaDropdown: $('motoristaDropdown'),
  motoristaDropdownBtn: $('motoristaDropdownBtn'),
  motoristaDropdownText: $('motoristaDropdownText'),
  motoristaDropdownMenu: $('motoristaDropdownMenu'),
  chefeDropdown: $('chefeDropdown'),
  chefeDropdownBtn: $('chefeDropdownBtn'),
  chefeDropdownText: $('chefeDropdownText'),
  chefeDropdownMenu: $('chefeDropdownMenu'),
  terceiroDropdown: $('terceiroDropdown'),
  terceiroDropdownBtn: $('terceiroDropdownBtn'),
  terceiroDropdownText: $('terceiroDropdownText'),
  terceiroDropdownMenu: $('terceiroDropdownMenu'),
  quartoDropdown: $('quartoDropdown'),
  quartoDropdownBtn: $('quartoDropdownBtn'),
  quartoDropdownText: $('quartoDropdownText'),
  quartoDropdownMenu: $('quartoDropdownMenu'),
  resultadoDropdown: $('resultadoDropdown'),
  resultadoDropdownBtn: $('resultadoDropdownBtn'),
  resultadoDropdownText: $('resultadoDropdownText'),
  resultadoDropdownMenu: $('resultadoDropdownMenu'),
  motorista: $('motorista'),
  chefe: $('chefe'),
  terceiro: $('terceiro'),
  quarto: $('quarto'),
  nomeAcusado: $('nomeAcusado'),
  rgAcusado: $('rgAcusado'),
  natureza: $('natureza'),
  nomeAcusado2: $('nomeAcusado2'),
  rgAcusado2: $('rgAcusado2'),
  natureza2: $('natureza2'),
  datahora: $('datahora'),
  local: $('local'),
  relato: $('relato'),
  envolvidos: $('envolvidos'),
  acoesMultiplas: $('acoesMultiplas'),
  acoesObservacoes: $('acoesObservacoes'),
  acoes: $('acoes'),
  resultado: $('resultado'),
  material: $('material'),
  veiculo: $('veiculo'),
  corVeiculo: $('corVeiculo'),
  assinatura: $('assinatura'),
  saida: $('saidaFormatada'),
  status: $('status'),
  entradaCompleta: $('entradaBouCompleto'),
  statusEntradaCompleta: $('statusEntradaCompleta'),
  btnGerar: $('btnGerar'),
  btnCopiar: $('btnCopiar'),
  btnLimparSaida: $('btnLimparSaida'),
  btnLimparCampos: $('btnLimparCampos'),
  btnChatgpt: $('btnChatgpt'),
  btnToggleAcusado2: $('btnToggleAcusado2'),
  acusadoExtra: $('acusadoExtra'),
  btnEnviarCompleto: $('btnEnviarCompleto'),
  btnCopiarBou: $('btnCopiarBou')
};

const currentEditId = new URLSearchParams(window.location.search).get('edit');
const equipeConfigs = {
  motorista: { allowNA: false },
  chefe: { allowNA: false },
  terceiro: { allowNA: true },
  quarto: { allowNA: true }
};
const equipeOptionsState = {
  motorista: [],
  chefe: [],
  terceiro: [],
  quarto: []
};

function setStatus(msg) {
  if (!el.status) return;
  el.status.textContent = msg;
}

function setStatusEntradaCompleta(msg, isError = false) {
  if (!el.statusEntradaCompleta) return;
  el.statusEntradaCompleta.textContent = msg;
  el.statusEntradaCompleta.style.color = isError ? '#b42318' : '#166534';
}

function formatDatePt(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatDateTimePt(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const datePart = formatDatePt(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
}

function prefillDataHora() {
  if (currentEditId) return;
  if (!el.datahora) return;
  if ((el.datahora.value || '').trim()) return;
  el.datahora.value = formatDateTimePt(new Date());
}

function v(inputEl, fallback = 'N/A') {
  if (!inputEl) return fallback;
  const val = (inputEl.value || '').trim();
  return val.length ? val : fallback;
}

function getSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    return null;
  }
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

function addOptionalLine(lines, label, inputEl) {
  const val = (inputEl && inputEl.value ? inputEl.value : '').trim();
  if (val) lines.push(`${label}: ${val}`);
}

function setExtraOpen(isOpen) {
  if (!el.acusadoExtra || !el.btnToggleAcusado2) return;
  el.acusadoExtra.hidden = !isOpen;
  el.acusadoExtra.classList.toggle('is-open', isOpen);
  el.btnToggleAcusado2.setAttribute('aria-expanded', String(isOpen));
  el.btnToggleAcusado2.textContent = isOpen ? 'Ocultar segundo acusado' : 'Adicionar segundo acusado';
}

function sincronizarUnidadeComPreset() {
  if (!el.unidadePreset || !el.unidade) return;
  const selected = (el.unidadePreset.value || '').trim();
  if (selected) el.unidade.value = selected;
}

function applyUnidadeSelection(value, labelText) {
  if (!el.unidadePreset) return;
  el.unidadePreset.value = value || '';
  if (el.unidadeDropdownText) {
    el.unidadeDropdownText.textContent = labelText || 'Selecionar unidade...';
  }
  document.querySelectorAll('.bou-dd-item[data-unidade]').forEach((node) => {
    const isSelected = (node.getAttribute('data-unidade') || '') === (value || '');
    node.classList.toggle('is-selected', isSelected);
  });
  sincronizarUnidadeComPreset();
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

  document.querySelectorAll('.bou-dd-item[data-unidade]').forEach((item) => {
    item.addEventListener('click', () => {
      const value = item.getAttribute('data-unidade') || '';
      const labelText = (item.querySelector('span') ? item.querySelector('span').textContent : value) || value;
      applyUnidadeSelection(value, labelText);
      setOpen(false);
    });
  });

  document.addEventListener('click', (event) => {
    if (!el.unidadeDropdown.contains(event.target)) {
      setOpen(false);
    }
  });
}

function formatEquipeOption(profile) {
  const nome = profile && profile.nome_guerra ? String(profile.nome_guerra).trim() : '';
  const rg = profile && profile.rg ? String(profile.rg).trim() : '';
  if (nome && rg) return `${nome} - ${rg}`;
  return nome || rg || '';
}

function ensureEquipeOption(field, value) {
  if (!field) return;
  const safe = (value || '').trim();
  if (!safe) return;
  const exists = (equipeOptionsState[field] || []).includes(safe);
  if (!exists) {
    equipeOptionsState[field].push(safe);
    renderEquipeDropdown(field);
  }
}

function getEquipeUi(field) {
  return {
    root: el[`${field}Dropdown`],
    btn: el[`${field}DropdownBtn`],
    text: el[`${field}DropdownText`],
    menu: el[`${field}DropdownMenu`],
    input: el[field]
  };
}

function closeAllEquipeDropdowns(exceptField = '') {
  ['motorista', 'chefe', 'terceiro', 'quarto'].forEach((field) => {
    if (field === exceptField) return;
    const ui = getEquipeUi(field);
    if (!ui.root || !ui.btn) return;
    ui.root.classList.remove('is-open');
    ui.btn.setAttribute('aria-expanded', 'false');
  });
}

function applyEquipeSelection(field, value, labelText) {
  const ui = getEquipeUi(field);
  const config = equipeConfigs[field];
  if (!ui.input || !ui.text || !config) return;
  const safe = (value || '').trim();
  ui.input.value = safe;
  if (!safe) ui.text.textContent = 'Selecionar policial...';
  else ui.text.textContent = labelText || safe;

  if (!ui.menu) return;
  ui.menu.querySelectorAll('.bou-dd-item[data-equipe]').forEach((node) => {
    const isSelected = (node.getAttribute('data-equipe') || '') === safe;
    node.classList.toggle('is-selected', isSelected);
    const input = node.querySelector('input[type="checkbox"]');
    const icon = node.querySelector('i');
    if (input) input.checked = isSelected;
    if (icon) icon.classList.toggle('is-hidden', !isSelected);
  });
}

function renderEquipeDropdown(field) {
  const ui = getEquipeUi(field);
  const config = equipeConfigs[field];
  if (!ui.menu || !config) return;

  const values = Array.from(new Set((equipeOptionsState[field] || []).map((v) => (v || '').trim()).filter(Boolean)));
  const current = ui.input ? (ui.input.value || '').trim() : '';

  ui.menu.innerHTML = '';
  if (config.allowNA) {
    const naBtn = document.createElement('button');
    naBtn.type = 'button';
    naBtn.className = `bou-dd-item tone-e voo-dd-check-item${current === 'N/A' ? ' is-selected' : ''}`;
    naBtn.setAttribute('data-equipe', 'N/A');
    naBtn.innerHTML = '<span class="voo-dd-check-left"><input type="checkbox" tabindex="-1" ' + (current === 'N/A' ? 'checked' : '') + '><span>N/A</span></span><i class="fas fa-check' + (current === 'N/A' ? '' : ' is-hidden') + '"></i>';
    ui.menu.appendChild(naBtn);
    if (values.length) {
      const sep = document.createElement('div');
      sep.className = 'bou-dd-sep';
      ui.menu.appendChild(sep);
    }
  }

  values.forEach((value, idx) => {
    const toneClass = idx % 2 === 0 ? 'tone-a' : 'tone-b';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bou-dd-item ${toneClass} voo-dd-check-item${current === value ? ' is-selected' : ''}`;
    btn.setAttribute('data-equipe', value);
    btn.innerHTML = `<span class="voo-dd-check-left"><input type="checkbox" tabindex="-1" ${current === value ? 'checked' : ''}><span>${value}</span></span><i class="fas fa-check${current === value ? '' : ' is-hidden'}"></i>`;
    ui.menu.appendChild(btn);
  });

  const currentLabel = current || (config.allowNA ? 'N/A' : 'Selecionar policial...');
  applyEquipeSelection(field, current || (config.allowNA ? 'N/A' : ''), currentLabel);
}

function setupEquipeDropdown(field) {
  const ui = getEquipeUi(field);
  if (!ui.root || !ui.btn || !ui.menu || !ui.input) return;

  ui.btn.addEventListener('click', () => {
    const isOpen = ui.root.classList.contains('is-open');
    closeAllEquipeDropdowns(field);
    ui.root.classList.toggle('is-open', !isOpen);
    ui.btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  ui.menu.addEventListener('click', (event) => {
    const item = event.target.closest('.bou-dd-item[data-equipe]');
    if (!item) return;
    const value = item.getAttribute('data-equipe') || '';
    const labelText = (item.querySelector('span') ? item.querySelector('span').textContent : value) || value;
    applyEquipeSelection(field, value, labelText);
    ui.root.classList.remove('is-open');
    ui.btn.setAttribute('aria-expanded', 'false');
  });
}

function setupEquipeDropdowns() {
  ['motorista', 'chefe', 'terceiro', 'quarto'].forEach((field) => setupEquipeDropdown(field));
  document.addEventListener('click', (event) => {
    const inside = event.target.closest('.equipe-dropdown');
    if (!inside) closeAllEquipeDropdowns();
  });
}

function applyResultadoSelection(value, labelText) {
  if (!el.resultado || !el.resultadoDropdownText || !el.resultadoDropdownMenu) return;
  const safe = (value || '').trim();
  el.resultado.value = safe;
  el.resultadoDropdownText.textContent = safe ? (labelText || safe) : 'Selecionar resultado...';
  el.resultadoDropdownMenu.querySelectorAll('.bou-dd-item[data-resultado]').forEach((node) => {
    const isSelected = (node.getAttribute('data-resultado') || '') === safe;
    node.classList.toggle('is-selected', isSelected);
  });
}

function setupResultadoDropdown() {
  if (!el.resultadoDropdown || !el.resultadoDropdownBtn || !el.resultadoDropdownMenu) return;

  const setOpen = (open) => {
    el.resultadoDropdown.classList.toggle('is-open', open);
    el.resultadoDropdownBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  el.resultadoDropdownBtn.addEventListener('click', () => {
    const isOpen = el.resultadoDropdown.classList.contains('is-open');
    setOpen(!isOpen);
  });

  el.resultadoDropdownMenu.addEventListener('click', (event) => {
    const item = event.target.closest('.bou-dd-item[data-resultado]');
    if (!item) return;
    const value = item.getAttribute('data-resultado') || '';
    const labelText = (item.querySelector('span') ? item.querySelector('span').textContent : value) || value;
    applyResultadoSelection(value, labelText);
    setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!el.resultadoDropdown.contains(event.target)) {
      setOpen(false);
    }
  });
}

async function carregarEquipeDropdowns() {
  const fields = [el.motorista, el.chefe, el.terceiro, el.quarto].filter(Boolean);
  if (!fields.length) return;

  const savedValues = {
    motorista: el.motorista ? (el.motorista.value || '').trim() : '',
    chefe: el.chefe ? (el.chefe.value || '').trim() : '',
    terceiro: el.terceiro ? (el.terceiro.value || '').trim() : '',
    quarto: el.quarto ? (el.quarto.value || '').trim() : ''
  };

  let options = [];
  const { client, user } = await getCurrentUser();
  if (client && user) {
    const result = await client
      .from('profiles')
      .select('nome_guerra, rg')
      .eq('aprovado', true)
      .order('nome_guerra', { ascending: true });

    if (!result.error && Array.isArray(result.data)) {
      options = result.data.map(formatEquipeOption).filter(Boolean);
    } else {
      const own = await client
        .from('profiles')
        .select('nome_guerra, rg')
        .eq('id', user.id)
        .maybeSingle();
      if (!own.error && own.data) {
        const ownLabel = formatEquipeOption(own.data);
        if (ownLabel) options = [ownLabel];
      }
    }
  }

  equipeOptionsState.motorista = [...options];
  equipeOptionsState.chefe = [...options];
  equipeOptionsState.terceiro = [...options];
  equipeOptionsState.quarto = [...options];

  ensureEquipeOption('motorista', savedValues.motorista);
  ensureEquipeOption('chefe', savedValues.chefe);
  ensureEquipeOption('terceiro', savedValues.terceiro);
  ensureEquipeOption('quarto', savedValues.quarto);

  if (el.motorista) el.motorista.value = savedValues.motorista || '';
  if (el.chefe) el.chefe.value = savedValues.chefe || '';
  if (el.terceiro) el.terceiro.value = savedValues.terceiro || 'N/A';
  if (el.quarto) el.quarto.value = savedValues.quarto || 'N/A';

  renderEquipeDropdown('motorista');
  renderEquipeDropdown('chefe');
  renderEquipeDropdown('terceiro');
  renderEquipeDropdown('quarto');
}

function sincronizarAcoesCombinadas() {
  if (!el.acoes) return;

  const selecionadas = [];
  document.querySelectorAll('input[name="acoesOpcao"]:checked').forEach((node) => {
    const text = (node.value || '').trim();
    if (text) selecionadas.push(text);
  });

  const obs = el.acoesObservacoes ? (el.acoesObservacoes.value || '').trim() : '';
  const partes = [];

  if (selecionadas.length) {
    partes.push(selecionadas.map((item) => `- ${item}`).join('\n'));
  }
  if (obs) {
    partes.push(`Observacoes: ${obs}`);
  }

  el.acoes.value = partes.join('\n');
}

async function preencherAssinaturaAutomatica() {
  if (!el.assinatura) return;
  const { client, user } = await getCurrentUser();
  if (!client || !user) return;

  try {
    const profileResult = await client
      .from('profiles')
      .select('nome_guerra, cargo')
      .eq('id', user.id)
      .maybeSingle();

    const nomePerfil = profileResult && profileResult.data && profileResult.data.nome_guerra
      ? String(profileResult.data.nome_guerra).trim()
      : '';

    const cargoPerfil = profileResult && profileResult.data && profileResult.data.cargo
      ? String(profileResult.data.cargo).trim()
      : '';

    const nomeMeta = user.user_metadata && user.user_metadata.full_name
      ? String(user.user_metadata.full_name).trim()
      : '';

    const nomeEmail = user.email ? String(user.email).trim() : '';
    const nome = nomePerfil || nomeMeta || nomeEmail || 'Usuario';
    const cargo = cargoPerfil || 'Cargo (a definir)';

    el.assinatura.value = `${nome}, ${cargo}, Assinado digitalmente por ${nome}`;
  } catch {
    /* ignore */
  }
}

function gerarTexto() {
  sincronizarAcoesCombinadas();

  const titulo = v(el.titulo, '[ BOU ______/____ ____ ]');
  const texto = [
    'TITULO DO BOU / BO:',
    '',
    `${titulo}`,
    '',
    'Dados da Equipe',
    '',
    `Unidade: ${v(el.unidade)}`,
    `Motorista: ${v(el.motorista)}`,
    `Chefe de viatura: ${v(el.chefe)}`,
    `Terceiro Homem: ${v(el.terceiro)}`,
    `Quarto Homem: ${v(el.quarto)}`,
    '',
    'Dados do Acusado',
    '',
    `Nome do acusado: ${v(el.nomeAcusado)}`,
    `RG do acusado: ${v(el.rgAcusado)}`,
    `Natureza da Ocorrencia: ${v(el.natureza)}`
  ];

  addOptionalLine(texto, 'Nome do acusado (2)', el.nomeAcusado2);
  addOptionalLine(texto, 'RG do acusado (2)', el.rgAcusado2);
  addOptionalLine(texto, 'Natureza da Ocorrencia (2)', el.natureza2);

  texto.push(
    '',
    `Relato dos Fatos: ${v(el.relato, '')}`,
    '',
    `Data e horario aproximado: ${v(el.datahora)}`,
    '',
    `Local exato: ${v(el.local)}`,
    '',
    `Pessoas envolvidas: ${v(el.envolvidos)}`,
    '',
    `Acoes dos policiais e do individuo: ${v(el.acoes, '')}`,
    '',
    `Resultado da abordagem: ${v(el.resultado)}`,
    '',
    `Material Apreendido: ${v(el.material, 'NIHIL')}`,
    '',
    `Veiculo Apreendido: ${v(el.veiculo)}`,
    `Coloracao: ${v(el.corVeiculo)}`,
    '',
    'Assinatura do responsavel:',
    `${v(el.assinatura)}`,
    ''
  );

  return texto.join('\n').trim() + '\n';
}

function gerarRelatorio() {
  if (!el.saida) return;
  el.saida.value = gerarTexto();
  el.saida.scrollTop = 0;
  setStatus('Gerado');
}

async function copiarSaida() {
  const texto = (el.saida && el.saida.value ? el.saida.value : '').trim();
  if (!texto) {
    setStatus('Nada para copiar');
    return;
  }

  try {
    await navigator.clipboard.writeText(texto);
    setStatus('Copiado!');
    const original = el.btnCopiar.textContent;
    el.btnCopiar.textContent = 'Copiado!';
    setTimeout(() => (el.btnCopiar.textContent = original), 1200);
  } catch {
    if (!el.saida) return;
    el.saida.focus();
    el.saida.select();
    document.execCommand('copy');
    setStatus('Copiado!');
  }
}

async function copiarBouAtual() {
  const texto = gerarTexto().trim();
  if (!texto) {
    setStatusEntradaCompleta('Nada para copiar.', true);
    return;
  }

  try {
    await navigator.clipboard.writeText(texto);
    setStatusEntradaCompleta('BOU copiado para a area de transferencia.');
    if (el.btnCopiarBou) {
      const original = el.btnCopiarBou.textContent;
      el.btnCopiarBou.textContent = 'Copiado!';
      setTimeout(() => { el.btnCopiarBou.textContent = original; }, 1200);
    }
  } catch {
    const temp = document.createElement('textarea');
    temp.value = texto;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    setStatusEntradaCompleta('BOU copiado para a area de transferencia.');
  }
}

function limparSaida() {
  if (el.saida) el.saida.value = '';
  setStatus('Saida limpa');
}

function parseCampo(texto, label) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${safeLabel}:\\s*(.*)$`, 'im');
  const match = texto.match(regex);
  return match ? match[1].trim() : '';
}

function parseTitulo(texto) {
  const match = texto.match(/T[IÍ]TULO DO BOU \/ BO:\s*[\r\n]+([\s\S]*?)(?:[\r\n]{2,}|$)/i);
  return match ? match[1].trim() : '';
}

function parseCampoMulti(texto, labels) {
  for (const label of labels) {
    const value = parseCampo(texto, label);
    if (value) return value;
  }
  return '';
}

function aplicarTextoCompletoNosCampos(textoCompleto) {
  const texto = (textoCompleto || '').trim();
  if (!texto) {
    setStatusEntradaCompleta('Cole um texto completo antes de enviar.', true);
    return null;
  }

  const mapa = [
    { id: 'titulo', parser: parseTitulo },
    { id: 'unidade', labels: ['Unidade'] },
    { id: 'motorista', labels: ['Motorista'] },
    { id: 'chefe', labels: ['Chefe de viatura'] },
    { id: 'terceiro', labels: ['Terceiro Homem'] },
    { id: 'quarto', labels: ['Quarto Homem'] },
    { id: 'nomeAcusado', labels: ['Nome do acusado'] },
    { id: 'rgAcusado', labels: ['RG do acusado'] },
    { id: 'natureza', labels: ['Natureza da Ocorrencia', 'Natureza da Ocorrência'] },
    { id: 'nomeAcusado2', labels: ['Nome do acusado (2)'] },
    { id: 'rgAcusado2', labels: ['RG do acusado (2)'] },
    { id: 'natureza2', labels: ['Natureza da Ocorrencia (2)', 'Natureza da Ocorrência (2)'] },
    { id: 'relato', labels: ['Relato dos Fatos'] },
    { id: 'datahora', labels: ['Data e horario aproximado', 'Data e horário aproximado'] },
    { id: 'local', labels: ['Local exato'] },
    { id: 'envolvidos', labels: ['Pessoas envolvidas'] },
    { id: 'acoes', labels: ['Acoes dos policiais e do individuo', 'Ações dos policiais e do indivíduo'] },
    { id: 'resultado', labels: ['Resultado da abordagem'] },
    { id: 'material', labels: ['Material Apreendido'] },
    { id: 'veiculo', labels: ['Veiculo Apreendido'] },
    { id: 'corVeiculo', labels: ['Coloracao', 'Coloração'] },
    { id: 'assinatura', labels: ['Assinatura do responsavel', 'Assinatura do responsável'] }
  ];

  mapa.forEach((item) => {
    const input = $(item.id);
    if (!input) return;
    let value = '';
    if (item.parser) value = item.parser(texto);
    else value = parseCampoMulti(texto, item.labels || []);
    if (value) input.value = value;
  });

  applyResultadoSelection(el.resultado ? el.resultado.value : '', el.resultado ? el.resultado.value : '');

  if ((el.nomeAcusado2 && el.nomeAcusado2.value.trim()) || (el.rgAcusado2 && el.rgAcusado2.value.trim()) || (el.natureza2 && el.natureza2.value.trim())) {
    setExtraOpen(true);
  }

  sincronizarAcoesCombinadas();

  return {
    texto_original: texto,
    data_envio: new Date().toISOString(),
    campos: {
      titulo: (el.titulo.value || '').trim(),
      unidade: (el.unidade.value || '').trim(),
      motorista: (el.motorista.value || '').trim(),
      chefe: (el.chefe.value || '').trim(),
      terceiro: (el.terceiro.value || '').trim(),
      quarto: (el.quarto.value || '').trim(),
      nome_acusado: (el.nomeAcusado.value || '').trim(),
      rg_acusado: (el.rgAcusado.value || '').trim(),
      natureza: (el.natureza.value || '').trim(),
      nome_acusado2: (el.nomeAcusado2.value || '').trim(),
      rg_acusado2: (el.rgAcusado2.value || '').trim(),
      natureza2: (el.natureza2.value || '').trim(),
      datahora: (el.datahora.value || '').trim(),
      local: (el.local.value || '').trim(),
      relato: (el.relato.value || '').trim(),
      envolvidos: (el.envolvidos.value || '').trim(),
      acoes_selecionadas: Array.from(document.querySelectorAll('input[name="acoesOpcao"]:checked'))
        .map((node) => (node.value || '').trim())
        .filter(Boolean),
      acoes_observacoes: (el.acoesObservacoes && el.acoesObservacoes.value ? el.acoesObservacoes.value : '').trim(),
      acoes: (el.acoes.value || '').trim(),
      resultado: (el.resultado.value || '').trim(),
      material: (el.material.value || '').trim(),
      veiculo: (el.veiculo.value || '').trim(),
      cor_veiculo: (el.corVeiculo.value || '').trim(),
      assinatura: (el.assinatura.value || '').trim()
    }
  };
}

async function salvarBouNoBanco(submissao) {
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) {
    throw new Error(error || 'Sem sessao valida para salvar no banco.');
  }

  const titulo = submissao && submissao.campos && submissao.campos.titulo
    ? submissao.campos.titulo
    : 'BOU sem titulo';

  const conteudo = JSON.stringify(submissao || {});

  if (currentEditId) {
    const result = await client
      .from('bous')
      .update({ titulo, conteudo_completo: conteudo })
      .eq('id', Number(currentEditId))
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (result.error) throw new Error(`Falha ao atualizar BOU: ${result.error.message}`);
    if (!result.data) throw new Error('BOU nao encontrado para edicao ou sem permissao.');
    return result.data.id;
  }

  const insertResult = await client
    .from('bous')
    .insert({ user_id: user.id, titulo, conteudo_completo: conteudo })
    .select('id')
    .single();

  if (insertResult.error) throw new Error(`Falha ao salvar BOU: ${insertResult.error.message}`);
  return insertResult.data.id;
}

async function carregarBouParaEdicao() {
  if (!currentEditId) return;

  const { client, user, error } = await getCurrentUser();
  if (!client || !user) {
    setStatusEntradaCompleta(error || 'Sessao invalida para carregar edicao.', true);
    return;
  }

  const result = await client
    .from('bous')
    .select('id, user_id, conteudo_completo')
    .eq('id', Number(currentEditId))
    .eq('user_id', user.id)
    .maybeSingle();

  if (result.error || !result.data) {
    setStatusEntradaCompleta('Nao foi possivel carregar este BOU para edicao.', true);
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
    if (el.titulo) el.titulo.value = campos.titulo || '';
    if (el.unidade) el.unidade.value = campos.unidade || '';
    {
      const unidadeAtual = (campos.unidade || '').trim();
      const matchNode = document.querySelector(`.bou-dd-item[data-unidade="${unidadeAtual.replace(/"/g, '\\"')}"]`);
      if (matchNode) {
        const labelText = (matchNode.querySelector('span') ? matchNode.querySelector('span').textContent : unidadeAtual) || unidadeAtual;
        applyUnidadeSelection(unidadeAtual, labelText);
      } else {
        applyUnidadeSelection('', 'Selecionar unidade...');
      }
    }
    ensureEquipeOption('motorista', campos.motorista || '');
    ensureEquipeOption('chefe', campos.chefe || '');
    ensureEquipeOption('terceiro', campos.terceiro || '');
    ensureEquipeOption('quarto', campos.quarto || '');
    applyEquipeSelection('motorista', campos.motorista || '', campos.motorista || '');
    applyEquipeSelection('chefe', campos.chefe || '', campos.chefe || '');
    applyEquipeSelection('terceiro', campos.terceiro || 'N/A', campos.terceiro || 'N/A');
    applyEquipeSelection('quarto', campos.quarto || 'N/A', campos.quarto || 'N/A');
    if (el.nomeAcusado) el.nomeAcusado.value = campos.nome_acusado || '';
    if (el.rgAcusado) el.rgAcusado.value = campos.rg_acusado || '';
    if (el.natureza) el.natureza.value = campos.natureza || '';
    if (el.nomeAcusado2) el.nomeAcusado2.value = campos.nome_acusado2 || '';
    if (el.rgAcusado2) el.rgAcusado2.value = campos.rg_acusado2 || '';
    if (el.natureza2) el.natureza2.value = campos.natureza2 || '';
    if (el.datahora) el.datahora.value = campos.datahora || '';
    if (el.local) el.local.value = campos.local || '';
    if (el.relato) el.relato.value = campos.relato || '';
    if (el.envolvidos) el.envolvidos.value = campos.envolvidos || '';

    const selecionadas = Array.isArray(campos.acoes_selecionadas) ? campos.acoes_selecionadas : [];
    document.querySelectorAll('input[name="acoesOpcao"]').forEach((node) => {
      node.checked = selecionadas.includes(node.value);
    });
    if (el.acoesObservacoes) el.acoesObservacoes.value = campos.acoes_observacoes || '';
    if (el.acoes) el.acoes.value = campos.acoes || '';

    applyResultadoSelection(campos.resultado || '', campos.resultado || '');
    if (el.material) el.material.value = campos.material || 'NIHIL';
    if (el.veiculo) el.veiculo.value = campos.veiculo || '';
    if (el.corVeiculo) el.corVeiculo.value = campos.cor_veiculo || '';
    if (el.assinatura) el.assinatura.value = campos.assinatura || '';

    if (el.entradaCompleta) el.entradaCompleta.value = payload.texto_original || '';

    if ((el.nomeAcusado2 && el.nomeAcusado2.value) || (el.rgAcusado2 && el.rgAcusado2.value) || (el.natureza2 && el.natureza2.value)) {
      setExtraOpen(true);
    }
  } else if (payload && payload.texto_original) {
    if (el.entradaCompleta) el.entradaCompleta.value = payload.texto_original;
    aplicarTextoCompletoNosCampos(payload.texto_original);
  }

  sincronizarAcoesCombinadas();
  gerarRelatorio();
  if (el.btnEnviarCompleto) el.btnEnviarCompleto.textContent = 'Atualizar BOU';
  setStatusEntradaCompleta(`Editando BOU #${currentEditId}. Atualize e envie novamente.`);
}

async function enviarTextoCompleto() {
  sincronizarAcoesCombinadas();
  const submissao = {
    texto_original: gerarTexto(),
    data_envio: new Date().toISOString(),
    campos: {
      titulo: (el.titulo && el.titulo.value ? el.titulo.value : '').trim(),
      unidade: (el.unidade && el.unidade.value ? el.unidade.value : '').trim(),
      motorista: (el.motorista && el.motorista.value ? el.motorista.value : '').trim(),
      chefe: (el.chefe && el.chefe.value ? el.chefe.value : '').trim(),
      terceiro: (el.terceiro && el.terceiro.value ? el.terceiro.value : '').trim(),
      quarto: (el.quarto && el.quarto.value ? el.quarto.value : '').trim(),
      nome_acusado: (el.nomeAcusado && el.nomeAcusado.value ? el.nomeAcusado.value : '').trim(),
      rg_acusado: (el.rgAcusado && el.rgAcusado.value ? el.rgAcusado.value : '').trim(),
      natureza: (el.natureza && el.natureza.value ? el.natureza.value : '').trim(),
      nome_acusado2: (el.nomeAcusado2 && el.nomeAcusado2.value ? el.nomeAcusado2.value : '').trim(),
      rg_acusado2: (el.rgAcusado2 && el.rgAcusado2.value ? el.rgAcusado2.value : '').trim(),
      natureza2: (el.natureza2 && el.natureza2.value ? el.natureza2.value : '').trim(),
      datahora: (el.datahora && el.datahora.value ? el.datahora.value : '').trim(),
      local: (el.local && el.local.value ? el.local.value : '').trim(),
      relato: (el.relato && el.relato.value ? el.relato.value : '').trim(),
      envolvidos: (el.envolvidos && el.envolvidos.value ? el.envolvidos.value : '').trim(),
      acoes_selecionadas: Array.from(document.querySelectorAll('input[name="acoesOpcao"]:checked'))
        .map((node) => (node.value || '').trim())
        .filter(Boolean),
      acoes_observacoes: (el.acoesObservacoes && el.acoesObservacoes.value ? el.acoesObservacoes.value : '').trim(),
      acoes: (el.acoes && el.acoes.value ? el.acoes.value : '').trim(),
      resultado: (el.resultado && el.resultado.value ? el.resultado.value : '').trim(),
      material: (el.material && el.material.value ? el.material.value : '').trim(),
      veiculo: (el.veiculo && el.veiculo.value ? el.veiculo.value : '').trim(),
      cor_veiculo: (el.corVeiculo && el.corVeiculo.value ? el.corVeiculo.value : '').trim(),
      assinatura: (el.assinatura && el.assinatura.value ? el.assinatura.value : '').trim()
    }
  };

  try {
    const bouId = await salvarBouNoBanco(submissao);
    setStatusEntradaCompleta(currentEditId ? 'BOU atualizado no banco com sucesso.' : 'BOU salvo no banco com sucesso.');
    window.location.href = `bou-envios.html?saved=${encodeURIComponent(String(bouId))}`;
  } catch (err) {
    setStatusEntradaCompleta(err.message || 'Falha ao salvar BOU no banco.', true);
  }
}

function limparCampos() {
  const ids = [
    'titulo', 'unidade', 'motorista', 'chefe', 'terceiro', 'quarto',
    'nomeAcusado', 'rgAcusado', 'natureza', 'nomeAcusado2', 'rgAcusado2',
    'natureza2', 'datahora', 'local', 'relato', 'envolvidos', 'acoes',
    'acoesObservacoes', 'resultado', 'material', 'veiculo', 'corVeiculo',
    'assinatura', 'entradaBouCompleto'
  ];

  ids.forEach((id) => {
    const node = $(id);
    if (!node) return;
    node.value = '';
  });

  if (el.terceiro) el.terceiro.value = 'N/A';
  if (el.quarto) el.quarto.value = 'N/A';
  if (el.material) el.material.value = 'NIHIL';

  if (el.unidadePreset) el.unidadePreset.value = '';
  applyUnidadeSelection('', 'Selecionar unidade...');
  applyResultadoSelection('', 'Selecionar resultado...');
  document.querySelectorAll('input[name="acoesOpcao"]').forEach((node) => {
    node.checked = false;
  });

  setExtraOpen(false);
  sincronizarAcoesCombinadas();
  preencherAssinaturaAutomatica();
  setStatus('Campos limpos');
}

if (el.btnGerar) el.btnGerar.addEventListener('click', gerarRelatorio);
if (el.btnCopiar) el.btnCopiar.addEventListener('click', copiarSaida);
if (el.btnLimparSaida) el.btnLimparSaida.addEventListener('click', limparSaida);
if (el.btnLimparCampos) el.btnLimparCampos.addEventListener('click', limparCampos);
if (el.btnCopiarBou) el.btnCopiarBou.addEventListener('click', copiarBouAtual);
if (el.btnChatgpt) {
  el.btnChatgpt.addEventListener('click', () => {
    window.open('https://chatgpt.com/', '_blank', 'noopener');
  });
}
if (el.btnToggleAcusado2) {
  el.btnToggleAcusado2.addEventListener('click', () => {
    const willOpen = el.acusadoExtra ? el.acusadoExtra.hidden : false;
    setExtraOpen(willOpen);
  });
}
document.querySelectorAll('input[name="acoesOpcao"]').forEach((node) => {
  node.addEventListener('change', sincronizarAcoesCombinadas);
});
if (el.acoesObservacoes) el.acoesObservacoes.addEventListener('input', sincronizarAcoesCombinadas);
if (el.btnEnviarCompleto) el.btnEnviarCompleto.addEventListener('click', enviarTextoCompleto);

setStatus('Pronto');
setExtraOpen(false);
setStatusEntradaCompleta('Pronto para enviar.');
setupUnidadeDropdown();
setupEquipeDropdowns();
setupResultadoDropdown();
applyUnidadeSelection('', 'Selecionar unidade...');
applyResultadoSelection('', 'Selecionar resultado...');
sincronizarAcoesCombinadas();
(async () => {
  await carregarEquipeDropdowns();
  await preencherAssinaturaAutomatica();
  prefillDataHora();
  await carregarBouParaEdicao();
})();
