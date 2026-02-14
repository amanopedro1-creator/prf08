const $ = (id) => document.getElementById(id);

const el = {
  numero: $('voo-numero'),
  data: $('voo-data'),
  inicio: $('voo-inicio'),
  fim: $('voo-fim'),
  piloto: $('voo-piloto'),
  pilotoDropdown: $('vooPilotoDropdown'),
  pilotoDropdownBtn: $('vooPilotoDropdownBtn'),
  pilotoDropdownText: $('vooPilotoDropdownText'),
  pilotoDropdownMenu: $('vooPilotoDropdownMenu'),
  tripulacao: $('voo-tripulacao'),
  tripulacaoDropdown: $('vooTripulacaoDropdown'),
  tripulacaoDropdownBtn: $('vooTripulacaoDropdownBtn'),
  tripulacaoDropdownText: $('vooTripulacaoDropdownText'),
  tripulacaoDropdownMenu: $('vooTripulacaoDropdownMenu'),
  aeronaveDropdown: $('vooAeronaveDropdown'),
  aeronaveDropdownBtn: $('vooAeronaveDropdownBtn'),
  aeronaveDropdownText: $('vooAeronaveDropdownText'),
  aeronaveDropdownMenu: $('vooAeronaveDropdownMenu'),
  aeronave: $('voo-aeronave'),
  resumo: $('voo-resumo'),
  btnEnviar: $('btnEnviarRelatorioVoo'),
  btnLimpar: $('btnLimparRelatorioVoo'),
  status: $('statusRelatorioVoo')
};

const currentEditId = new URLSearchParams(window.location.search).get('edit');
let teamOptions = [];
const selectedTripulacao = new Set();
let selectedPiloto = '';
let selectedAeronave = '';

function setStatus(msg, isError = false) {
  if (!el.status) return;
  el.status.textContent = msg || '';
  el.status.style.color = isError ? '#b42318' : '#166534';
}

function normalizeHourInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
}

function isValidHour24(value) {
  const v = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const hh = Number(v.slice(0, 2));
  const mm = Number(v.slice(3, 5));
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function getSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) return { client: null, user: null, error: 'Supabase não disponível na página.' };
  const sessionResult = await client.auth.getSession();
  const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  const user = session ? session.user : null;
  return { client, user, error: user ? null : 'Usuário não autenticado.' };
}

function formatEquipeOption(profile) {
  const nome = profile && profile.nome_guerra ? String(profile.nome_guerra).trim() : '';
  const rg = profile && profile.rg ? String(profile.rg).trim() : '';
  if (nome && rg) return `${nome} - ${rg}`;
  return nome || rg || '';
}

function getRadioValue(name) {
  const node = document.querySelector(`input[name="${name}"]:checked`);
  return node ? String(node.value || '').trim() : '';
}

function setRadioValue(name, value) {
  const target = String(value || '').trim();
  document.querySelectorAll(`input[name="${name}"]`).forEach((node) => {
    node.checked = String(node.value || '').trim() === target;
  });
}

function updateTripulacaoText() {
  if (!el.tripulacaoDropdownText || !el.tripulacao) return;
  const list = Array.from(selectedTripulacao);
  el.tripulacao.value = list.join(' || ');
  if (!list.length) {
    el.tripulacaoDropdownText.textContent = 'Selecionar tripulação...';
    return;
  }
  if (list.length <= 2) {
    el.tripulacaoDropdownText.textContent = list.join(', ');
    return;
  }
  el.tripulacaoDropdownText.textContent = `${list.length} tripulantes selecionados`;
}

function updatePilotoText() {
  if (!el.pilotoDropdownText || !el.pilotoDropdownMenu || !el.piloto) return;
  el.piloto.value = selectedPiloto || '';
  el.pilotoDropdownText.textContent = selectedPiloto || 'Selecionar piloto...';
  el.pilotoDropdownMenu.querySelectorAll('.bou-dd-item[data-piloto]').forEach((node) => {
    const input = node.querySelector('input[type="checkbox"]');
    const icon = node.querySelector('i');
    const isSelected = (node.getAttribute('data-piloto') || '') === selectedPiloto;
    node.classList.toggle('is-selected', isSelected);
    if (input) input.checked = isSelected;
    if (icon) icon.classList.toggle('is-hidden', !isSelected);
  });
}

