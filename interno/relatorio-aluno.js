const $ = (id) => document.getElementById(id);

const el = {
  avaliador: $('aluno-avaliador'),
  data: $('aluno-data'),
  hora: $('aluno-hora'),
  unidade: $('aluno-unidade'),
  unidadePreset: $('alunoUnidadePreset'),
  unidadeDropdown: $('alunoUnidadeDropdown'),
  unidadeDropdownBtn: $('alunoUnidadeDropdownBtn'),
  unidadeDropdownText: $('alunoUnidadeDropdownText'),
  unidadeDropdownMenu: $('alunoUnidadeDropdownMenu'),
  alunos: $('aluno-alunos'),
  alunosDropdown: $('alunoListaDropdown'),
  alunosDropdownBtn: $('alunoListaDropdownBtn'),
  alunosDropdownText: $('alunoListaDropdownText'),
  alunosDropdownMenu: $('alunoListaDropdownMenu'),
  observacoes: $('aluno-observacoes'),
  btnEnviar: $('btnEnviarRelatorioAluno'),
  btnLimpar: $('btnLimparRelatorioAluno'),
  status: $('statusRelatorioAluno')
};

const currentEditId = new URLSearchParams(window.location.search).get('edit');
const selectedAlunos = new Set();
let alunoOptions = [];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function setStatus(msg, isError = false) {
  if (!el.status) return;
  el.status.textContent = msg || '';
  el.status.style.color = isError ? '#b42318' : '#166534';
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

function getNowDateValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNowTimeValue() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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

function applyUnidadeSelection(value, labelText) {
  if (!el.unidadePreset) return;
  const safe = (value || '').trim();
  el.unidadePreset.value = safe;
  if (el.unidadeDropdownText) el.unidadeDropdownText.textContent = labelText || 'Selecionar unidade...';
  if (el.unidade) el.unidade.value = safe;
  document.querySelectorAll('#alunoUnidadeDropdownMenu .bou-dd-item[data-unidade]').forEach((node) => {
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

function updateAlunosText() {
  if (!el.alunosDropdownText || !el.alunos) return;
  const list = Array.from(selectedAlunos);
  el.alunos.value = list.join(' || ');

  if (!list.length) {
    el.alunosDropdownText.textContent = 'Selecionar alunos...';
    return;
  }

  if (list.length <= 2) {
    el.alunosDropdownText.textContent = list.join(', ');
    return;
  }

  el.alunosDropdownText.textContent = `${list.length} alunos selecionados`;
}

function renderAlunosDropdown() {
  if (!el.alunosDropdownMenu) return;
  el.alunosDropdownMenu.innerHTML = '';

  if (!alunoOptions.length) {
    el.alunosDropdownMenu.innerHTML = '<div class="approvals-empty">Nenhum aluno disponível.</div>';
    return;
  }

  alunoOptions.forEach((value, idx) => {
    const checked = selectedAlunos.has(value);
    const item = document.createElement('label');
    item.className = `bou-dd-item ${idx % 2 === 0 ? 'tone-a' : 'tone-b'} voo-dd-check-item`;
    item.innerHTML =
      '<span class="voo-dd-check-left">' +
      `<input type="checkbox" class="aluno-lista-check" value="${value.replace(/"/g, '&quot;')}" ${checked ? 'checked' : ''}>` +
      `<span>${value}</span>` +
      '</span>' +
      `<i class="fas fa-check${checked ? '' : ' is-hidden'}"></i>`;
    el.alunosDropdownMenu.appendChild(item);
  });

  el.alunosDropdownMenu.querySelectorAll('.aluno-lista-check').forEach((input) => {
    input.addEventListener('change', () => {
      const value = String(input.value || '').trim();
      if (!value) return;
      if (input.checked) selectedAlunos.add(value);
      else selectedAlunos.delete(value);

      const icon = input.closest('.voo-dd-check-item') ? input.closest('.voo-dd-check-item').querySelector('i') : null;
      if (icon) icon.classList.toggle('is-hidden', !input.checked);
      updateAlunosText();
    });
  });
}

function setupAlunosDropdown() {
  if (!el.alunosDropdown || !el.alunosDropdownBtn || !el.alunosDropdownMenu) return;

  const setOpen = (open) => {
    el.alunosDropdown.classList.toggle('is-open', open);
    el.alunosDropdownBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  el.alunosDropdownBtn.addEventListener('click', () => {
    const isOpen = el.alunosDropdown.classList.contains('is-open');
    setOpen(!isOpen);
  });

  document.addEventListener('click', (event) => {
    if (!el.alunosDropdown.contains(event.target)) setOpen(false);
  });
}

async function loadCurrentUserName() {
  const { client, user } = await getCurrentUser();
  if (!client || !user || !el.avaliador) return;

  const profileResult = await client
    .from('profiles')
    .select('nome_guerra, rg')
    .eq('id', user.id)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) {
    el.avaliador.value = user.email || '';
    return;
  }

  el.avaliador.value = formatEquipeOption(profileResult.data) || (user.email || '');
}

async function loadAlunosOptions() {
  const { client, user } = await getCurrentUser();
  if (!client || !user) return;

  const result = await client
    .from('profiles')
    .select('nome_guerra, rg, cargo, aprovado')
    .eq('aprovado', true)
    .order('nome_guerra', { ascending: true });

  if (result.error || !Array.isArray(result.data)) {
    setStatus('Falha ao carregar lista de alunos.', true);
    return;
  }

  alunoOptions = result.data
    .filter((p) => normalizeText(p.cargo || '') === 'agente aluno')
    .map(formatEquipeOption)
    .filter(Boolean);

  renderAlunosDropdown();
  updateAlunosText();
}

function buildPayload() {
  const campos = {
    policial_responsavel: String(el.avaliador && el.avaliador.value ? el.avaliador.value : '').trim(),
    data: String(el.data && el.data.value ? el.data.value : '').trim(),
    horario: String(el.hora && el.hora.value ? el.hora.value : '').trim(),
    unidade: String(el.unidade && el.unidade.value ? el.unidade.value : '').trim(),
    alunos: Array.from(selectedAlunos),
    disciplina_postura: getRadioValue('aluno-disciplina'),
    conhecimento_aprendizado: getRadioValue('aluno-conhecimento'),
    equipe_comunicacao: getRadioValue('aluno-equipe'),
    avaliacao_geral: getRadioValue('aluno-geral'),
    observacoes: String(el.observacoes && el.observacoes.value ? el.observacoes.value : '').trim()
  };

  const titulo = `Relatório aluno - ${campos.data || 'sem data'} ${campos.horario || ''}`.trim();

  const texto = [
    '# RELATÓRIO DE AVALIAÇÃO DE ALUNO',
    '',
    `Policial responsável: ${campos.policial_responsavel || 'N/A'}`,
    `Data: ${campos.data || 'N/A'}`,
    `Horário: ${campos.horario || 'N/A'}`,
    `Unidade: ${campos.unidade || 'N/A'}`,
    `Alunos: ${campos.alunos.length ? campos.alunos.join(', ') : 'N/A'}`,
    '',
    `Disciplina e postura: ${campos.disciplina_postura || 'N/A'}`,
    `Conhecimento e aprendizado: ${campos.conhecimento_aprendizado || 'N/A'}`,
    `Trabalho em equipe e comunicação: ${campos.equipe_comunicacao || 'N/A'}`,
    `Avaliação geral: ${campos.avaliacao_geral || 'N/A'}`,
    '',
    'Observações:',
    campos.observacoes || 'N/A'
  ].join('\n');

  return {
    titulo,
    texto,
    detalhes: [
      `Data/Hora: ${campos.data || 'N/A'} ${campos.horario || ''}`.trim(),
      `Unidade: ${campos.unidade || 'N/A'}`,
      `Alunos avaliados: ${campos.alunos.length}`,
      `Avaliação geral: ${campos.avaliacao_geral || 'N/A'}`
    ].join(' | '),
    conteudo_completo: JSON.stringify({
      texto_original: texto,
      data_envio: new Date().toISOString(),
      campos
    })
  };
}

async function saveRelatorio(payload) {
  const { client, user, error } = await getCurrentUser();
  if (!client || !user) throw new Error(error || 'Sem sessão válida.');

  if (currentEditId) {
    const upd = await client
      .from('relatorios_aluno')
      .update(payload)
      .eq('id', Number(currentEditId))
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (upd.error) throw new Error(`Falha ao atualizar relatório aluno: ${upd.error.message}`);
    if (!upd.data) throw new Error('Relatório aluno não encontrado para edição.');
    return upd.data.id;
  }

  const ins = await client
    .from('relatorios_aluno')
    .insert({ user_id: user.id, ...payload })
    .select('id')
    .single();

  if (ins.error) throw new Error(`Falha ao salvar relatório aluno: ${ins.error.message}`);
  return ins.data.id;
}

async function submitRelatorio() {
  try {
    const payload = buildPayload();
    const campos = JSON.parse(payload.conteudo_completo).campos;

    if (!campos.policial_responsavel || !campos.data || !campos.horario || !campos.unidade) {
      setStatus('Preencha policial responsável, data, horário e unidade.', true);
      return;
    }

    if (!isValidHour24(campos.horario)) {
      setStatus('Use horário no formato 24 horas (HH:MM).', true);
      return;
    }

    if (!campos.alunos.length) {
      setStatus('Selecione ao menos um aluno.', true);
      return;
    }

    if (!campos.disciplina_postura || !campos.conhecimento_aprendizado || !campos.equipe_comunicacao || !campos.avaliacao_geral) {
      setStatus('Preencha todas as avaliações (Disciplina, Conhecimento, Equipe e Geral).', true);
      return;
    }

    setStatus('Salvando relatório aluno...');
    const id = await saveRelatorio(payload);
    setStatus(currentEditId ? `Relatório aluno #${id} atualizado com sucesso.` : `Relatório aluno #${id} salvo com sucesso.`);
  } catch (e) {
    setStatus(e.message || 'Falha ao salvar relatório aluno.', true);
  }
}

function clearForm() {
  if (el.data) el.data.value = getNowDateValue();
  if (el.hora) el.hora.value = getNowTimeValue();
  if (el.observacoes) el.observacoes.value = '';

  applyUnidadeSelection('', 'Selecionar unidade...');

  selectedAlunos.clear();
  renderAlunosDropdown();
  updateAlunosText();

  ['aluno-disciplina', 'aluno-conhecimento', 'aluno-equipe', 'aluno-geral'].forEach((name) => setRadioValue(name, ''));
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
    .from('relatorios_aluno')
    .select('*')
    .eq('id', Number(currentEditId))
    .eq('user_id', user.id)
    .maybeSingle();

  if (result.error || !result.data) {
    setStatus('Não foi possível carregar este relatório para edição.', true);
    return;
  }

  let campos = null;
  try {
    const parsed = result.data.conteudo_completo ? JSON.parse(result.data.conteudo_completo) : null;
    campos = parsed && parsed.campos ? parsed.campos : null;
  } catch (e) {
    campos = null;
  }

  if (!campos) {
    setStatus('Conteúdo do relatório inválido para edição.', true);
    return;
  }

  if (el.avaliador) el.avaliador.value = campos.policial_responsavel || '';
  if (el.data) el.data.value = campos.data || '';
  if (el.hora) el.hora.value = campos.horario || '';

  applyUnidadeSelection(campos.unidade || '', campos.unidade || 'Selecionar unidade...');

  selectedAlunos.clear();
  (Array.isArray(campos.alunos) ? campos.alunos : String(campos.alunos || '').split(' || '))
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .forEach((s) => selectedAlunos.add(s));

  renderAlunosDropdown();
  updateAlunosText();

  setRadioValue('aluno-disciplina', campos.disciplina_postura || '');
  setRadioValue('aluno-conhecimento', campos.conhecimento_aprendizado || '');
  setRadioValue('aluno-equipe', campos.equipe_comunicacao || '');
  setRadioValue('aluno-geral', campos.avaliacao_geral || '');

  if (el.observacoes) el.observacoes.value = campos.observacoes || '';

  if (el.btnEnviar) el.btnEnviar.textContent = 'Atualizar relatório aluno';
  setStatus(`Editando relatório aluno #${currentEditId}.`);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupUnidadeDropdown();
  setupAlunosDropdown();
  applyUnidadeSelection('', 'Selecionar unidade...');

  if (el.data && !el.data.value) el.data.value = getNowDateValue();
  if (el.hora && !el.hora.value) el.hora.value = getNowTimeValue();

  if (el.btnEnviar) el.btnEnviar.addEventListener('click', submitRelatorio);
  if (el.btnLimpar) el.btnLimpar.addEventListener('click', clearForm);
  if (el.hora) {
    el.hora.addEventListener('input', () => {
      el.hora.value = normalizeHourInput(el.hora.value);
    });
  }

  setStatus('Pronto para enviar.');
  await loadCurrentUserName();
  await loadAlunosOptions();
  await loadForEdit();
});
