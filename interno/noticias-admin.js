(function () {
  'use strict';

  let client = null;
  const STORAGE_BUCKETS = ['noticias-media', 'avisos-media'];

  const byId = (id) => document.getElementById(id);

  const esc = (value) => {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  };

  const setStatus = (msg, isError) => {
    const node = byId('noticias-admin-status');
    if (!node) return;
    node.textContent = msg || '';
    node.className = isError ? 'approvals-status is-error' : 'approvals-status';
  };

  const fmtDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR');
  };

  async function ensureAdmin() {
    if (!window.supabase || !window.supabase.createClient) return false;
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const sessionResult = await client.auth.getSession();
    const user = sessionResult && sessionResult.data && sessionResult.data.session ? sessionResult.data.session.user : null;
    if (!user) return false;

    const p = await client
      .from('profiles')
      .select('aprovado,is_admin')
      .eq('id', user.id)
      .maybeSingle();

    return Boolean(!p.error && p.data && p.data.aprovado === true && p.data.is_admin === true);
  }

  function clearForm() {
    byId('noticia-id').value = '';
    byId('noticia-titulo').value = '';
    byId('noticia-resumo').value = '';
    byId('noticia-conteudo').value = '';
    byId('noticia-imagem').value = '';
    const fileInput = byId('noticia-imagem-arquivo');
    if (fileInput) fileInput.value = '';
    byId('noticia-publicada').checked = true;
  }

  function fillForm(row) {
    byId('noticia-id').value = row.id || '';
    byId('noticia-titulo').value = row.titulo || '';
    byId('noticia-resumo').value = row.resumo || '';
    byId('noticia-conteudo').value = row.conteudo || '';
    byId('noticia-imagem').value = row.image_url || '';
    const fileInput = byId('noticia-imagem-arquivo');
    if (fileInput) fileInput.value = '';
    byId('noticia-publicada').checked = row.is_published === true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadSelectedImage() {
    const fileInput = byId('noticia-imagem-arquivo');
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return null;

    if (!String(file.type || '').startsWith('image/')) {
      throw new Error('Arquivo inv?lido. Selecione uma imagem.');
    }

    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
    const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `noticias/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    let lastError = null;
    for (const bucket of STORAGE_BUCKETS) {
      const up = await client.storage.from(bucket).upload(path, file, { upsert: false, cacheControl: '3600' });
      if (up.error) {
        lastError = up.error;
        continue;
      }
      const pub = client.storage.from(bucket).getPublicUrl(path);
      const url = pub && pub.data ? pub.data.publicUrl : '';
      if (url) return url;
      return `${bucket}/${path}`;
    }

    throw new Error(lastError && lastError.message ? lastError.message : 'Falha no upload da imagem.');
  }

  async function loadList() {
    const list = byId('noticias-admin-lista');
    if (!list) return;
    setStatus('Carregando not\u00edcias...');

    const q = await client
      .from('noticias')
      .select('id,titulo,resumo,conteudo,image_url,is_published,published_at,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (q.error) {
      list.innerHTML = '<div class="approvals-empty">Falha ao carregar not\u00edcias.</div>';
      setStatus('Falha ao carregar not\u00edcias: ' + q.error.message, true);
      return;
    }

    const rows = Array.isArray(q.data) ? q.data : [];
    if (!rows.length) {
      list.innerHTML = '<div class="approvals-empty">Nenhuma not\u00edcia cadastrada.</div>';
      setStatus('');
      return;
    }

    list.innerHTML = rows.map((row) => `
      <article class="noticia-admin-item" data-id="${esc(row.id)}">
        <div class="noticia-admin-main">
          <h4>${esc(row.titulo || 'Sem t\u00edtulo')}</h4>
          <p>${esc(row.resumo || '').slice(0, 220)}</p>
          <span class="noticia-admin-meta">${row.is_published ? 'Publicada' : 'Rascunho'} ? ${esc(fmtDate(row.published_at || row.created_at))}</span>
        </div>
        <div class="noticia-admin-actions">
          <button type="button" class="approvals-btn" data-action="edit">Editar</button>
          <button type="button" class="approvals-btn" data-action="toggle">${row.is_published ? 'Despublicar' : 'Publicar'}</button>
          <button type="button" class="approvals-btn danger" data-action="delete">Excluir</button>
        </div>
      </article>
    `).join('');

    rows.forEach((row) => {
      const item = list.querySelector(`.noticia-admin-item[data-id="${CSS.escape(String(row.id))}"]`);
      if (!item) return;

      const editBtn = item.querySelector('[data-action="edit"]');
      const toggleBtn = item.querySelector('[data-action="toggle"]');
      const delBtn = item.querySelector('[data-action="delete"]');

      if (editBtn) editBtn.addEventListener('click', () => fillForm(row));

      if (toggleBtn) toggleBtn.addEventListener('click', async () => {
        const nextPublished = !row.is_published;
        const payload = {
          is_published: nextPublished,
          published_at: nextPublished ? new Date().toISOString() : null
        };
        const upd = await client.from('noticias').update(payload).eq('id', row.id);
        if (upd.error) {
          setStatus('Falha ao alterar publica\u00e7\u00e3o: ' + upd.error.message, true);
          return;
        }
        setStatus('Status da not\u00edcia atualizado.');
        await loadList();
      });

      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!window.confirm('Excluir esta not\u00edcia?')) return;
        const del = await client.from('noticias').delete().eq('id', row.id);
        if (del.error) {
          setStatus('Falha ao excluir not\u00edcia: ' + del.error.message, true);
          return;
        }
        setStatus('Not\u00edcia exclu\u00edda com sucesso.');
        await loadList();
      });
    });

    setStatus('');
  }

  async function saveForm(event) {
    event.preventDefault();

    const id = (byId('noticia-id').value || '').trim();
    const titulo = (byId('noticia-titulo').value || '').trim();
    const resumo = (byId('noticia-resumo').value || '').trim();
    const conteudo = (byId('noticia-conteudo').value || '').trim();
    let image = (byId('noticia-imagem').value || '').trim();
    const isPublished = byId('noticia-publicada').checked;

    if (!titulo || !conteudo) {
      setStatus('T\u00edtulo e conte\u00fado s\u00e3o obrigat\u00f3rios.', true);
      return;
    }

    try {
      const fileInput = byId('noticia-imagem-arquivo');
      const hasFile = Boolean(fileInput && fileInput.files && fileInput.files[0]);
      if (hasFile) {
        setStatus('Enviando imagem...');
        const uploadedUrl = await uploadSelectedImage();
        if (uploadedUrl) image = uploadedUrl;
      }
    } catch (uploadErr) {
      setStatus('Falha no upload da imagem: ' + (uploadErr.message || String(uploadErr)), true);
      return;
    }

    const payload = {
      titulo,
      resumo,
      conteudo,
      image_url: image || null,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null
    };

    let q;
    if (id) {
      q = await client.from('noticias').update(payload).eq('id', id);
    } else {
      q = await client.from('noticias').insert(payload);
    }

    if (q.error) {
      setStatus('Falha ao salvar not\u00edcia: ' + q.error.message, true);
      return;
    }

    setStatus(id ? 'Not\u00edcia atualizada com sucesso.' : 'Not\u00edcia criada com sucesso.');
    clearForm();
    await loadList();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = byId('noticias-admin-form');
    const root = byId('noticias-admin-lista');
    if (!form || !root) return;

    const ok = await ensureAdmin();
    if (!ok) {
      form.closest('.approvals-card').style.display = 'none';
      return;
    }

    form.addEventListener('submit', saveForm);
    byId('noticia-limpar').addEventListener('click', clearForm);
    await loadList();
  });
})();