function renderPilotoDropdown() {
  if (!el.pilotoDropdownMenu) return;
  el.pilotoDropdownMenu.innerHTML = '';
  if (!teamOptions.length) {
    el.pilotoDropdownMenu.innerHTML = '<div class="approvals-empty">Nenhum usuário disponível.</div>';
    return;
  }

  teamOptions.forEach((value, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `bou-dd-item ${idx % 2 === 0 ? 'tone-a' : 'tone-b'} voo-dd-check-item${selectedPiloto === value ? ' is-selected' : ''}`;
    item.setAttribute('data-piloto', value);
    item.innerHTML =
      '<span class="voo-dd-check-left">' +
      `<input type="checkbox" tabindex="-1" ${selectedPiloto === value ? 'checked' : ''}>` +
      `<span>${value}</span>` +
      '</span>' +
      `<i class="fas fa-check${selectedPiloto === value ? '' : ' is-hidden'}"></i>`;
    el.pilotoDropdownMenu.appendChild(item);
  });
}

function renderTripulacaoDropdown() {
  if (!el.tripulacaoDropdownMenu) return;
  el.tripulacaoDropdownMenu.innerHTML = '';
  if (!teamOptions.length) {
    el.tripulacaoDropdownMenu.innerHTML = '<div class="approvals-empty">Nenhum usuário disponível.</div>';
    return;
  }

  teamOptions.forEach((value, idx) => {
    const item = document.createElement('label');
    item.className = `bou-dd-item ${idx % 2 === 0 ? 'tone-a' : 'tone-b'} voo-dd-check-item`;
    item.innerHTML =
      '<span class="voo-dd-check-left">' +
      `<input type="checkbox" class="voo-tripulacao-check" value="${value.replace(/"/g, '&quot;')}" ${selectedTripulacao.has(value) ? 'checked' : ''}>` +
      `<span>${value}</span>` +
      '</span>' +
      `<i class="fas fa-check${selectedTripulacao.has(value) ? '' : ' is-hidden'}"></i>`;
    el.tripulacaoDropdownMenu.appendChild(item);
  });

  el.tripulacaoDropdownMenu.querySelectorAll('.voo-tripulacao-check').forEach((input) => {
    input.addEventListener('change', () => {
      const value = String(input.value || '').trim();
      if (!value) return;
      if (input.checked) selectedTripulacao.add(value);
      else selectedTripulacao.delete(value);

      const icon = input.closest('.voo-dd-check-item') ? input.closest('.voo-dd-check-item').querySelector('i') : null;
      if (icon) icon.classList.toggle('is-hidden', !input.checked);
      updateTripulacaoText();
    });
  });
}

