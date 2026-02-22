'use strict';

(function () {
    let client = null;
    let currentUser = null;
    let currentProfile = null;
    let isAdmin = false;
    let profilesCache = [];

    const el = {
        formCard: document.getElementById('corregedoria-form-card'),
        form: document.getElementById('corregedoria-form'),
        status: document.getElementById('corregedoria-status'),
        list: document.getElementById('corregedoria-lista'),
        tipo: document.getElementById('corregedoria-tipo'),
        numero: document.getElementById('corregedoria-numero'),
        privacidade: document.getElementById('corregedoria-privacidade'),
        texto: document.getElementById('corregedoria-texto'),
        citadosWrap: document.getElementById('corregedoria-citados-wrap'),
        citadosList: document.getElementById('corregedoria-citados'),
        search: document.getElementById('corregedoria-search')
    };

    function setStatus(msg, isError) {
        if (!el.status) return;
        el.status.textContent = msg || '';
        el.status.className = isError ? 'approvals-status is-error' : 'approvals-status';
    }

    function normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
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

    function formatDateLong(value) {
        try {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch (e) {
            return '';
        }
    }

    function formatAssinatura(post) {
        const nome = post.author_name || '';
        const cargo = post.author_cargo || '';
        if (cargo && nome) return cargo + ' ' + nome;
        return nome || cargo || '';
    }

    function renderPost(post) {
        const title = escapeHtml(post.title || post.tipo || '');
        const numero = escapeHtml(post.numero || '');
        const texto = escapeHtml(post.texto || post.content || '');
        const dateLabel = formatDateLong(post.created_at);
        const assinatura = escapeHtml(formatAssinatura(post));
        const canDelete = isAdmin;
        return `
            <article class="corregedoria-card">
                <div class="corregedoria-card-header">
                    <img src="assets/img/prf.png" alt="PRF" class="corregedoria-logo">
                    <p class="corregedoria-do-title">DIÁRIO OFICIAL DA UNIÃO</p>
                    <p class="corregedoria-subtitle">CGCOR - COORDENAÇÃO-GERAL DE CORREGEDORIA</p>
                    <p class="corregedoria-subtitle">GABINETE DA DIRETORIA DE GESTÃO DE PESSOAS</p>
                </div>
                <h3 class="corregedoria-title">DECRETO DE NÚMERO ${numero || '-'}</h3>
                <p class="corregedoria-type">${title}</p>
                <p class="corregedoria-text">${texto}</p>
                <div class="corregedoria-footer">
                    <div>
                        <p>São Paulo, ${dateLabel}.</p>
                        <p><strong>${assinatura}</strong></p>
                    </div>
                    ${canDelete ? `<button class="approvals-btn danger" data-delete="${post.id}">Excluir publicação</button>` : ''}
                </div>
            </article>
        `;
    }

    function renderList(items) {
        if (!el.list) return;
        if (!Array.isArray(items) || !items.length) {
            el.list.innerHTML = '<div class="approvals-empty">Nenhuma publicação disponível.</div>';
            return;
        }
        el.list.innerHTML = items.map(renderPost).join('');
        if (isAdmin) {
            el.list.querySelectorAll('[data-delete]').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    const id = btn.getAttribute('data-delete');
                    if (!id) return;
                    if (!confirm('Deseja excluir esta publicação?')) return;
                    const del = await client.from('corregedoria_posts').delete().eq('id', id);
                    if (del.error) {
                        setStatus('Falha ao excluir publicação: ' + del.error.message, true);
                        return;
                    }
                    await loadPosts();
                });
            });
        }
    }

    function renderCitadosList(list) {
        if (!el.citadosList) return;
        if (!Array.isArray(list) || !list.length) {
            el.citadosList.innerHTML = '<div class="approvals-empty">Nenhum usuário encontrado.</div>';
            return;
        }
        el.citadosList.innerHTML = list.map(function (p) {
            const label = `${p.nome_guerra || '-'} • RG ${p.rg || '-'}`;
            return `
                <label class="corregedoria-citado">
                    <input type="checkbox" value="${p.id}">
                    <span>${escapeHtml(label)}</span>
                </label>
            `;
        }).join('');
    }

    function applyCitadosFilter() {
        const q = normalize(el.search && el.search.value ? el.search.value : '');
        if (!q) {
            renderCitadosList(profilesCache);
            return;
        }
        const filtered = profilesCache.filter(function (p) {
            const base = normalize([p.nome_guerra, p.rg].join(' '));
            return base.includes(q);
        });
        renderCitadosList(filtered);
    }

    async function loadProfiles() {
        if (!isAdmin) return;
        const result = await client
            .from('profiles')
            .select('id,nome_guerra,rg')
            .eq('aprovado', true)
            .order('nome_guerra', { ascending: true });
        profilesCache = Array.isArray(result.data) ? result.data : [];
        renderCitadosList(profilesCache);
    }

    async function loadPosts() {
        if (!el.list) return;
        const result = await client
            .from('corregedoria_posts')
            .select('*')
            .order('created_at', { ascending: false });
        if (result.error) {
            el.list.innerHTML = '<div class="approvals-empty">Falha ao carregar publicações.</div>';
            return;
        }
        renderList(result.data || []);
    }

    function toggleCitadosVisibility() {
        if (!el.citadosWrap) return;
        const isPrivate = el.privacidade && el.privacidade.value === 'privada';
        el.citadosWrap.classList.toggle('is-hidden', !isPrivate);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!client || !currentUser || !isAdmin) return;
        const tipo = el.tipo ? el.tipo.value : '';
        const numero = el.numero ? el.numero.value.trim() : '';
        const texto = el.texto ? el.texto.value.trim() : '';
        const priv = el.privacidade ? el.privacidade.value : 'publica';
        if (!tipo || !numero || !texto) {
            setStatus('Preencha o tipo, número e o texto.', true);
            return;
        }

        const isPublic = priv === 'publica';
        let mentioned = [];
        if (!isPublic && el.citadosList) {
            mentioned = Array.from(el.citadosList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(function (node) { return node.value; })
                .filter(Boolean);
        }

        setStatus('Publicando...');
        const insert = await client.from('corregedoria_posts').insert({
            user_id: currentUser.id,
            title: tipo,
            numero: numero,
            texto: texto,
            is_public: isPublic,
            mentioned_user_ids: mentioned,
            author_name: currentProfile && currentProfile.nome_guerra ? currentProfile.nome_guerra : (currentUser.email || ''),
            author_cargo: currentProfile && currentProfile.cargo ? currentProfile.cargo : ''
        });
        if (insert.error) {
            setStatus('Falha ao publicar: ' + insert.error.message, true);
            return;
        }

        if (el.form) el.form.reset();
        toggleCitadosVisibility();
        setStatus('Publicação criada com sucesso.');
        await loadPosts();
    }

    async function init() {
        if (!window.supabase || !window.supabase.createClient) return;
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        const sessionResult = await client.auth.getSession();
        const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
        currentUser = session ? session.user : null;
        if (!currentUser) return;

        const profileResult = await client
            .from('profiles')
            .select('nome_guerra,cargo,is_admin')
            .eq('id', currentUser.id)
            .maybeSingle();
        currentProfile = profileResult && profileResult.data ? profileResult.data : {};
        isAdmin = currentProfile && currentProfile.is_admin === true;

        if (isAdmin && el.formCard) {
            el.formCard.style.display = 'block';
        }

        if (el.privacidade) {
            el.privacidade.addEventListener('change', toggleCitadosVisibility);
        }
        if (el.search) el.search.addEventListener('input', applyCitadosFilter);
        if (el.form) el.form.addEventListener('submit', handleSubmit);

        toggleCitadosVisibility();
        await loadProfiles();
        await loadPosts();
    }

    init();
})();
