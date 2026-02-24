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

    grid.innerHTML = rows.map((n) => {
      const image = n.image_url
        ? `<img src="${esc(n.image_url)}" alt="${esc(n.titulo)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'news-placeholder\'><i class=\'fas fa-newspaper\'></i></div>'">`
        : `<div class="news-placeholder"><i class="fas fa-newspaper"></i></div>`;

      const hasContent = Boolean((n.conteudo || '').trim());

      return `
      <article class="news-item news-item--expandable scroll-fade" data-news-id="${esc(n.id)}">
        <div class="news-image">${image}</div>
        <div class="news-content">
          <h3>${esc(n.titulo)}</h3>
          <p>${esc(n.resumo || '')}</p>
          <span class="news-date">${esc(fmtDate(n.published_at))}</span>
          ${hasContent ? `<div class="news-expand" hidden><p>${esc(n.conteudo).replace(/\n/g, '<br>')}</p></div>` : ''}
          ${hasContent ? '<div class="news-actions"><button type="button" class="news-toggle-btn">Expandir not\u00edcia</button></div>' : ''}
        </div>
      </article>`;
    }).join('');

    if (typeof window.registerScrollFades === 'function') {
      window.registerScrollFades(grid);
    }

    grid.querySelectorAll('.news-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.news-item');
        const panel = item ? item.querySelector('.news-expand') : null;
        if (!item || !panel) return;

        const opening = panel.hasAttribute('hidden');

        grid.querySelectorAll('.news-item.is-open').forEach((openItem) => {
          if (openItem === item) return;
          const openPanel = openItem.querySelector('.news-expand');
          const openBtn = openItem.querySelector('.news-toggle-btn');
          if (openPanel) openPanel.setAttribute('hidden', 'hidden');
          openItem.classList.remove('is-open');
          if (openBtn) openBtn.textContent = 'Expandir not\u00edcia';
        });

        if (opening) {
          panel.removeAttribute('hidden');
          item.classList.add('is-open');
          btn.textContent = 'Recolher not\u00edcia';
        } else {
          panel.setAttribute('hidden', 'hidden');
          item.classList.remove('is-open');
          btn.textContent = 'Expandir not\u00edcia';
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const grid = byId('news-grid');
    if (!grid) return;
    const noticias = await fetchNoticiasPublicas();
    renderNewsList(noticias);
  });
})();

