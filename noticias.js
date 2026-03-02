(function () {
  'use strict';

  const DEFAULT_NEWS = [
    {
      id: 'demo-1',
      titulo: 'Not\u00edcia institucional',
      resumo: 'Atualiza\\u00e7\\u00f5es institucionais da PRF em destaque.',
      conteudo: 'Conte\u00fado completo da not\u00edcia institucional. Este texto \u00e9 exibido quando n\u00e3o houver not\u00edcias publicadas no banco.',
      image_url: 'assets/img/foto_relat_patrul.png',
      published_at: new Date().toISOString()
    }
  ];

  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const byId = (id) => document.getElementById(id);

  const esc = (value) => {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  };

  const fmtDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR');
  };

  async function ensureSupabaseLibrary() {
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
      const s = document.createElement('script');
      s.src = SUPABASE_CDN;
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    });

    return Boolean(window.supabase && window.supabase.createClient);
  }

  const getClient = () => {
    if (!window.supabase || !window.supabase.createClient) return null;
    const url = window.SUPABASE_URL || 'https://pssujmmuachdymlwsiuj.supabase.co';
    const key = window.SUPABASE_ANON_KEY || 'sb_publishable_PYQxZQr_TfVEesG7L4WI4g_-VjPHVpW';
    if (!url || !key) return null;
    return window.supabase.createClient(url, key);
  };

  const mapRow = (row) => ({
    id: row.id,
    titulo: row.titulo || 'Sem t?tulo',
    resumo: row.resumo || '',
    conteudo: row.conteudo || '',
    image_url: row.image_url || '',
    published_at: row.published_at || row.created_at || ''
  });

  async function fetchNoticiasPublicas() {
    await ensureSupabaseLibrary();
    const client = getClient();
    if (!client) return DEFAULT_NEWS;

    const q = await client
      .from('noticias')
      .select('id,titulo,resumo,conteudo,image_url,published_at,created_at,is_published')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(24);

    if (q.error || !Array.isArray(q.data) || !q.data.length) return DEFAULT_NEWS;
    return q.data.map(mapRow);
  }

  function renderNewsList(noticias) {
    const grid = byId('news-grid');
    if (!grid) return;

    const rows = Array.isArray(noticias) && noticias.length ? noticias : DEFAULT_NEWS;
    const newsById = new Map(rows.map((item) => [String(item.id), item]));

    grid.innerHTML = rows.map((n) => {
      const image = n.image_url
        ? `<img src="${esc(n.image_url)}" alt="${esc(n.titulo)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'news-placeholder\'><i class=\'fas fa-newspaper\'></i></div>'">`
        : `<div class="news-placeholder"><i class="fas fa-newspaper"></i></div>`;

      const hasContent = Boolean((n.conteudo || '').trim());

      return `
      <article class="news-item scroll-fade" data-news-id="${esc(n.id)}">
        <div class="news-image">${image}</div>
        <div class="news-content">
          <h3>${esc(n.titulo)}</h3>
          <p>${esc(n.resumo || '')}</p>
          <span class="news-date">${esc(fmtDate(n.published_at))}</span>
          ${hasContent ? `<div class="news-actions"><button type="button" class="news-open-btn" data-news-open="${esc(n.id)}">Ler not\u00edcia</button></div>` : ''}
        </div>
      </article>`;
    }).join('');

    if (typeof window.registerScrollFades === 'function') {
      window.registerScrollFades(grid);
    }

    const modal = ensureNewsModal();

    grid.querySelectorAll('[data-news-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-news-open');
        const data = id ? newsById.get(id) : null;
        if (!data) return;
        openNewsModal(modal, data);
      });
    });
  }

  function ensureNewsModal() {
    let modal = document.getElementById('news-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'news-modal';
    modal.id = 'news-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="news-modal__backdrop" data-news-close></div>
      <div class="news-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="news-modal-title">
        <button class="news-modal__close" type="button" data-news-close aria-label="Fechar not\u00edcia">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
        <div class="news-modal__body">
          <div class="news-modal__header">
            <h3 id="news-modal-title"></h3>
            <div class="news-modal__meta">
              <span class="news-modal__date"></span>
            </div>
          </div>
          <div class="news-modal__image"></div>
          <div class="news-modal__content"></div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target && event.target.closest('[data-news-close]')) {
        closeNewsModal(modal);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeNewsModal(modal);
      }
    });

    return modal;
  }

  let lastFocusedElement = null;

  function openNewsModal(modal, data) {
    if (!modal || !data) return;
    lastFocusedElement = document.activeElement;

    const title = modal.querySelector('#news-modal-title');
    const date = modal.querySelector('.news-modal__date');
    const image = modal.querySelector('.news-modal__image');
    const content = modal.querySelector('.news-modal__content');

    if (title) title.textContent = data.titulo || 'Not\u00edcia';
    if (date) date.textContent = fmtDate(data.published_at);

    if (image) {
      if (data.image_url) {
        image.innerHTML = `<img src="${esc(data.image_url)}" alt="${esc(data.titulo || 'Not\u00edcia')}" loading="lazy">`;
      } else {
        image.innerHTML = `<div class="news-placeholder news-placeholder--modal"><i class="fas fa-newspaper"></i></div>`;
      }
    }

    const bodyText = (data.conteudo || '').trim() || (data.resumo || '').trim() || 'Conte\u00fado indispon\u00edvel.';
    if (content) {
      content.innerHTML = `<p>${esc(bodyText).replace(/\n/g, '<br>')}</p>`;
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const closeBtn = modal.querySelector('.news-modal__close');
    if (closeBtn) closeBtn.focus();
  }

  function closeNewsModal(modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const grid = byId('news-grid');
    if (!grid) return;
    const noticias = await fetchNoticiasPublicas();
    renderNewsList(noticias);
  });
})();

