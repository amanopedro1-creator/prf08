'use strict';

(function () {
    let client = null;
    let currentUser = null;
    let isAdmin = false;
    let canPublish = false;
    let currentAvisos = [];

    function byId(id) { return document.getElementById(id); }

    function setStatus(message, isError) {
        const node = byId('avisos-status');
        if (!node) return;
        node.textContent = message || '';
        node.className = isError ? 'approvals-status is-error' : 'approvals-status';
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

    async function enforceAuth() {
        if (!window.supabase || !window.supabase.createClient) {
            window.location.replace('../login.html');
            return false;
        }
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

        const result = await client.auth.getSession();
        const session = result && result.data ? result.data.session : null;
        currentUser = session ? session.user : null;
        if (!currentUser) {
            window.location.replace('../login.html');
            return false;
        }

        const profileQuery = await client
            .from('profiles')
            .select('aprovado, is_admin, acesso')
            .eq('id', currentUser.id)
            .maybeSingle();
        const profile = profileQuery ? profileQuery.data : null;
        const profileError = profileQuery ? profileQuery.error : null;
        if (profileError || !profile || profile.aprovado !== true) {
            await client.auth.signOut();
            window.location.replace('../login.html');
            return false;
        }

        const adminRaw = String(profile.is_admin || '').trim().toLowerCase();
        isAdmin = profile.is_admin === true || adminRaw === 'true' || adminRaw === '1' || adminRaw === 'sim';
        const accessRaw = String(profile.acesso || '').trim().toLowerCase();
        const hasAcesso = Boolean(accessRaw)
            && (accessRaw.includes('acesso') || accessRaw === 'sim' || accessRaw === 'true' || accessRaw === '1');
        canPublish = isAdmin || hasAcesso;
        const formCard = byId('avisos-form-card');
        if (formCard) formCard.style.display = canPublish ? 'block' : 'none';
        return true;
    }

    async function uploadMedia(file) {
        if (!file) return { url: '', warning: '' };
        const safeName = (file.name || 'arquivo')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = 'avisos/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + safeName;

        const upload = await client.storage
            .from('avisos-media')
            .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
        if (upload.error) {
            const message = String(upload.error.message || '');
            if (message.toLowerCase().includes('bucket') && message.toLowerCase().includes('not found')) {
                return {
                    url: '',
                    warning: 'Bucket de mídia não encontrado. Aviso publicado sem imagem enviada por arquivo.'
                };
            }
            throw new Error('Falha no upload da mídia: ' + upload.error.message);
        }

        const pub = client.storage.from('avisos-media').getPublicUrl(path);
        const url = pub && pub.data ? pub.data.publicUrl : '';
        if (!url) throw new Error('Não foi possível gerar URL pública da mídia.');
        return { url: url, warning: '' };
    }

    function extractAvisosMediaPath(url) {
        const value = String(url || '').trim();
        if (!value) return '';
        const marker = '/storage/v1/object/public/avisos-media/';
        const idx = value.indexOf(marker);
        if (idx < 0) return '';
        const tail = value.slice(idx + marker.length).split('?')[0];
        return decodeURIComponent(tail || '');
    }

    async function deleteAviso(aviso) {
        if (!isAdmin) {
            setStatus('Somente administradores podem excluir avisos.', true);
            return;
        }
        if (!aviso || !aviso.id) return;
        if (!window.confirm('Deseja realmente excluir este aviso?')) return;

        setStatus('Excluindo aviso...');
        try {
            const mediaPath = extractAvisosMediaPath(aviso.midia_url);
            if (mediaPath) {
                await client.storage.from('avisos-media').remove([mediaPath]);
            }

            const result = await client.from('avisos').delete().eq('id', aviso.id);
            if (result.error) {
                setStatus('Falha ao excluir aviso: ' + result.error.message, true);
                return;
            }
            setStatus('Aviso excluído com sucesso.');
            await loadAvisos();
        } catch (e) {
            setStatus('Falha ao excluir aviso: ' + e.message, true);
        }
    }

    function renderAvisos(list) {
        const container = byId('avisos-lista');
        if (!container) return;

        currentAvisos = Array.isArray(list) ? list.slice() : [];
        if (!Array.isArray(list) || !list.length) {
            container.innerHTML = '<div class="approvals-empty">Nenhum aviso publicado até o momento.</div>';
            return;
        }

        container.innerHTML = list.map(function (aviso) {
            const titulo = aviso.titulo || 'Aviso interno';
            const subtitulo = aviso.subtitulo || '';
            const texto = aviso.texto || '';
            const midia = aviso.midia_url || '';
            const createdAt = aviso.created_at ? new Date(aviso.created_at).toLocaleString('pt-BR') : '-';
            const actions = isAdmin
                ? '<div class="aviso-card-actions">' +
                    '<button type="button" class="approvals-btn danger aviso-delete-btn" data-id="' + escapeHtml(aviso.id) + '">Excluir aviso</button>' +
                  '</div>'
                : '';

            return '<article class="aviso-card">' +
                '<div class="aviso-card-body">' +
                    '<h3>' + escapeHtml(titulo) + '</h3>' +
                    (subtitulo ? '<h4>' + escapeHtml(subtitulo) + '</h4>' : '') +
                    (texto ? '<p class="aviso-card-texto">' + escapeHtml(texto).replace(/\n/g, '<br>') + '</p>' : '') +
                    (midia ? '<img src="' + escapeHtml(midia) + '" alt="Mídia do aviso" class="aviso-card-media">' : '') +
                    '<span class="aviso-card-data">Publicado em ' + escapeHtml(createdAt) + '</span>' +
                    actions +
                '</div>' +
            '</article>';
        }).join('');

        if (isAdmin) {
            container.querySelectorAll('.aviso-delete-btn').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    const id = btn.getAttribute('data-id');
                    const aviso = currentAvisos.find(function (a) { return String(a.id) === String(id); });
                    if (!aviso) return;
                    await deleteAviso(aviso);
                });
            });
        }
    }

    async function loadAvisos() {
        const result = await client.from('avisos').select('*').order('created_at', { ascending: false });
        if (result.error) {
            setStatus('Falha ao carregar avisos: ' + result.error.message, true);
            return;
        }
        renderAvisos(result.data || []);
        setStatus('');
    }

    async function publishAviso(event) {
        event.preventDefault();
        if (!canPublish) {
            setStatus('Somente administradores ou perfis com acesso podem publicar avisos.', true);
            return;
        }

        const titulo = (byId('aviso-titulo').value || '').trim();
        const subtitulo = (byId('aviso-subtitulo').value || '').trim();
        const texto = (byId('aviso-texto').value || '').trim();
        const url = (byId('aviso-midia-url').value || '').trim();
        const fileInput = byId('aviso-midia-file');
        const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (!titulo || !texto) {
            setStatus('Preencha pelo menos título e texto.', true);
            return;
        }

        try {
            setStatus('Publicando aviso...');
            let midiaUrl = url;
            let warning = '';
            if (file) {
                const uploadResult = await uploadMedia(file);
                midiaUrl = uploadResult.url || midiaUrl;
                warning = uploadResult.warning || '';
            }

            const payload = {
                titulo: titulo,
                subtitulo: subtitulo || null,
                texto: texto,
                midia_url: midiaUrl || null,
                created_by: currentUser ? currentUser.id : null
            };

            const result = await client.from('avisos').insert(payload);
            if (result.error) {
                const fallback = await client.from('avisos').insert({
                    titulo: titulo,
                    subtitulo: subtitulo || null,
                    texto: texto,
                    midia_url: midiaUrl || null
                });
                if (fallback.error) {
                    setStatus('Falha ao publicar aviso: ' + fallback.error.message, true);
                    return;
                }
            }

            byId('aviso-form').reset();
            setStatus(warning || 'Aviso publicado com sucesso.');
            await loadAvisos();
        } catch (e) {
            setStatus('Falha ao publicar aviso: ' + e.message, true);
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        try {
            const ok = await enforceAuth();
            if (!ok) return;
            const form = byId('aviso-form');
            if (form) form.addEventListener('submit', publishAviso);
            await loadAvisos();
        } catch (e) {
            window.location.replace('../login.html');
        }
    });
})();
