(() => {
  'use strict';

  const data = {
    period: 'JANEIRO A DEZEMBRO DE 2026',
    news: [],
    numbers: [
      { value: '2.810', label: 'ABORDAGENS REALIZADAS', icon: 'assets/img/car.png' },
      { value: '940', label: 'OCORRÊNCIAS ATENDIDAS', icon: 'assets/img/shield.png' },
      { value: '386', label: 'PRISÕES REALIZADAS', icon: 'assets/img/aim.png' },
      { value: '267.509', label: 'REAIS EM MULTAS APLICADAS', icon: 'assets/img/cash.png' },
      { value: '49.911', label: 'KM PATRULHADOS', icon: 'assets/img/road.png' },      
    ],

    
  };

  const state = {
    news: { page: 1, perPage: 6 },
    videos: { page: 1, perPage: 3 },
    cultural: { page: 1, perPage: 3 },
    community: { page: 1, perPage: 3 },
    education: { page: 1, perPage: 3 }
  };

  const byId = (id) => document.getElementById(id);
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const DEFAULT_SUPABASE_URL = 'https://pssujmmuachdymlwsiuj.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_PYQxZQr_TfVEesG7L4WI4g_-VjPHVpW';

  const ensureSupabaseGlobals = () => {
    if (!window.SUPABASE_URL) window.SUPABASE_URL = DEFAULT_SUPABASE_URL;
    if (!window.SUPABASE_ANON_KEY) window.SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;
  };

  const ensureSupabaseLibrary = async () => {
    ensureSupabaseGlobals();
    if (window.supabase && window.supabase.createClient) return true;

    const existing = document.querySelector(`script[src="${SUPABASE_CDN}"]`);
    if (existing) {
      await new Promise((resolve) => {
        if (window.supabase && window.supabase.createClient) {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', resolve, { once: true });
      });
      return Boolean(window.supabase && window.supabase.createClient);
    }

    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = SUPABASE_CDN;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });

    return Boolean(window.supabase && window.supabase.createClient);
  };

  const createSupabaseClient = async (options = null) => {
    const hasLib = await ensureSupabaseLibrary();
    if (!hasLib || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, options || undefined);
  };

  const escapeHtml = (value) => {
    if (!value) return '';
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const formatNumber = (value, template) => {
    const digits = String(value).replace(/\D/g, '');
    const formatted = Number(digits).toLocaleString('pt-BR');
    if (!template) return formatted;
    return template.replace(/[0-9.]+/g, formatted);
  };

  const animateOdometer = (element) => {
    if (!element) return;
    const targetRaw = element.getAttribute('data-target') || element.textContent;
    const digits = String(targetRaw).replace(/\D/g, '');
    const target = Number(digits);
    if (!Number.isFinite(target)) return;

    const duration = 3500;
    const startTime = window.performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      element.textContent = formatNumber(current, targetRaw);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  };

  const updateNumbersGridLayout = () => {
    const grid = byId('numbers-grid');
    if (!grid) return;
    const count = Array.isArray(data.numbers) ? data.numbers.length : 0;
    const safeCount = Math.max(1, count);
    const width = window.innerWidth;
    let columns = Math.min(safeCount, 5);

    if (width <= 768) {
      columns = Math.min(safeCount, 2);
    } else if (width <= 1200) {
      columns = Math.min(safeCount, 3);
    }

    grid.style.setProperty('grid-template-columns', `repeat(${columns}, minmax(200px, 1fr))`, 'important');
    grid.style.setProperty('justify-content', 'center');
  };

  const renderNumbers = () => {
    const grid = byId('numbers-grid');
    const period = byId('numbers-period');
    if (!grid) return;
    updateNumbersGridLayout();
    if (period) {
      period.textContent = data.period ? `(${data.period})` : '';
    }
    grid.innerHTML = data.numbers
      .map((item) => {
        const value = escapeHtml(item.value);
        const label = escapeHtml(item.label);
        const description = escapeHtml(item.description);
        const icon = item.icon
          ? `<div class="number-icon"><img src="${escapeHtml(item.icon)}" alt="${label || 'ícone'}" loading="lazy"></div>`
          : '';
        return `
          <div class="number-item">
            ${icon}
            <div class="number-value" data-target="${value}">0</div>
            ${label ? `<div class="number-unit">${label}</div>` : ''}
            ${description ? `<div class="number-description">${description}</div>` : ''}
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.number-value').forEach(animateOdometer);
  };

  const newsCard = (item) => {
    const image = item.image
      ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'news-placeholder\\'><i class=\\'fas fa-newspaper\\'></i></div>'">`
      : `<div class="news-placeholder"><i class="fas fa-newspaper"></i></div>`;
    return `
      <article class="news-item">
        <div class="news-image">${image}</div>
        <div class="news-content">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <span class="news-date">${escapeHtml(item.date)}</span>
        </div>
      </article>
    `;
  };

  const videoCard = (item) => {
    const image = item.image
      ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'news-placeholder\\'><i class=\\'fas fa-video\\'></i></div>'">`
      : `<div class="news-placeholder"><i class="fas fa-video"></i></div>`;
    return `
      <article class="news-item">
        <div class="news-image">${image}</div>
        <div class="news-content">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <span class="news-date">${escapeHtml(item.date)}</span>
        </div>
      </article>
    `;
  };

  const activityCard = (item) => {
    const image = item.image
      ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'activity-placeholder\\'><i class=\\'fas fa-calendar-alt\\'></i></div>'">`
      : `<div class="activity-placeholder"><i class="fas fa-calendar-alt"></i></div>`;
    return `
      <article class="activity-item">
        <div class="activity-image">${image}</div>
        <div class="activity-content">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <span class="activity-date">${escapeHtml(item.date)}</span>
        </div>
      </article>
    `;
  };

  const renderPagination = (items, key, pageNumbersId, pageInfoId, paginationId) => {
    const totalPages = Math.max(1, Math.ceil(items.length / state[key].perPage));
    state[key].page = clamp(state[key].page, 1, totalPages);

    const pagination = byId(paginationId);
    const pageNumbers = byId(pageNumbersId);
    const pageInfo = byId(pageInfoId);

    if (pageInfo) {
      pageInfo.textContent = `P?gina ${state[key].page} de ${totalPages}`;
    }

    if (pageNumbers) {
      pageNumbers.innerHTML = '';
      if (totalPages > 1) {
        for (let i = 1; i <= totalPages; i += 1) {
          const button = document.createElement('button');
          button.className = 'pagination-number';
          if (i === state[key].page) {
            button.classList.add('active');
          }
          button.textContent = i;
          button.onclick = () => setPage(key, i);
          pageNumbers.appendChild(button);
        }
      }
    }

    if (pagination) {
      pagination.classList.toggle('hidden', totalPages <= 1);
    }

    const prevBtn = byId(`${key}-prev-btn`);
    const nextBtn = byId(`${key}-next-btn`);
    if (prevBtn) prevBtn.disabled = state[key].page <= 1;
    if (nextBtn) nextBtn.disabled = state[key].page >= totalPages;

    return totalPages;
  };

  const renderNews = () => {
    const grid = byId('news-grid');
    if (!grid) return;
    const items = Array.isArray(data.news) ? data.news : [];
    grid.innerHTML = items.map(newsCard).join('');
  };

  const MULTAS_LABEL = 'REAIS EM MULTAS APLICADAS';
  const OCORRENCIAS_LABEL = 'OCORRÊNCIAS ATENDIDAS';
  const ABORDAGENS_LABEL = 'ABORDAGENS REALIZADAS';
  const PRISOES_LABEL = 'PRISÕES REALIZADAS';
  const KM_LABEL = 'KM PATRULHADOS';

  const parsePtBrNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    const normalized = raw
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  };

  const getCounterItem = (label) => data.numbers.find((item) => item.label === label);

  const applyCounterValue = (label, value) => {
    const item = getCounterItem(label);
    if (!item) return;
    const safeTotal = Math.max(0, Math.round(Number(value) || 0));
    item.value = safeTotal.toLocaleString('pt-BR');
  };

  const applyKpisToNumbers = (kpis) => {
    if (!kpis) return;
    if (kpis.abordagens !== undefined) applyCounterValue(ABORDAGENS_LABEL, kpis.abordagens);
    if (kpis.ocorrencias !== undefined) applyCounterValue(OCORRENCIAS_LABEL, kpis.ocorrencias);
    if (kpis.prisoes !== undefined) applyCounterValue(PRISOES_LABEL, kpis.prisoes);
    if (kpis.multas !== undefined) applyCounterValue(MULTAS_LABEL, kpis.multas);
    if (kpis.km !== undefined) applyCounterValue(KM_LABEL, kpis.km);
  };

  const applyKpisDeltaLocal = (deltas = {}) => {
    const next = {
      abordagens: parsePtBrNumber(getCounterItem(ABORDAGENS_LABEL)?.value || 0) + (Number(deltas.abordagens) || 0),
      ocorrencias: parsePtBrNumber(getCounterItem(OCORRENCIAS_LABEL)?.value || 0) + (Number(deltas.ocorrencias) || 0),
      prisoes: parsePtBrNumber(getCounterItem(PRISOES_LABEL)?.value || 0) + (Number(deltas.prisoes) || 0),
      multas: parsePtBrNumber(getCounterItem(MULTAS_LABEL)?.value || 0) + (Number(deltas.multas) || 0),
      km: parsePtBrNumber(getCounterItem(KM_LABEL)?.value || 0) + (Number(deltas.km) || 0)
    };
    applyKpisToNumbers(next);
  };

  const syncKpisFromServer = async () => {
    try {
      const client = await createSupabaseClient();
      if (!client) return;
      const result = await client
        .from('kpis')
        .select('abordagens, ocorrencias, prisoes, multas, km')
        .eq('id', 1)
        .maybeSingle();
      if (result.error || !result.data) return;
      applyKpisToNumbers(result.data);
    } catch (err) {
      /* ignore */
    }
  };

  const incrementKpisRemote = async (deltas = {}) => {
    try {
      const client = await createSupabaseClient();
      if (!client) return;
      const rpc = await client.rpc('increment_kpis', { p_delta: deltas });
      if (rpc && rpc.data) {
        applyKpisToNumbers(rpc.data);
      }
    } catch (err) {
      /* ignore */
    }
  };

  const incrementMultasTotal = (delta) => {
    const deltas = { multas: Number(delta) || 0 };
    applyKpisDeltaLocal(deltas);
    incrementKpisRemote(deltas);
  };

  window.incrementMultasTotal = incrementMultasTotal;
  window.incrementPatrulhaTotals = (deltas = {}) => {
    applyKpisDeltaLocal(deltas);
    incrementKpisRemote(deltas);
  };

  const renderVideos = () => {
    const grid = byId('videos-190-grid');
    if (!grid) return;
    renderPagination(data.videos, 'videos', 'videos-page-numbers', 'videos-page-info', 'videos-pagination');
    const start = (state.videos.page - 1) * state.videos.perPage;
    const pageItems = data.videos.slice(start, start + state.videos.perPage);
    grid.innerHTML = pageItems.map(videoCard).join('');
  };

  const renderActivities = (key, gridId, pageNumbersId, pageInfoId, paginationId) => {
    const grid = byId(gridId);
    if (!grid) return;
    const items = data.activities[key] || [];
    renderPagination(items, key, pageNumbersId, pageInfoId, paginationId);
    const start = (state[key].page - 1) * state[key].perPage;
    const pageItems = items.slice(start, start + state[key].perPage);
    grid.innerHTML = pageItems.map(activityCard).join('');
  };

  const setPage = (key, page) => {
    state[key].page = page;
    switch (key) {
      case 'news':
        renderNews();
        break;
      case 'videos':
        renderVideos();
        break;
      case 'cultural':
        renderActivities('cultural', 'cultural-activities-grid', 'cultural-page-numbers', 'cultural-page-info', 'cultural-pagination');
        break;
      case 'community':
        renderActivities('community', 'community-activities-grid', 'community-page-numbers', 'community-page-info', 'community-pagination');
        break;
      default:
        break;
    }
  };

  const setupMobileMenu = () => {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => nav.classList.toggle('active'));

    const dropdowns = document.querySelectorAll('.nav-dropdown > .nav-link-dropdown');
    const closeAll = (except) => {
      document.querySelectorAll('.nav-dropdown.active').forEach((wrapper) => {
        if (except && wrapper === except) return;
        wrapper.classList.remove('active');
        const link = wrapper.querySelector('.nav-link-dropdown');
        if (link) link.setAttribute('aria-expanded', 'false');
      });
    };
    dropdowns.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const wrapper = trigger.closest('.nav-dropdown');
        if (!wrapper) return;
        const willOpen = !wrapper.classList.contains('active');
        closeAll(wrapper);
        wrapper.classList.toggle('active', willOpen);
        trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.nav-dropdown')) closeAll();
    });
  };

  const rewriteNavLinks = () => {
    const replacements = {
      '#organograma': 'organograma.html',
      '/organograma': 'organograma.html',
      '#capacitacao': 'capacitacao.html',
      '/capacitacao': 'capacitacao.html',
      '#historia-valores': 'historia-valores.html',
      '/historia-valores': 'historia-valores.html',
      '#documentos': 'documentos.html',
      '/documentos': 'documentos.html',
      '#preencher-bou': 'preencher-bou.html',
      '/preencher-bou': 'preencher-bou.html',
      '#concursos': 'concursos.html',
      '/concursos': 'concursos.html',
      '#diario-oficial': 'diario-oficial.html',
      '/diario-oficial': 'diario-oficial.html',
      '/login': 'login.html',
      '/registro': 'criar-conta.html'
    };

    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href && replacements[href]) {
        link.setAttribute('href', replacements[href]);
      }
      if (href === '#noticias') {
        link.setAttribute('href', 'index.html#noticias');
      }
    });
  };

  const setupAccessibility = () => {
    const alertBtn = byId('alert');

    if (alertBtn) {
      alertBtn.addEventListener('click', () => {
        window.alert('Sem alertas no momento.');
      });
    }
  };

  const setupHeaderAuthState = async () => {
    const loginLink = byId('header-login-btn');
    const registerLink = byId('header-register-btn');
    const userMenu = byId('header-user-menu');
    const userNameNode = userMenu ? userMenu.querySelector('.user-name-header') : null;
    if (!loginLink && !registerLink && !userMenu) return;

    const clearHeaderShiftTimer = () => {
      if (window.__headerShiftTimer) {
        clearInterval(window.__headerShiftTimer);
        window.__headerShiftTimer = null;
      }
    };

    const formatHms = (totalMs) => {
      const safeMs = Math.max(0, Number(totalMs || 0));
      const totalSec = Math.floor(safeMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const showGuest = () => {
      clearHeaderShiftTimer();
      if (loginLink) loginLink.classList.remove('is-hidden');
      if (registerLink) registerLink.classList.remove('is-hidden');
      if (userMenu) userMenu.classList.add('is-hidden');
    };

    const initShiftControl = async (client, userId) => {
      if (!client || !userId) return null;
      if (window.__shiftControl && window.__shiftControlUserId === userId) return window.__shiftControl;

      const listeners = [];
      let currentState = { status: 'idle', startAt: null, shiftId: null, totalMs: null };

      const emit = () => {
        const payload = { ...currentState };
        listeners.forEach((fn) => {
          try { fn(payload); } catch (e) {}
        });
        try {
          window.dispatchEvent(new CustomEvent('shift-state-changed', { detail: payload }));
        } catch (e) {}
      };

      const setState = (next) => {
        currentState = { ...currentState, ...next };
        emit();
      };

      const fetchOpen = async () => {
        const result = await client
          .from('agent_pontos')
          .select('id,inicio_at')
          .eq('user_id', userId)
          .is('fim_at', null)
          .order('inicio_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return result && result.data ? result.data : null;
      };

      const refresh = async () => {
        const openRow = await fetchOpen();
        if (openRow) {
          setState({
            status: 'active',
            shiftId: openRow.id,
            startAt: openRow.inicio_at ? new Date(openRow.inicio_at).getTime() : Date.now(),
            totalMs: null
          });
          return { ...currentState };
        }

        const latestResult = await client
          .from('agent_pontos')
          .select('status,duracao_min')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const latest = latestResult && latestResult.data ? latestResult.data : null;

        if (latest && String(latest.status || '') === 'encerrado') {
          setState({
            status: 'closed',
            shiftId: null,
            startAt: null,
            totalMs: Math.max(0, Number(latest.duracao_min || 0)) * 60000
          });
        } else {
          setState({ status: 'idle', shiftId: null, startAt: null, totalMs: null });
        }
        return { ...currentState };
      };

      const start = async () => {
        if (currentState.status === 'active') return { ...currentState };
        const openRow = await fetchOpen();
        if (openRow) {
          setState({
            status: 'active',
            shiftId: openRow.id,
            startAt: openRow.inicio_at ? new Date(openRow.inicio_at).getTime() : Date.now(),
            totalMs: null
          });
          return { ...currentState };
        }

        const nowIso = new Date().toISOString();
        const insert = await client
          .from('agent_pontos')
          .insert({ user_id: userId, inicio_at: nowIso, status: 'em_servico' })
          .select('id,inicio_at')
          .single();

        if (insert.error || !insert.data) return refresh();

        setState({
          status: 'active',
          shiftId: insert.data.id,
          startAt: insert.data.inicio_at ? new Date(insert.data.inicio_at).getTime() : Date.now(),
          totalMs: null
        });
        return { ...currentState };
      };

      const stop = async () => {
        let shiftId = currentState.shiftId;
        let startAt = currentState.startAt;

        if (!shiftId || !startAt) {
          const openRow = await fetchOpen();
          if (!openRow) return refresh();
          shiftId = openRow.id;
          startAt = openRow.inicio_at ? new Date(openRow.inicio_at).getTime() : Date.now();
        }

        const totalMs = Math.max(0, Date.now() - Number(startAt));
        await client
          .from('agent_pontos')
          .update({
            fim_at: new Date().toISOString(),
            duracao_min: Math.floor(totalMs / 60000),
            status: 'encerrado'
          })
          .eq('id', shiftId)
          .eq('user_id', userId);

        setState({ status: 'closed', shiftId: null, startAt: null, totalMs });
        return { ...currentState };
      };

      const toggle = async () => (currentState.status === 'active' ? stop() : start());
      const subscribe = (fn) => {
        if (typeof fn !== 'function') return () => {};
        listeners.push(fn);
        try { fn({ ...currentState }); } catch (e) {}
        return () => {
          const idx = listeners.indexOf(fn);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      };

      const control = {
        getState: () => ({ ...currentState }),
        refresh,
        start,
        stop,
        toggle,
        subscribe,
        formatHms
      };

      window.__shiftControl = control;
      window.__shiftControlUserId = userId;
      await refresh();
      return control;
    };

    const attachHeaderShiftBadge = async (node, shiftControl) => {
      if (!node || !shiftControl) return;
      clearHeaderShiftTimer();

      const existing = node.querySelector('.user-shift-header');
      if (existing) existing.remove();
      const existingPanel = node.querySelector('.user-panel-link');
      if (existingPanel) existingPanel.remove();

      const painelHref = window.location.pathname.includes('/interno/') ? 'painel.html' : 'interno/painel.html';
      const painelLink = document.createElement('a');
      painelLink.className = 'user-panel-link';
      painelLink.href = painelHref;
      painelLink.textContent = 'Painel';

      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'user-shift-header user-shift-header--idle';
      badge.title = 'Alternar ponto';
      badge.textContent = 'Fora de serviço';
      badge.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await shiftControl.toggle();
      });
      node.prepend(badge);
      node.prepend(painelLink);

      const render = (state) => {
        const s = state || shiftControl.getState();
        if (s.status === 'active' && s.startAt) {
          badge.className = 'user-shift-header user-shift-header--active';
          badge.textContent = `Em serviço ${formatHms(Date.now() - Number(s.startAt))}`;
          return;
        }
        if (s.status === 'closed') {
          badge.className = 'user-shift-header user-shift-header--closed';
          badge.textContent = s.totalMs ? `Serviço encerrado ${formatHms(s.totalMs)}` : 'Serviço encerrado';
          return;
        }
        badge.className = 'user-shift-header user-shift-header--idle';
        badge.textContent = 'Fora de serviço';
      };

      shiftControl.subscribe((state) => render(state));
      window.__headerShiftTimer = setInterval(() => render(shiftControl.getState()), 1000);
    };

    const showAuthenticated = async (name, avatarUrl, client, userId) => {
      if (loginLink) loginLink.classList.add('is-hidden');
      if (registerLink) registerLink.classList.add('is-hidden');
      if (userMenu) userMenu.classList.remove('is-hidden');
      if (userNameNode) {
        const painelHref = window.location.pathname.includes('/interno/') ? 'painel.html' : 'interno/painel.html';
        userNameNode.textContent = '';
        if (avatarUrl) {
          const avatar = document.createElement('img');
          avatar.src = avatarUrl;
          avatar.alt = 'Foto do perfil';
          avatar.className = 'user-mini-avatar';
          userNameNode.appendChild(avatar);
        }
        const textNode = document.createElement('span');
        textNode.className = 'user-name-text';
        textNode.textContent = name || 'Usuario autenticado';
        userNameNode.appendChild(textNode);
        userNameNode.style.cursor = 'pointer';
        userNameNode.setAttribute('title', 'Ir para o painel');
        userNameNode.onclick = () => {
          window.location.href = painelHref;
        };

        const shiftControl = await initShiftControl(client, userId);
        await attachHeaderShiftBadge(userNameNode, shiftControl);
      }
    };

    try {
      const client = await createSupabaseClient();
      if (!client) {
        showGuest();
        return;
      }

      const sessionResult = await client.auth.getSession();
      const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
      const user = session ? session.user : null;
      if (!user) {
        showGuest();
        return;
      }

      const profileResult = await client
        .from('profiles')
        .select('nome_guerra, email, aprovado, foto_url')
        .eq('id', user.id)
        .maybeSingle();

      const profile = profileResult ? profileResult.data : null;
      const profileError = profileResult ? profileResult.error : null;
      if (profileError) {
        await showAuthenticated(user.email || 'Usuario autenticado', '', client, user.id);
        return;
      }
      if (!profile || profile.aprovado !== true) {
        showGuest();
        return;
      }

      await showAuthenticated(profile.nome_guerra || profile.email || user.email, profile.foto_url || '', client, user.id);
    } catch (err) {
      showGuest();
    }
  };

  const setupSupabaseLogin = () => {
    const loginForm = byId('auth-login-form');
    const emailInput = byId('login-email');
    const passwordInput = byId('login-password');
    const rememberInput = byId('login-remember');
    const submitButton = byId('auth-login-submit');
    const feedback = byId('auth-login-feedback');

    if (!loginForm || !emailInput || !passwordInput || !submitButton) return;

    const setFeedback = (message, isError = false) => {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.style.color = isError ? '#b42318' : '#0f5132';
      feedback.style.marginTop = '10px';
      feedback.style.fontWeight = '600';
    };

    const setLoading = (loading) => {
      submitButton.disabled = loading;
      submitButton.style.opacity = loading ? '0.8' : '1';
      submitButton.style.cursor = loading ? 'wait' : 'pointer';
    };

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback('');

      const email = (emailInput.value || '').trim();
      const password = passwordInput.value || '';
      const remember = rememberInput ? Boolean(rememberInput.checked) : true;

      if (!email || !password) {
        setFeedback('Preencha email e senha para continuar.', true);
        return;
      }

      if (!(await ensureSupabaseLibrary())) {
        setFeedback('Biblioteca Supabase n?o foi carregada.', true);
        return;
      }

      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        setFeedback('Configure SUPABASE_URL e SUPABASE_ANON_KEY na p?gina de login.', true);
        return;
      }

      setLoading(true);

      try {
        const client = await createSupabaseClient({
          auth: {
            persistSession: remember,
            autoRefreshToken: remember
          }
        });
        if (!client) {
          setFeedback('Falha ao inicializar cliente de autenticação.', true);
          return;
        }

        const { data: signInData, error } = await client.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          setFeedback('Email ou senha inv?lidos.', true);
          return;
        }

        const userId = signInData && signInData.user ? signInData.user.id : null;
        if (!userId) {
          setFeedback('N?o foi poss?vel validar o usu?rio autenticado.', true);
          return;
        }

        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('aprovado')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          await client.auth.signOut();
          setFeedback('Falha ao validar aprovacao da conta. Contate o administrador.', true);
          return;
        }

        if (!profile || profile.aprovado !== true) {
          await client.auth.signOut();
          setFeedback('Conta pendente de aprovacao do administrador.', true);
          return;
        }

        setFeedback('Login realizado com sucesso. Redirecionando...');
        window.location.href = 'interno/painel.html';
      } catch (err) {
        setFeedback('Falha ao autenticar. Tente novamente.', true);
      } finally {
        setLoading(false);
      }
    });
  };

  const setupSupabaseRegister = () => {
    const registerForm = byId('auth-register-form');
    const nameInput = byId('register-name');
    const emailInput = byId('register-email');
    const passwordInput = byId('register-password');
    const rgInput = byId('register-rg');
    const photoButton = byId('register-photo-btn');
    const photoInput = byId('register-photo-file');
    const photoPreview = byId('register-photo-preview');
    const submitButton = byId('auth-register-submit');
    const feedback = byId('auth-register-feedback');

    if (!registerForm || !nameInput || !emailInput || !passwordInput || !rgInput || !submitButton) return;
    let selectedPhotoFile = null;
    let previewUrl = '';

    const setFeedback = (message, isError = false) => {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.style.color = isError ? '#b42318' : '#0f5132';
      feedback.style.marginTop = '10px';
      feedback.style.fontWeight = '600';
    };

    const setLoading = (loading) => {
      submitButton.disabled = loading;
      submitButton.style.opacity = loading ? '0.8' : '1';
      submitButton.style.cursor = loading ? 'wait' : 'pointer';
    };

    const clearPhotoSelection = () => {
      selectedPhotoFile = null;
      if (photoInput) photoInput.value = '';
      if (photoButton) photoButton.classList.remove('has-photo');
      if (photoPreview) {
        photoPreview.classList.add('is-hidden');
        photoPreview.removeAttribute('src');
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = '';
      }
    };

    if (photoButton && photoInput) {
      photoButton.addEventListener('click', () => {
        photoInput.click();
      });
      photoInput.addEventListener('change', () => {
        const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
        if (!file) {
          clearPhotoSelection();
          return;
        }
        if (!/^image\//i.test(file.type)) {
          setFeedback('Selecione um arquivo de imagem valido para a foto.', true);
          clearPhotoSelection();
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          setFeedback('A foto deve ter no maximo 5MB.', true);
          clearPhotoSelection();
          return;
        }

        selectedPhotoFile = file;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        if (photoPreview) {
          photoPreview.src = previewUrl;
          photoPreview.classList.remove('is-hidden');
        }
        if (photoButton) photoButton.classList.add('has-photo');
        setFeedback('Foto selecionada com sucesso.');
      });
    }

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback('');

      const fullName = (nameInput.value || '').trim();
      const password = passwordInput.value || '';
      const rg = (rgInput.value || '').trim();
      let emailRaw = (emailInput.value || '').trim().toLowerCase();

      if (!fullName || !emailRaw || !password || !rg) {
        setFeedback('Preencha nome, email, senha e RG para continuar.', true);
        return;
      }

      if (!(await ensureSupabaseLibrary())) {
        setFeedback('Biblioteca Supabase n?o foi carregada.', true);
        return;
      }

      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        setFeedback('Configure SUPABASE_URL e SUPABASE_ANON_KEY na p?gina de credenciamento.', true);
        return;
      }

      if (password.length < 6) {
        setFeedback('A senha deve ter no m?nimo 6 caracteres.', true);
        return;
      }

      if (!emailRaw.includes('@')) {
        emailRaw = `${emailRaw}@prf.gov`;
      }

      if (!emailRaw.endsWith('@prf.gov')) {
        setFeedback('Use um email institucional @prf.gov.', true);
        return;
      }

      setLoading(true);

      try {
        const client = await createSupabaseClient({
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        if (!client) {
          setFeedback('Falha ao inicializar cliente de autenticação.', true);
          return;
        }
        const { data: signUpData, error } = await client.auth.signUp({
          email: emailRaw,
          password,
          options: {
            data: {
              full_name: fullName,
              rg
            }
          }
        });

        if (error) {
          setFeedback(`N?o foi poss?vel solicitar acesso: ${error.message}`, true);
          return;
        }

        const createdUser = signUpData && signUpData.user ? signUpData.user : null;
        let photoUploadWarning = '';

        if (createdUser) {
          const { error: profileInsertError } = await client.from('profiles').upsert(
            {
              id: createdUser.id,
              email: emailRaw,
              nome_guerra: fullName,
              rg,
              aprovado: false
            },
            { onConflict: 'id' }
          );

          if (profileInsertError) {
            setFeedback(`Cadastro criado, mas falhou ao registrar pendencia: ${profileInsertError.message}`, true);
            await client.auth.signOut();
            return;
          }

          if (selectedPhotoFile) {
            let activeSession = null;
            try {
              const sessionNow = await client.auth.getSession();
              activeSession = sessionNow && sessionNow.data ? sessionNow.data.session : null;

              if (!activeSession) {
                const signInResult = await client.auth.signInWithPassword({
                  email: emailRaw,
                  password
                });
                if (signInResult.error) {
                  photoUploadWarning = ' Conta criada, mas nao foi possivel autenticar para subir a foto agora.';
                } else {
                  activeSession = signInResult.data ? signInResult.data.session : null;
                }
              }

              if (activeSession) {
                const originalName = (selectedPhotoFile.name || 'foto').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
                const ext = sanitizedName.includes('.') ? sanitizedName.split('.').pop().toLowerCase() : 'jpg';
                const random = Math.random().toString(36).slice(2, 8);
                const path = `${createdUser.id}/${Date.now()}_${random}.${ext}`;

                const uploadResult = await client
                  .storage
                  .from('profile-photos')
                  .upload(path, selectedPhotoFile, {
                    cacheControl: '3600',
                    upsert: false
                  });

                if (uploadResult.error) {
                  photoUploadWarning = ` Conta criada, mas a foto falhou no upload: ${uploadResult.error.message}`;
                } else {
                  const publicUrlResult = client
                    .storage
                    .from('profile-photos')
                    .getPublicUrl(path);
                  const publicUrl = publicUrlResult && publicUrlResult.data ? publicUrlResult.data.publicUrl : '';

                  const rpcResult = await client.rpc('update_own_profile_photo', {
                    p_foto_url: publicUrl,
                    p_foto_path: path
                  });

                  if (rpcResult.error) {
                    photoUploadWarning = ` Conta criada, mas falhou ao salvar referencia da foto: ${rpcResult.error.message}`;
                  }
                }
              }
            } catch (photoError) {
              photoUploadWarning = ' Conta criada, mas ocorreu erro ao enviar a foto.';
            }
            await client.auth.signOut();
            setFeedback(`Solicitação enviada. Sua conta está pendente de aprovação do administrador.${photoUploadWarning}`);
            registerForm.reset();
            clearPhotoSelection();
            return;
          }
        }

        await client.auth.signOut();
        setFeedback('Solicitação enviada. Sua conta está pendente de aprovação do administrador.');
        registerForm.reset();
        clearPhotoSelection();
      } catch (err) {
        setFeedback('Falha ao enviar solicitação de acesso. Tente novamente.', true);
      } finally {
        setLoading(false);
      }
    });
  };

  const setupSwappedImages = () => {
    // Compatibilidade apenas com caminhos antigos da PRF.
    const swaps = [
      { from: '../images/logo_inicio.png', to: 'assets/img/logo_inicio.png' },
      { from: '../images/prf.png', to: 'assets/img/prf.png' }
    ];
    swaps.forEach((swap) => {
      document.querySelectorAll(`img[src="${swap.from}"]`).forEach((img) => {
        img.src = swap.to;
      });
    });
  };

  const setupBannerSlider = () => {
    const bannerSection = document.querySelector('.main-banner');
    const bannerImage = document.querySelector('.banner-image');
    if (!bannerImage) return;

    const defaultSources = [
      'assets/img/banner_1.png',
      'assets/img/banner_2.png',
      'assets/img/banner_3.png'
    ];

    const dataSources = bannerSection ? bannerSection.getAttribute('data-banners') : '';
    const sources = dataSources
      ? dataSources.split(',').map((src) => src.trim()).filter(Boolean)
      : defaultSources;

    const uniqueSources = sources.filter((src, idx, arr) => src && arr.indexOf(src) === idx);
    if (uniqueSources.length < 2) return;

    let index = uniqueSources.indexOf(bannerImage.getAttribute('src'));
    if (index < 0) {
      index = 0;
      bannerImage.src = uniqueSources[0];
    }

    const swapImage = () => {
      index = (index + 1) % uniqueSources.length;
      bannerImage.classList.add('is-fading');

      window.setTimeout(() => {
        bannerImage.src = uniqueSources[index];
        const clearFade = () => bannerImage.classList.remove('is-fading');
        bannerImage.onload = clearFade;
        bannerImage.onerror = clearFade;
      }, 300);
    };

    const interval = bannerSection && bannerSection.dataset && bannerSection.dataset.bannerInterval
      ? Number(bannerSection.dataset.bannerInterval)
      : 6000;
    const safeInterval = Number.isFinite(interval) && interval >= 2000 ? interval : 6000;
    window.setInterval(swapImage, safeInterval);
  };

  const setupGlobals = () => {
    window.changeNewsPage = (direction) => setPage('news', state.news.page + direction);
    window.goToNewsPage = (page) => setPage('news', page);
    window.changeVideosPage = (direction) => setPage('videos', state.videos.page + direction);
    window.goToVideosPage = (page) => setPage('videos', page);
    window.changeCulturalPage = (direction) => setPage('cultural', state.cultural.page + direction);
    window.goToCulturalPage = (page) => setPage('cultural', page);
    window.changeCommunityPage = (direction) => setPage('community', state.community.page + direction);
    window.goToCommunityPage = (page) => setPage('community', page);

    window.openTicketsWidget = () => window.alert('Fale conosco: atendimento em horario comercial.');
    window.openCorregedoriaWidget = () => window.alert('Corregedoria: canal em manutenção.');

    window.cacheManager = {
      clearAndReload: () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (err) {
          /* ignore */
        }
        window.location.reload();
      }
    };

    window.userProfile = window.userProfile || {
      openModal: () => window.alert('Perfil do usu?rio indispon?vel no modo estático.')
    };

    window.auth = window.auth || {
      logout: async () => {
        try {
          const client = await createSupabaseClient();
          if (client) {
            await client.auth.signOut();
          }
        } catch (err) {
          /* ignore */
        } finally {
          window.location.href = window.location.pathname.includes('/interno/') ? '../login.html' : 'login.html';
        }
      }
    };

    window.mostrarListaAprovadosFromBase64 = (base64) => {
      const modal = byId('lista-aprovados-modal');
      const content = byId('lista-aprovados-content');
      if (!modal || !content) return;
      try {
        const text = decodeURIComponent(escape(atob(base64)));
        content.textContent = text;
      } catch (err) {
        content.textContent = 'Erro ao carregar lista.';
      }
      modal.style.display = 'flex';
    };

    window.mostrarListaAprovados = (text) => {
      const modal = byId('lista-aprovados-modal');
      const content = byId('lista-aprovados-content');
      if (!modal || !content) return;
      content.textContent = text;
      modal.style.display = 'flex';
    };

    window.incrementMultasTotal = incrementMultasTotal;
  };

  const setupModalClose = () => {
    document.addEventListener('click', (event) => {
      const modal = byId('lista-aprovados-modal');
      if (modal && event.target === modal) {
        modal.style.display = 'none';
      }
    });
  };

  const setupInfoCardDropdowns = () => {
    const toggles = document.querySelectorAll('.info-card .info-card-toggle');
    if (!toggles.length) return;

    toggles.forEach((toggle) => {
      const card = toggle.closest('.info-card');
      if (!card) return;
      const targetId = toggle.getAttribute('aria-controls');
      const body = targetId ? byId(targetId) : card.querySelector('.info-card-body');
      if (!body) return;

      const setExpanded = (expanded) => {
        card.classList.toggle('is-open', expanded);
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      };

      setExpanded(card.classList.contains('is-open'));

      toggle.addEventListener('click', () => {
        const isOpen = card.classList.contains('is-open');
        setExpanded(!isOpen);
      });

      toggle.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle.click();
        }
      });
    });
  };

  const setupAuthFloatingLabels = () => {
    const inputs = document.querySelectorAll('.auth-siga .input-field');
    if (!inputs.length) return;

    const updateInput = (input) => {
      const box = input.closest('.input_box');
      if (!box) return;
      if (input.value && input.value.trim().length > 0) {
        box.classList.add('has-value');
      } else {
        box.classList.remove('has-value');
      }
    };

    inputs.forEach((input) => {
      const handler = () => updateInput(input);
      updateInput(input);
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
      input.addEventListener('blur', handler);
    });

    setTimeout(() => {
      inputs.forEach((input) => updateInput(input));
    }, 300);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    rewriteNavLinks();
    setupGlobals();
    setupSwappedImages();
    setupBannerSlider();
    await syncKpisFromServer();
    renderNumbers();
    renderNews();
    renderVideos();
    renderActivities('cultural', 'cultural-activities-grid', 'cultural-page-numbers', 'cultural-page-info', 'cultural-pagination');
    renderActivities('community', 'community-activities-grid', 'community-page-numbers', 'community-page-info', 'community-pagination');
    setupMobileMenu();
    setupAccessibility();
    setupSupabaseLogin();
    setupSupabaseRegister();
    setupAuthFloatingLabels();
    setupHeaderAuthState();
    setupModalClose();
    setupInfoCardDropdowns();
    window.addEventListener('resize', updateNumbersGridLayout);
  });
})();