function setupTripulacaoDropdown() {
  if (!el.tripulacaoDropdown || !el.tripulacaoDropdownBtn || !el.tripulacaoDropdownMenu) return;

  const setOpen = (open) => {
    el.tripulacaoDropdown.classList.toggle('is-open', open);
    el.tripulacaoDropdownBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  el.tripulacaoDropdownBtn.addEventListener('click', () => {
    const isOpen = el.tripulacaoDropdown.classList.contains('is-open');
    setOpen(!isOpen);
  });

  document.addEventListener('click', (event) => {
    if (!el.tripulacaoDropdown.contains(event.target)) setOpen(false);
  });
}

function setupPilotoDropdown() {
  if (!el.pilotoDropdown || !el.pilotoDropdownBtn || !el.pilotoDropdownMenu) return;
  const setOpen = (open) => {
    el.pilotoDropdown.classList.toggle('is-open', open);
    el.pilotoDropdownBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  el.pilotoDropdownBtn.addEventListener('click', () => {
    const isOpen = el.pilotoDropdown.classList.contains('is-open');
    setOpen(!isOpen);
  });

  el.pilotoDropdownMenu.addEventListener('click', (event) => {
    const item = event.target.closest('.bou-dd-item[data-piloto]');
    if (!item) return;
    selectedPiloto = String(item.getAttribute('data-piloto') || '').trim();
    updatePilotoText();
    setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!el.pilotoDropdown.contains(event.target)) setOpen(false);
  });
}

function updateAeronaveText() {
  if (!el.aeronaveDropdownText || !el.aeronaveDropdownMenu || !el.aeronave) return;
  el.aeronave.value = selectedAeronave || '';
  el.aeronaveDropdownText.textContent = selectedAeronave || 'Selecionar aeronave...';
  el.aeronaveDropdownMenu.querySelectorAll('.bou-dd-item[data-aeronave]').forEach((node) => {
    const input = node.querySelector('input[type="checkbox"]');
    const icon = node.querySelector('i');
    const isSelected = (node.getAttribute('data-aeronave') || '') === selectedAeronave;
    node.classList.toggle('is-selected', isSelected);
    if (input) input.checked = isSelected;
    if (icon) icon.classList.toggle('is-hidden', !isSelected);
  });
}

function setupAeronaveDropdown() {
  if (!el.aeronaveDropdown || !el.aeronaveDropdownBtn || !el.aeronaveDropdownMenu) return;
  const setOpen = (open) => {
    el.aeronaveDropdown.classList.toggle('is-open', open);
    el.aeronaveDropdownBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  el.aeronaveDropdownBtn.addEventListener('click', () => {
    const isOpen = el.aeronaveDropdown.classList.contains('is-open');
    setOpen(!isOpen);
  });

  el.aeronaveDropdownMenu.addEventListener('click', (event) => {
    const item = event.target.closest('.bou-dd-item[data-aeronave]');
    if (!item) return;
    selectedAeronave = String(item.getAttribute('data-aeronave') || '').trim();
    updateAeronaveText();
    setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!el.aeronaveDropdown.contains(event.target)) setOpen(false);
  });
}

async function loadTeamOptions() {
  const { client, user } = await getCurrentUser();
  if (!client || !user) return;

  const result = await client
    .from('profiles')
    .select('nome_guerra, rg')
    .eq('aprovado', true)
    .order('nome_guerra', { ascending: true });

  if (result.error || !Array.isArray(result.data)) {
    setStatus('Falha ao carregar usuários para piloto/tripulação.', true);
    return;
  }

  teamOptions = result.data.map(formatEquipeOption).filter(Boolean);
  renderPilotoDropdown();
  updatePilotoText();
  renderTripulacaoDropdown();
}

function buildPayload() {
  const campos = {
    numero: String(el.numero && el.numero.value ? el.numero.value : '').trim(),
    data: String(el.data && el.data.value ? el.data.value : '').trim(),
    inicio: String(el.inicio && el.inicio.value ? el.inicio.value : '').trim(),
    fim: String(el.fim && el.fim.value ? el.fim.value : '').trim(),
    piloto: String(el.piloto && el.piloto.value ? el.piloto.value : '').trim(),
    tripulacao: Array.from(selectedTripulacao),
    aeronave: String(el.aeronave && el.aeronave.value ? el.aeronave.value : '').trim(),
    resumo: String(el.resumo && el.resumo.value ? el.resumo.value : '').trim(),
    avarias: getRadioValue('voo-avarias'),
    uso_letal: getRadioValue('voo-letal')
  };

  const titulo = `Relatório de voo n° ${campos.numero || 'N/A'}`;
  const texto = [
    `Relatório de voo n° ${campos.numero || 'N/A'}`,
    '',
    `Data: ${campos.data || 'N/A'}`,
    `Início: ${campos.inicio || 'N/A'}`,
    `Fim: ${campos.fim || 'N/A'}`,
    '',
    `Piloto: ${campos.piloto || 'N/A'}`,
    `Tripulação: ${campos.tripulacao.length ? campos.tripulacao.join(', ') : 'N/A'}`,
    `Aeronave: ${campos.aeronave || 'N/A'}`,
    '',
    'Resumo das ocorrências:',
    campos.resumo || 'N/A',
    '',
    `Houve avarias na aeronave?: ${campos.avarias || 'N/A'}`,
    `Houve uso letal da força?: ${campos.uso_letal || 'N/A'}`
  ].join('\n');

  const conteudo = {
    texto_original: texto,
    data_envio: new Date().toISOString(),
    campos
  };

  return {
    titulo,
    conteudo,
    conteudo_completo: JSON.stringify(conteudo),
    numero_relatorio: campos.numero,
    data_voo: campos.data || null,
    inicio: campos.inicio || null,
    fim: campos.fim || null,
    piloto: campos.piloto,
    tripulacao: campos.tripulacao.join(' || '),
    aeronave: campos.aeronave,
    resumo: campos.resumo,
    houve_avarias: campos.avarias,
    uso_letal_forca: campos.uso_letal
  };
}

async function saveRelatorio(payload) {
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) throw new Error(error || 'Sem sessão válida.');

  if (currentEditId) {
    const upd = await client
      .from('relatorios_voo')
      .update(payload)
      .eq('id', Number(currentEditId))
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (upd.error) throw new Error(`Falha ao atualizar relatório de voo: ${upd.error.message}`);
    if (!upd.data) throw new Error('Relatório de voo não encontrado para edição.');
    return upd.data.id;
  }

  const ins = await client
    .from('relatorios_voo')
    .insert({ user_id: user.id, ...payload })
    .select('id')
    .single();
  if (ins.error) throw new Error(`Falha ao salvar relatório de voo: ${ins.error.message}`);
  return ins.data.id;
}

async function sendRelatorioToDiscord(relatorioId) {
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) throw new Error(error || 'Sem sess\u00e3o v\u00e1lida para envio ao Discord.');

  let rpc = await client.rpc('send_relatorio_voo_to_discord', {
    p_id: Number(relatorioId)
  });

  // Compatibilidade com versoes antigas da funcao que usam p_relatorio_id
  if (rpc.error && /p_relatorio_id|function\s+public\.send_relatorio_voo_to_discord/i.test(String(rpc.error.message || ''))) {
    rpc = await client.rpc('send_relatorio_voo_to_discord', {
      p_relatorio_id: Number(relatorioId)
    });
  }

  if (rpc.error) throw new Error(`Falha ao enviar ao Discord: ${rpc.error.message}`);
  if (rpc.data && rpc.data.success === false) {
    throw new Error(`Falha ao enviar ao Discord: ${rpc.data.error || 'erro desconhecido'}`);
  }

  return rpc.data || { success: true };
}

