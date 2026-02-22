(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);

  const el = {
    status: byId('enviosStatus'),
    lista: byId('listaEnvios'),
    contador: byId('contadorEnvios'),
    listaTodos: byId('listaEnviosTodos'),
    contadorTodos: byId('contadorEnviosTodos'),
    statusTodos: byId('enviosTodosStatus'),
    btnEnviarSelecionado: byId('btnEnviarSelecionado'),
    btnLimparSelecionado: byId('btnLimparSelecionado')
  };

  let supabaseClient = null;
  let currentUser = null;
  let bous = [];
  let allBous = [];
  let profileMap = new Map();
  const hiddenStoragePrefix = 'bouEnviosHiddenIds:';
  const sentStoragePrefix = 'bouEnviosSentIds:';
  const lastSentStorageKey = 'bouLastSentTitle';

  const hiddenKey = () => `${hiddenStoragePrefix}${currentUser ? currentUser.id : 'anon'}`;
  const sentKey = () => `${sentStoragePrefix}${currentUser ? currentUser.id : 'anon'}`;

  const readHiddenIds = () => {
    try {
      const raw = localStorage.getItem(hiddenKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [];
    } catch (err) {
      return [];
    }
  };

  const writeHiddenIds = (ids) => {
    try {
      localStorage.setItem(hiddenKey(), JSON.stringify(ids));
    } catch (err) {
      // noop
    }
  };

  const readSentIds = () => {
    try {
      const raw = localStorage.getItem(sentKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [];
    } catch (err) {
      return [];
    }
  };

  const writeSentIds = (ids) => {
    try {
      localStorage.setItem(sentKey(), JSON.stringify(ids));
    } catch (err) {
      // noop
    }
  };

  const setStatus = (msg, isError = false) => {
    if (!el.status) return;
    el.status.textContent = msg;
    el.status.style.color = isError ? '#b42318' : '#166534';
  };

  const setStatusTodos = (msg, isError = false) => {
    if (!el.statusTodos) return;
    el.statusTodos.textContent = msg;
    el.statusTodos.style.color = isError ? '#b42318' : '#475569';
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR');
  };

  const safeText = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const parseConteudo = (conteudoCompleto) => {
    if (!conteudoCompleto) return { texto_original: '', campos: {} };

    if (typeof conteudoCompleto === 'object') {
      return conteudoCompleto;
    }

    try {
      const parsed = JSON.parse(conteudoCompleto);
      return typeof parsed === 'object' && parsed ? parsed : { texto_original: String(conteudoCompleto), campos: {} };
    } catch (err) {
      return { texto_original: String(conteudoCompleto), campos: {} };
    }
  };

  const getTituloFromItem = (item) => {
    if (!item) return '';
    const payload = parseConteudo(item.conteudo_completo);
    const c = payload.campos || {};
    return String(c.titulo || item.titulo || '').trim();
  };

  const formatResponsavel = (userId) => {
    const profile = profileMap.get(String(userId || ''));
    if (!profile) return 'Usuário não identificado';
    const nome = profile.nome_guerra ? String(profile.nome_guerra).trim() : '';
    const rg = profile.rg ? String(profile.rg).trim() : '';
    if (nome && rg) return `${nome} - ${rg}`;
    return nome || rg || (profile.email ? String(profile.email).trim() : 'Usuário não identificado');
  };

  const buildDetailHtml = (payload) => {
    const c = payload.campos || {};
    return `
      <div class="bou-grid bou-envio-content" style="margin-top:10px;">
        <div><label>Unidade</label><input type="text" value="${safeText(c.unidade || '')}" readonly></div>
        <div><label>Motorista</label><input type="text" value="${safeText(c.motorista || '')}" readonly></div>
        <div><label>Chefe de viatura</label><input type="text" value="${safeText(c.chefe || '')}" readonly></div>
        <div><label>Terceiro Homem</label><input type="text" value="${safeText(c.terceiro || '')}" readonly></div>
        <div><label>Quarto Homem</label><input type="text" value="${safeText(c.quarto || '')}" readonly></div>
        <div><label>Acusado</label><input type="text" value="${safeText(c.nome_acusado || '')}" readonly></div>
        <div><label>RG</label><input type="text" value="${safeText(c.rg_acusado || '')}" readonly></div>
        <div><label>Natureza</label><input type="text" value="${safeText(c.natureza || '')}" readonly></div>
        <div><label>Data/Hora</label><input type="text" value="${safeText(c.datahora || '')}" readonly></div>
        <div><label>Local</label><input type="text" value="${safeText(c.local || '')}" readonly></div>
        <div><label>Envolvidos</label><input type="text" value="${safeText(c.envolvidos || '')}" readonly></div>
        <div><label>Resultado</label><input type="text" value="${safeText(c.resultado || '')}" readonly></div>
        <div><label>Material</label><input type="text" value="${safeText(c.material || '')}" readonly></div>
        <div><label>Veiculo</label><input type="text" value="${safeText(c.veiculo || '')}" readonly></div>
        <div><label>Coloracao</label><input type="text" value="${safeText(c.cor_veiculo || '')}" readonly></div>
        <div class="bou-grid-span"><label>Acoes dos policiais e do individuo</label><textarea class="bou-output" readonly>${safeText(c.acoes || '')}</textarea></div>
        <div class="bou-grid-span"><label>Relato dos Fatos</label><textarea class="bou-output" readonly>${safeText(c.relato || '')}</textarea></div>
        <div class="bou-grid-span"><label>Assinatura</label><input type="text" value="${safeText(c.assinatura || '')}" readonly></div>
        <details class="bou-grid-span bou-original-details">
          <summary>Texto Original</summary>
          <textarea class="bou-output" readonly>${safeText(payload.texto_original || '')}</textarea>
        </details>
      </div>
    `;
  };

  const pickMostRecent = (items) => {
    if (!Array.isArray(items) || !items.length) return null;
    const withTs = items.map((item) => {
      const ts = item && item.data_criacao ? new Date(item.data_criacao).getTime() : NaN;
      return { item, ts };
    });
    withTs.sort((a, b) => {
      if (Number.isFinite(a.ts) && Number.isFinite(b.ts)) return b.ts - a.ts;
      if (Number.isFinite(a.ts)) return -1;
      if (Number.isFinite(b.ts)) return 1;
      const aId = Number(a.item && a.item.id);
      const bId = Number(b.item && b.item.id);
      if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
      return 0;
    });
    return withTs[0].item || null;
  };

  const storeLastSent = (items) => {
    const chosen = pickMostRecent(items);
    if (!chosen) return;
    const titulo = getTituloFromItem(chosen);
    try {
      localStorage.setItem(lastSentStorageKey, JSON.stringify({
        titulo,
        id: chosen.id || null,
        data_criacao: chosen.data_criacao || null,
        stored_at: new Date().toISOString()
      }));
    } catch (err) {
      // noop
    }
  };

  const storeSentIds = (ids) => {
    const safeIds = (Array.isArray(ids) ? ids : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (!safeIds.length) return;
    const current = new Set(readSentIds());
    safeIds.forEach((id) => current.add(id));
    writeSentIds(Array.from(current));
  };

  const getSelectedItems = () => {
    const ids = Array.from(document.querySelectorAll('input[name="envioSelecionado"]:checked')).map((n) => Number(n.value));
    return bous.filter((item) => ids.includes(item.id));
  };

  const render = () => {
    const hiddenIds = new Set(readHiddenIds());
    const visibleBous = bous.filter((item) => !hiddenIds.has(Number(item.id)));

    if (el.contador) el.contador.textContent = String(visibleBous.length);
    if (!el.lista) return;

    if (!visibleBous.length) {
      el.lista.innerHTML = '<p class="bou-hint">Nenhum BOU salvo no banco.</p>';
      return;
    }

    el.lista.innerHTML = visibleBous
      .map((item) => {
        const payload = parseConteudo(item.conteudo_completo);
        const c = payload.campos || {};
        const titulo = c.titulo || item.titulo || '(Sem titulo)';
        const nomeAcusado = c.nome_acusado || 'N/A';
        const rgAcusado = c.rg_acusado || 'N/A';
        const dataExibicao = item.data_criacao || item.created_at || '';
        return `
          <details class="bou-envio-item">
            <summary class="bou-envio-summary">
              <div class="bou-envio-summary-main">
                <strong>${safeText(titulo)}</strong>
                <span>${safeText(formatDate(dataExibicao))}</span>
                <span>${safeText(nomeAcusado)} - ${safeText(rgAcusado)}</span>
              </div>
              <div class="bou-envio-summary-actions">
                <label class="auth-check" style="margin:0;">
                  <input type="checkbox" name="envioSelecionado" value="${item.id}">
                  Selecionar
                </label>
                <button class="bou-btn bou-btn-secondary btn-copiar-discord" type="button" data-copy-id="${item.id}">Copiar</button>
                <button class="bou-btn bou-btn-secondary btn-editar-bou" type="button" data-edit-id="${item.id}">Editar BOU</button>
                <i class="fas fa-chevron-down bou-envio-arrow" aria-hidden="true"></i>
              </div>
            </summary>
            ${buildDetailHtml(payload)}
          </details>
        `;
      })
      .join('');

    el.lista.querySelectorAll('.bou-envio-summary-actions').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    });

    el.lista.querySelectorAll('.btn-editar-bou').forEach((btn) => {
      btn.addEventListener('click', () => {
        const editId = btn.getAttribute('data-edit-id');
        window.location.href = `bou.html?edit=${encodeURIComponent(editId)}`;
      });
    });

    el.lista.querySelectorAll('.btn-copiar-discord').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const copyId = Number(btn.getAttribute('data-copy-id'));
        const item = bous.find((entry) => Number(entry.id) === copyId);
        if (!item) {
          setStatus('BOU nao encontrado para copiar.', true);
          return;
        }
        await copyDiscordText(item);
      });
    });
  };

  const loadBous = async () => {
    if (!supabaseClient || !currentUser) return;

    setStatus('Carregando BOUs do banco...');
    setStatusTodos('Carregando BOUs gerais...');
    const [bousRes, profilesRes] = await Promise.all([
      supabaseClient
        .from('bous')
        .select('id, user_id, titulo, conteudo_completo, data_criacao, created_at')
        .order('data_criacao', { ascending: false }),
      supabaseClient
        .from('profiles')
        .select('id, nome_guerra, rg, email')
    ]);

    if (bousRes.error) {
      setStatus(`Falha ao carregar BOUs: ${bousRes.error.message}`, true);
      setStatusTodos('Falha ao carregar BOUs gerais.', true);
      return;
    }

    allBous = Array.isArray(bousRes.data) ? bousRes.data : [];
    profileMap = new Map((Array.isArray(profilesRes.data) ? profilesRes.data : []).map((p) => [String(p.id), p]));
    bous = allBous.filter((item) => String(item.user_id || '') === String(currentUser.id));
    render();
    renderTodos();
    setStatus('Lista atualizada.');
    setStatusTodos('Lista geral atualizada.');
  };

  const renderTodos = () => {
    if (!el.listaTodos) return;
    if (el.contadorTodos) el.contadorTodos.textContent = String(allBous.length);

    if (!allBous.length) {
      el.listaTodos.innerHTML = '<p class="bou-hint">Nenhum BOU encontrado.</p>';
      return;
    }

    el.listaTodos.innerHTML = allBous.map((item) => {
      const payload = parseConteudo(item.conteudo_completo);
      const c = payload.campos || {};
      const titulo = c.titulo || item.titulo || '(Sem titulo)';
      const responsavel = formatResponsavel(item.user_id);
      const citados = (c.envolvidos || '').trim() || 'N/A';
      const preso = (c.nome_acusado || '').trim() || 'N/A';
      const dataExibicao = item.data_criacao || item.created_at || '';

      return `
        <details class="bou-envio-item">
          <summary class="bou-envio-summary">
            <div class="bou-envio-summary-main">
              <strong>${safeText(titulo)}</strong>
              <span>Responsável: ${safeText(responsavel)}</span>
              <span>Citados: ${safeText(citados)}</span>
              <span>${safeText(formatDate(dataExibicao))}</span>
              <span>Preso: ${safeText(preso)}</span>
            </div>
            <i class="fas fa-chevron-down bou-envio-arrow" aria-hidden="true"></i>
          </summary>
          ${buildDetailHtml(payload)}
        </details>
      `;
    }).join('');
  };

  const sendToDiscord = async (items) => {
    if (!items.length) {
      setStatus('Selecione ao menos um BOU para enviar.', true);
      return;
    }

    setStatus('Enviando para o Discord...');

    try {
      const ids = items.map((item) => Number(item.id)).filter((id) => Number.isFinite(id));
      if (!ids.length) {
        throw new Error('IDs de BOU invalidos para envio.');
      }

      const rpcResult = await supabaseClient.rpc('send_bou_to_discord', { p_bou_ids: ids });
      if (rpcResult.error) {
        throw new Error(rpcResult.error.message);
      }

      const queuedCount = rpcResult.data && typeof rpcResult.data.queued_count === 'number'
        ? rpcResult.data.queued_count
        : (rpcResult.data && typeof rpcResult.data.sent_count === 'number' ? rpcResult.data.sent_count : ids.length);

      const requestIds = rpcResult.data && Array.isArray(rpcResult.data.request_ids)
        ? rpcResult.data.request_ids.filter((id) => Number.isFinite(Number(id)))
        : [];

      const logPart = requestIds.length ? ` ReqIDs: ${requestIds.join(', ')}.` : '';
      setStatus(`Envio enfileirado com sucesso (${queuedCount}).${logPart}`);
      storeLastSent(items);
      storeSentIds(ids);
    } catch (err) {
      setStatus(`Falha no envio ao Discord: ${err.message}`, true);
    }
  };

  const discordMessageForItem = (item) => {
    const payload = parseConteudo(item.conteudo_completo);
    const c = payload.campos || {};
    const joinedActions = c.acoes_lista && Array.isArray(c.acoes_lista)
      ? c.acoes_lista.map((entry) => '- ' + String(entry || '').trim()).join('\n')
      : '';
    const acoesFinal = [joinedActions, c.acoes_observacoes || c.acoes || '']
      .filter((p) => p && String(p).trim())
      .join('\n');

    const titulo = c.titulo || item.titulo || 'N/A';
    const unidade = c.unidade || 'N/A';
    const motorista = c.motorista || 'N/A';
    const chefe = c.chefe || 'N/A';
    const terceiro = c.terceiro || 'N/A';
    const quarto = c.quarto || 'N/A';
    const nomeAcusado = c.nome_acusado || 'N/A';
    const rgAcusado = c.rg_acusado || 'N/A';
    const natureza = c.natureza || 'N/A';
    const dataHora = c.datahora || 'N/A';
    const localExato = c.local_exato || c.local || 'N/A';
    const envolvidos = c.envolvidos || 'N/A';
    const resultado = c.resultado || 'N/A';
    const material = c.material || 'N/A';
    const veiculo = c.veiculo || 'N/A';
    const corVeiculo = c.cor_veiculo || 'N/A';
    const relato = c.relato || 'N/A';
    const assinatura = c.assinatura || 'N/A';

    return [
      '# BOLETIM DE OCORRÊNCIA UNIFICADO - BOU',
      '',
      `${titulo}`,
      '',
      '# Dados da Equipe',
      `Unidade: ${unidade}`,
      `Motorista: ${motorista}`,
      `Chefe de Viatura: ${chefe}`,
      `Terceiro homem: ${terceiro}`,
      `Quarto homem: ${quarto}`,
      '',
      '# Dados do acusado',
      `Nome do acusado: ${nomeAcusado}`,
      `Rg do acusado: ${rgAcusado}`,
      `Natureza: ${natureza}`,
      '',
      '# Dados da ocorrência',
      `Data/hora: ${dataHora}`,
      `Local exato: ${localExato}`,
      `Pessoas envolvidas: ${envolvidos}`,
      `Ações policiais/indivíduo: ${acoesFinal || 'N/A'}`,
      `Resultado: ${resultado}`,
      `Material apreendido: ${material}`,
      `Veículo: ${veiculo}`,
      `Cor do veículo: ${corVeiculo}`,
      `Relato dos fatos: ${relato}`,
      '',
      `${assinatura}.`
    ].join('\n');
  };

  const copyDiscordText = async (item) => {
    const text = discordMessageForItem(item);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setStatus('Texto copiado para a area de transferencia.');
    } catch (err) {
      setStatus('Falha ao copiar texto do BOU.', true);
    }
  };

  const clearSelectedFromBrowser = () => {
    const ids = Array.from(document.querySelectorAll('input[name="envioSelecionado"]:checked'))
      .map((n) => Number(n.value))
      .filter((id) => Number.isFinite(id));

    if (!ids.length) {
      setStatus('Selecione ao menos um BOU para limpar da lista.', true);
      return;
    }

    const hidden = new Set(readHiddenIds());
    ids.forEach((id) => hidden.add(id));
    writeHiddenIds(Array.from(hidden));
    render();
    setStatus(`${ids.length} item(ns) removido(s) da lista local (somente navegador).`);
  };

  const init = async () => {
    if (!window.supabase || !window.supabase.createClient || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      setStatus('Supabase nao inicializado nesta p?gina.', true);
      return;
    }

    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const sessionResult = await supabaseClient.auth.getSession();
    const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    currentUser = session ? session.user : null;

    if (!currentUser) {
      window.location.replace('../login.html');
      return;
    }

    await loadBous();
  };

  if (el.btnEnviarSelecionado) {
    el.btnEnviarSelecionado.addEventListener('click', async () => {
      const items = getSelectedItems();
      await sendToDiscord(items);
    });
  }

  if (el.btnLimparSelecionado) {
    el.btnLimparSelecionado.addEventListener('click', clearSelectedFromBrowser);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