async function submitRelatorio() {
  if (el.btnEnviar) el.btnEnviar.disabled = true;

  try {
    const payload = buildPayload();
    if (!payload.numero_relatorio || !payload.data_voo || !payload.inicio || !payload.fim || !payload.piloto || !payload.aeronave) {
      setStatus('Preencha n\u00famero, data, in\u00edcio, fim, piloto e aeronave.', true);
      return;
    }
    if (!isValidHour24(payload.inicio) || !isValidHour24(payload.fim)) {
      setStatus('Use hor\u00e1rio no formato 24 horas (HH:MM).', true);
      return;
    }

    setStatus('Salvando relat\u00f3rio de voo...');
    const id = await saveRelatorio(payload);

    setStatus('Enviando relat\u00f3rio para o Discord...');
    try {
      await sendRelatorioToDiscord(id);
      setStatus(currentEditId
        ? `Relat\u00f3rio de voo #${id} atualizado e enviado com sucesso.`
        : `Relat\u00f3rio de voo #${id} salvo e enviado com sucesso.`);
    } catch (sendErr) {
      setStatus(`Relat\u00f3rio #${id} salvo, mas houve falha no envio ao Discord: ${sendErr.message || 'erro desconhecido'}`, true);
    }
  } catch (e) {
    setStatus(e.message || 'Falha ao salvar relat\u00f3rio de voo.', true);
  } finally {
    if (el.btnEnviar) el.btnEnviar.disabled = false;
  }
}

function clearForm() {
  ['numero', 'data', 'inicio', 'fim', 'resumo'].forEach((key) => {
    if (el[key]) el[key].value = '';
  });
  selectedPiloto = '';
  renderPilotoDropdown();
  updatePilotoText();
  selectedTripulacao.clear();
  renderTripulacaoDropdown();
  updateTripulacaoText();
  selectedAeronave = '';
  updateAeronaveText();
  setRadioValue('voo-avarias', '');
  setRadioValue('voo-letal', '');
  setStatus('Campos limpos.');
}

async function loadForEdit() {
  if (!currentEditId) return;
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) {
    setStatus(error || 'Sessão inválida para edição.', true);
    return;
  }

  const result = await client
    .from('relatorios_voo')
    .select('*')
    .eq('id', Number(currentEditId))
    .eq('user_id', user.id)
    .maybeSingle();

  if (result.error || !result.data) {
    setStatus('Não foi possível carregar este relatório para edição.', true);
    return;
  }

  const row = result.data;
  if (el.numero) el.numero.value = row.numero_relatorio || '';
  if (el.data) el.data.value = row.data_voo || '';
  if (el.inicio) el.inicio.value = row.inicio || '';
  if (el.fim) el.fim.value = row.fim || '';
  if (el.piloto) el.piloto.value = row.piloto || '';
  selectedPiloto = row.piloto || '';
  renderPilotoDropdown();
  updatePilotoText();
  selectedAeronave = row.aeronave || '';
  updateAeronaveText();
  if (el.resumo) el.resumo.value = row.resumo || '';

  selectedTripulacao.clear();
  String(row.tripulacao || '')
    .split(' || ')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => selectedTripulacao.add(s));
  renderTripulacaoDropdown();
  updateTripulacaoText();

  setRadioValue('voo-avarias', row.houve_avarias || '');
  setRadioValue('voo-letal', row.uso_letal_forca || '');

  if (el.btnEnviar) el.btnEnviar.textContent = 'Atualizar relatório de voo';
  setStatus(`Editando relatório de voo #${currentEditId}.`);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupPilotoDropdown();
  setupTripulacaoDropdown();
  setupAeronaveDropdown();
  updateAeronaveText();
  updateTripulacaoText();
  if (el.btnEnviar) el.btnEnviar.addEventListener('click', submitRelatorio);
  if (el.btnLimpar) el.btnLimpar.addEventListener('click', clearForm);
  if (el.inicio) {
    el.inicio.addEventListener('input', () => {
      el.inicio.value = normalizeHourInput(el.inicio.value);
    });
  }
  if (el.fim) {
    el.fim.addEventListener('input', () => {
      el.fim.value = normalizeHourInput(el.fim.value);
    });
  }
  setStatus('Pronto para enviar.');
  await loadTeamOptions();
  await loadForEdit();
});
