'use strict';

(function () {
    let supabaseClient = null;
    let profilesCache = [];
    let activeEditProfile = null;
    let activeEditMode = '';
    let activeHistoryProfile = null;
    let activeHistoryType = '';

    const CURSOS_OPTIONS = [
        'CFP | Curso de Formação Policial',
        'CAFIT | Curso de Fiscalização de Trânsito',
        'CVP | Curso Veicular Policial',
        'OP | Habilitação Operacional',
        'CDP | Curso de Direito Penal',
        'CAD | Curso de Atirador Designado',
        'COEsp | Curso de Operações Especiais',
        'CFMB | Curso de Motociclista Batedor',
        'CFMT | Curso de Formação de Motociclista Tático',
        'CDT | Curso de Desembarque Tático',
        'CDD | Curso de Direção Defensiva',
        'COA | Curso de Operador Aerotático',
        'CPPAR | Curso de Piloto Policial da Asa Rotativa',
        'ARP | Curso de Piloto Policial de Aeronave Remota'
    ];

    const MEDAL_OPTIONS = [
        { code: 'elogio_ref', name: 'Referência elogiosa', image: 'mencaoelogio.png' },
        { code: 'elogio', name: 'Elogio', image: 'mencaoelogio.png' },
        { code: 'merito', name: 'Medalha ao Mérito', image: 'medalhamerito.png' },
        { code: 'bravura', name: 'Medalha Bravura', image: 'medalhabravura.png' },
        { code: 'heroi_estradas', name: 'Medalha Herói das Estradas', image: 'medalhaheroiestradas.png' },
        { code: 'washington', name: 'Medalha Washington Luís', image: 'medalhawashington.png' },
        { code: 'antonio_felix_gracruza', name: 'Medalha Antônio Félix Filho Grã-Cruz', image: 'medalhaantoniofelix.png' },
        { code: 'washington_gracruza', name: 'Medalha Washington Luís Grã Cruz', image: 'medalhagracruzwashington.png' },
        { code: 'moeda_antonio_bronze', name: 'Moeda Antônio Felix Bronze', image: 'moedaantoniofelixbronze.png' },
        { code: 'moeda_antonio_prata', name: 'Moeda Antônio Felix Prata', image: 'moedaantoniofelixprata.png' },
        { code: 'moeda_antonio_ouro', name: 'Moeda Antônio Felix Ouro', image: 'moedaantoniofelixouro.png' }
    ];

    function byId(id) {
        return document.getElementById(id);
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

    function setStatus(message, isError) {
        const node = byId('aprovacoes-status');
        if (!node) return;
        node.textContent = message || '';
        node.className = isError ? 'approvals-status is-error' : 'approvals-status';
    }

    function setLogStatus(message, isError) {
        const node = byId('logs-status');
        if (!node) return;
        node.textContent = message || '';
        node.className = isError ? 'approvals-status is-error' : 'approvals-status';
    }

    function setTypedLogStatus(nodeId, message, isError) {
        const node = byId(nodeId);
        if (!node) return;
        node.textContent = message || '';
        node.className = isError ? 'approvals-status is-error' : 'approvals-status';
    }

    function setPontosStatus(message, isError) {
        const node = byId('pontos-status');
        if (!node) return;
        node.textContent = message || '';
        node.className = isError ? 'approvals-status is-error' : 'approvals-status';
    }

    function formatDate(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString('pt-BR');
    }

    function parseCursos(cursos) {
        return String(cursos || '')
            .split(' || ')
            .map(function (v) { return v.trim(); })
            .filter(Boolean);
    }

    function parseGrupamentos(value) {
        return String(value || '')
            .split(' || ')
            .map(function (v) { return v.trim(); })
            .filter(Boolean);
    }

    function resolveGrupamentoPrincipal(profile) {
        const direct = String(profile && profile.grupamento_principal ? profile.grupamento_principal : '').trim();
        if (direct) return direct;
        const legacy = parseGrupamentos(profile && (profile.grupamento || profile.unidade || ''));
        return legacy.length ? legacy[0] : '';
    }

    function resolveGrupamentoSecundario(profile) {
        const direct = String(profile && profile.grupamento_secundario ? profile.grupamento_secundario : '').trim();
        if (direct) return direct;
        const legacy = parseGrupamentos(profile && (profile.grupamento || profile.unidade || ''));
        return legacy.length > 1 ? legacy[1] : '';
    }

    function renderMedalOptions(selectedCodes) {
        const node = byId('roles-medalhas');
        if (!node) return;
        const selected = Array.isArray(selectedCodes) ? selectedCodes : [];
        node.innerHTML = MEDAL_OPTIONS.map(function (medal) {
            const checked = selected.includes(medal.code) ? 'checked' : '';
            return (
                '<label class="approvals-medal-option">' +
                '<input type="checkbox" name="roles-medalhas-opcao" value="' + medal.code + '" ' + checked + '>' +
                '<span class="approvals-medal-chip">' +
                '<img src="assets/img/' + medal.image + '" alt="' + medal.name + '">' +
                '<span>' + medal.name + '</span>' +
                '</span>' +
                '</label>'
            );
        }).join('');
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function matchProfileCitation(profile, row) {
        const source = normalizeText([
            row.conteudo_completo,
            row.texto,
            row.observacoes,
            row.relato,
            row.detalhes,
            row.resumo
        ].join(' '));
        const tokens = [
            profile.nome_guerra,
            profile.rg,
            profile.email
        ]
            .filter(Boolean)
            .map(normalizeText)
            .filter(function (t) { return t.length >= 3; });
        if (!tokens.length) return false;
        return tokens.some(function (t) { return source.includes(t); });
    }

    function formatHistoryItem(type, row) {
        const idLabel = row.id ? ('#' + row.id) : '-';
        const when = row.created_at || row.data_criacao || row.data || '';
        const whenLabel = when ? formatDate(when) : '-';
        const title = type === 'bou'
            ? (row.titulo || 'BOU')
            : type === 'ait'
                ? ('AIT ' + (row.numero_ait || idLabel))
                : type === 'patrulha'
                    ? (row.titulo || row.area || 'RelatÃ³rio de patrulha')
                    : (row.titulo || 'RelatÃ³rio aluno');

        const snippet = row.conteudo_completo || row.texto || row.observacoes || row.relato || '';
        const shortSnippet = String(snippet || '').slice(0, 260);
        return {
            id: idLabel,
            title: title,
            when: whenLabel,
            snippet: shortSnippet
        };
    }

    async function fetchFromFirstAvailable(type, mode, profile) {
        const config = {
            bou: ['bous'],
            ait: ['aits'],
            patrulha: ['patrulhas', 'relatorios_patrulha'],
            aluno: ['relatorios_aluno', 'relatorio_aluno']
        };
        const tables = config[type] || [];

        let lastError = null;
        for (let i = 0; i < tables.length; i += 1) {
            const table = tables[i];
            try {
                if (mode === 'realizado') {
                    const q = await supabaseClient
                        .from(table)
                        .select('*')
                        .eq('user_id', profile.id)
                        .limit(120);
                    if (!q.error) {
                        return { data: q.data || [], table: table };
                    }
                    lastError = q.error;
                } else {
                    const q = await supabaseClient
                        .from(table)
                        .select('*')
                        .limit(200);
                    if (!q.error) {
                        const filtered = (q.data || []).filter(function (row) {
                            return matchProfileCitation(profile, row || {});
                        });
                        return { data: filtered, table: table };
                    }
                    lastError = q.error;
                }
            } catch (e) {
                lastError = e;
            }
        }
        return { data: null, table: '', error: lastError };
    }

    function renderHistoryList(items, type) {
        const list = byId('history-list');
        if (!list) return;
        if (!Array.isArray(items)) {
            list.innerHTML = '<div class="approvals-empty">Fonte de dados nÃ£o encontrada para esta consulta.</div>';
            return;
        }
        if (!items.length) {
            list.innerHTML = '<div class="approvals-empty">Nenhum registro encontrado para o filtro selecionado.</div>';
            return;
        }
        list.innerHTML = items.map(function (row) {
            const item = formatHistoryItem(type, row);
            return '<article class="history-item">' +
                '<h4>' + escapeHtml(item.title) + '</h4>' +
                '<span class="history-meta">ID ' + escapeHtml(item.id) + ' â€¢ ' + escapeHtml(item.when) + '</span>' +
                (item.snippet ? '<p>' + escapeHtml(item.snippet) + '</p>' : '') +
            '</article>';
        }).join('');
    }

    async function loadHistory(type, mode) {
        const status = byId('history-status');
        if (status) status.textContent = 'Carregando registros...';
        const result = await fetchFromFirstAvailable(type, mode, activeHistoryProfile);
        if (result.error) {
            if (status) status.textContent = 'Erro ao carregar: ' + (result.error.message || String(result.error));
            renderHistoryList(null, type);
            return;
        }
        if (status) status.textContent = '';
        renderHistoryList(result.data, type);
    }

    function closeHistoryModal() {
        const modal = byId('history-modal');
        if (modal) modal.classList.remove('active');
        activeHistoryProfile = null;
        activeHistoryType = '';
    }

    async function openHistoryModal(profile, type) {
        const modal = byId('history-modal');
        if (!modal || !profile) return;
        activeHistoryProfile = profile;
        activeHistoryType = type;

        byId('history-user-name').textContent = profile.nome_guerra || profile.email || profile.id;
        byId('history-user-email').textContent = profile.email || '-';
        byId('history-title').textContent =
            type === 'bou' ? 'HistÃ³rico de BOU' :
            type === 'ait' ? 'HistÃ³rico de AIT' :
            type === 'patrulha' ? 'HistÃ³rico de Patrulha' : 'HistÃ³rico de RelatÃ³rio Aluno';

        const filtersNode = byId('history-filters');
        if (filtersNode) {
            if (type === 'aluno') {
                filtersNode.innerHTML = '<button class="approvals-btn" data-history-mode="citado">Somente citado</button>';
            } else {
                filtersNode.innerHTML =
                    '<button class="approvals-btn success" data-history-mode="realizado">Realizados</button>' +
                    '<button class="approvals-btn" data-history-mode="citado">Somente citado</button>';
            }
            filtersNode.querySelectorAll('button[data-history-mode]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const mode = btn.getAttribute('data-history-mode');
                    loadHistory(type, mode);
                });
            });
        }

        modal.classList.add('active');
        await loadHistory(type, type === 'aluno' ? 'citado' : 'realizado');
    }

    async function ensureAdmin() {
        if (!window.supabase || !window.supabase.createClient) {
            window.location.replace('../login.html');
            return false;
        }

        supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        const sessionResult = await supabaseClient.auth.getSession();
        const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
        const user = session ? session.user : null;
        if (!user) {
            window.location.replace('../login.html');
            return false;
        }

        const meResult = await supabaseClient
            .from('profiles')
            .select('nome_guerra, email, aprovado, is_admin')
            .eq('id', user.id)
            .maybeSingle();

        const me = meResult ? meResult.data : null;
        const meError = meResult ? meResult.error : null;
        if (meError || !me || me.aprovado !== true || me.is_admin !== true) {
            await supabaseClient.auth.signOut();
            window.location.replace('../login.html');
            return false;
        }

        const nameNode = document.querySelector('#header-user-menu .user-name-header') || byId('admin-name');
        if (nameNode) {
            const label = me.nome_guerra || me.email || 'Administrador';
            const avatar = nameNode.querySelector('.user-mini-avatar');
            const textSpan = nameNode.querySelector('.user-name-text');
            if (avatar && textSpan) {
                textSpan.textContent = label;
            } else if (avatar) {
                const span = document.createElement('span');
                span.className = 'user-name-text';
                span.textContent = label;
                nameNode.appendChild(span);
            } else {
                nameNode.textContent = label;
            }
        }
        return true;
    }

    async function updateApproval(userId, approved) {
        setStatus('Atualizando status...');
        const result = await supabaseClient
            .from('profiles')
            .update({ aprovado: approved })
            .eq('id', userId);
        if (result.error) {
            setStatus('Falha ao atualizar status: ' + result.error.message, true);
            return;
        }
        setStatus(approved ? 'Perfil aceito com sucesso.' : 'Perfil recusado com sucesso.');
        await loadProfiles();
    }

    async function deleteProfile(userId, question, successText) {
        if (!window.confirm(question)) return;
        setStatus('Removendo perfil e dados...');
        const result = await supabaseClient.rpc('admin_delete_profile', { p_user_id: userId });
        if (result.error) {
            setStatus('Falha ao remover perfil: ' + result.error.message, true);
            return;
        }
        if (result.data && result.data.success === false) {
            setStatus('Falha ao remover perfil: ' + (result.data.error || 'erro desconhecido'), true);
            return;
        }
        setStatus(successText);
        await loadProfiles();
    }

    function ensureSelectValue(selectId, value) {
        const node = byId(selectId);
        if (!node) return;
        const safe = String(value || '').trim();
        if (!safe) {
            node.value = '';
            return;
        }
        const exists = Array.from(node.options || []).some(function (opt) {
            return String(opt.value || '').trim() === safe;
        });
        if (!exists) {
            const extra = document.createElement('option');
            extra.value = safe;
            extra.textContent = safe;
            node.appendChild(extra);
        }
        node.value = safe;
    }

    function ensureMultiSelectValues(selectId, values) {
        const node = byId(selectId);
        if (!node) return;
        const list = Array.isArray(values) ? values : [];
        const normalized = list.map(function (v) { return String(v || '').trim(); }).filter(Boolean);
        if (!normalized.length) {
            Array.from(node.options || []).forEach(function (opt) { opt.selected = false; });
            return;
        }
        normalized.forEach(function (val) {
            const exists = Array.from(node.options || []).some(function (opt) {
                return String(opt.value || '').trim() === val;
            });
            if (!exists) {
                const extra = document.createElement('option');
                extra.value = val;
                extra.textContent = val;
                node.appendChild(extra);
            }
        });
        Array.from(node.options || []).forEach(function (opt) {
            opt.selected = normalized.includes(String(opt.value || '').trim());
        });
    }

    async function openEditModal(profile, mode) {
        activeEditProfile = profile;
        activeEditMode = mode;
        byId('roles-user-id').value = profile.id || '';
        byId('roles-user-name').textContent = profile.nome_guerra || profile.email || profile.id;
        byId('roles-user-email').textContent = profile.email || '-';
        ensureSelectValue('roles-cargo', profile.cargo || '');
        ensureSelectValue('roles-grupamento-principal', resolveGrupamentoPrincipal(profile));
        ensureSelectValue('roles-grupamento-secundario', resolveGrupamentoSecundario(profile));
        ensureSelectValue('roles-acesso', profile.acesso || '');

        const cursos = parseCursos(profile.cursos);
        document.querySelectorAll('input[name="roles-cursos-opcao"]').forEach(function (node) {
            node.checked = cursos.includes(node.value);
        });

        if (mode === 'medalhas') {
            let selectedMedals = [];
            try {
                const medalResult = await supabaseClient
                    .from('profile_medals')
                    .select('medal_code')
                    .eq('user_id', profile.id);
                if (!medalResult.error && Array.isArray(medalResult.data)) {
                    selectedMedals = medalResult.data.map(function (m) { return m.medal_code; }).filter(Boolean);
                }
            } catch (e) {
                /* ignore */
            }
            renderMedalOptions(selectedMedals);
        }

        byId('roles-edit-title').textContent =
            mode === 'cargo' ? 'Editar cargo' :
            mode === 'grupamento' ? 'Editar grupamento' :
            mode === 'acesso' ? 'Editar acesso' :
            mode === 'medalhas' ? 'Editar condecorações e medalhas' : 'Editar cursos';
        byId('roles-field-cargo').style.display = mode === 'cargo' ? 'flex' : 'none';
        byId('roles-field-grupamento').style.display = mode === 'grupamento' ? 'flex' : 'none';
        byId('roles-field-acesso').style.display = mode === 'acesso' ? 'flex' : 'none';
        byId('roles-field-cursos').style.display = mode === 'cursos' ? 'flex' : 'none';
        byId('roles-field-medalhas').style.display = mode === 'medalhas' ? 'flex' : 'none';
        byId('roles-modal').classList.add('active');
    }

    function closeRoleModal() {
        const modal = byId('roles-modal');
        if (modal) modal.classList.remove('active');
        activeEditMode = '';
        activeEditProfile = null;
    }

    async function saveRoleModal() {
        if (!activeEditProfile || !activeEditMode) return;
        const userId = byId('roles-user-id').value || '';
        const payload = {};
        if (activeEditMode === 'cargo') payload.cargo = (byId('roles-cargo').value || '').trim();
        if (activeEditMode === 'grupamento') {
            const principal = (byId('roles-grupamento-principal').value || '').trim();
            const secundario = (byId('roles-grupamento-secundario').value || '').trim();
            payload.grupamento_principal = principal || null;
            payload.grupamento_secundario = secundario || null;
            payload.grupamento = [principal, secundario].filter(Boolean).join(' || ');
        }
        if (activeEditMode === 'acesso') payload.acesso = (byId('roles-acesso').value || '').trim();
        if (activeEditMode === 'cursos') {
            payload.cursos = Array.from(document.querySelectorAll('input[name="roles-cursos-opcao"]:checked'))
                .map(function (node) { return node.value; })
                .join(' || ');
        }
        if (activeEditMode === 'medalhas') {
            const selected = Array.from(document.querySelectorAll('input[name="roles-medalhas-opcao"]:checked'))
                .map(function (node) { return node.value; })
                .filter(Boolean);

            setStatus('Salvando condecorações...');
            const currentResult = await supabaseClient
                .from('profile_medals')
                .select('medal_code')
                .eq('user_id', userId);

            if (currentResult.error) {
                setStatus('Falha ao carregar condecorações: ' + currentResult.error.message, true);
                return;
            }

            const current = (currentResult.data || []).map(function (m) { return m.medal_code; }).filter(Boolean);
            const toAdd = selected.filter(function (code) { return !current.includes(code); });
            const toRemove = current.filter(function (code) { return !selected.includes(code); });

            if (toAdd.length) {
                const rows = toAdd.map(function (code) {
                    const conf = MEDAL_OPTIONS.find(function (m) { return m.code === code; }) || {};
                    return {
                        user_id: userId,
                        medal_code: code,
                        medal_name: conf.name || code,
                        medal_image: conf.image || 'mencaoelogio.png'
                    };
                });
                const insertResult = await supabaseClient.from('profile_medals').insert(rows);
                if (insertResult.error) {
                    setStatus('Falha ao adicionar condecorações: ' + insertResult.error.message, true);
                    return;
                }
            }

            if (toRemove.length) {
                const delResult = await supabaseClient
                    .from('profile_medals')
                    .delete()
                    .eq('user_id', userId)
                    .in('medal_code', toRemove);
                if (delResult.error) {
                    setStatus('Falha ao remover condecorações: ' + delResult.error.message, true);
                    return;
                }
            }

            closeRoleModal();
            setStatus('Condecorações atualizadas com sucesso.');
            await loadProfiles();
            return;
        }

        setStatus('Salvando ediÃ§Ã£o...');
        const result = await supabaseClient.from('profiles').update(payload).eq('id', userId);
        if (result.error) {
            setStatus('Falha ao salvar ediÃ§Ã£o: ' + result.error.message, true);
            return;
        }

        closeRoleModal();
        setStatus('EdiÃ§Ã£o salva com sucesso.');
        await loadProfiles();
    }

    function buildProfileCard(profile) {
        const coursesText = parseCursos(profile.cursos).join(' | ') || 'Sem cursos';
        const groupedPrimary = resolveGrupamentoPrincipal(profile) || '-';
        const groupedSecondary = resolveGrupamentoSecundario(profile) || '-';
        const acessoLabel = profile.acesso || '-';
        const approved = profile.aprovado === true;
        const statusClass = approved ? 'badge-ok' : 'badge-pending';
        const statusText = approved ? 'Aprovado' : 'Pendente';
        const photo = profile.foto_url ? escapeHtml(profile.foto_url) : 'assets/img/prf.png';
        const shiftStatusRaw = String(profile.shift_status || '').toLowerCase();
        const shiftStatus = shiftStatusRaw === 'em_servico'
            ? 'Em serviço'
            : shiftStatusRaw === 'encerrado'
                ? 'Serviço encerrado'
                : 'Sem registro';
        const shiftMinutes = Number(profile.shift_minutes || 0);
        const shiftTime = shiftMinutes > 0
            ? (String(Math.floor(shiftMinutes / 60)).padStart(2, '0') + ':' + String(shiftMinutes % 60).padStart(2, '0'))
            : '-';
        const shiftLastAt = profile.shift_last_at ? formatDate(profile.shift_last_at) : '-';

        return '<article class="approvals-user-card">' +
            '<div class="approvals-user-head">' +
                '<img src="' + photo + '" alt="Foto de perfil" class="approvals-user-photo">' +
                '<div class="approvals-user-main">' +
                    '<h3>' + escapeHtml(profile.nome_guerra || '-') + '</h3>' +
                    '<p class="approvals-user-sub">' + escapeHtml(profile.email || '-') + '</p>' +
                    '<div class="approvals-user-meta">' +
                        '<span><strong>RG:</strong> ' + escapeHtml(profile.rg || '-') + '</span>' +
                        '<span><strong>Cargo:</strong> ' + escapeHtml(profile.cargo || '-') + '</span>' +
                        '<span><strong>Grupamento principal:</strong> ' + escapeHtml(groupedPrimary) + '</span>' +
                        '<span><strong>Grupamento secundário:</strong> ' + escapeHtml(groupedSecondary) + '</span>' +
                        '<span><strong>Acesso:</strong> ' + escapeHtml(acessoLabel) + '</span>' +
                        '<span><strong>Cursos:</strong> ' + escapeHtml(coursesText) + '</span>' +
                        '<span><strong>Admin:</strong> ' + (profile.is_admin ? 'Sim' : 'Não') + '</span>' +
                        '<span><strong>Ponto:</strong> ' + escapeHtml(shiftStatus) + '</span>' +
                        '<span><strong>Tempo de serviço:</strong> ' + escapeHtml(shiftTime) + '</span>' +
                        '<span><strong>Último bate-ponto:</strong> ' + escapeHtml(shiftLastAt) + '</span>' +
                        '<span><strong>Criado em:</strong> ' + escapeHtml(formatDate(profile.created_at)) + '</span>' +
                    '</div>' +
                '</div>' +
                '<span class="approvals-badge ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<div class="approvals-primary-actions">' +
                '<button class="approvals-btn success" data-action="toggle" data-id="' + escapeHtml(profile.id) + '" data-approved="' + (approved ? 'true' : 'false') + '">' + (approved ? 'Recusar perfil' : 'Aceitar perfil') + '</button>' +
                '<button class="approvals-btn warn" data-action="reject-delete" data-id="' + escapeHtml(profile.id) + '">Recusar perfil e apagar dados</button>' +
                '<button class="approvals-btn danger" data-action="revoke-delete" data-id="' + escapeHtml(profile.id) + '">Retirar acesso e apagar dados</button>' +
            '</div>' +
            '<div class="approvals-secondary-actions">' +
                '<button class="approvals-btn" data-action="edit-cargo" data-id="' + escapeHtml(profile.id) + '">Editar cargo</button>' +
                '<button class="approvals-btn" data-action="edit-grupamento" data-id="' + escapeHtml(profile.id) + '">Editar grupamento</button>' +
                '<button class="approvals-btn" data-action="edit-acesso" data-id="' + escapeHtml(profile.id) + '">Editar acesso</button>' +
                '<button class="approvals-btn" data-action="edit-cursos" data-id="' + escapeHtml(profile.id) + '">Editar cursos</button>' +
                '<button class="approvals-btn" data-action="edit-medalhas" data-id="' + escapeHtml(profile.id) + '">Editar condecorações</button>' +
            '</div>' +
            '<div class="approvals-history-actions">' +
                '<button class="approvals-btn" data-action="history-bou" data-id="' + escapeHtml(profile.id) + '">BOU (realizado/citado)</button>' +
                '<button class="approvals-btn" data-action="history-ait" data-id="' + escapeHtml(profile.id) + '">AIT (realizado/citado)</button>' +
                '<button class="approvals-btn" data-action="history-patrulha" data-id="' + escapeHtml(profile.id) + '">Patrulha (realizado/citado)</button>' +
                '<button class="approvals-btn" data-action="history-aluno" data-id="' + escapeHtml(profile.id) + '">Relatório aluno (citado)</button>' +
            '</div>' +
        '</article>';
    }

    function bindProfileActions() {
        const node = byId('aprovacoes-cards');
        if (!node) return;
        node.querySelectorAll('button[data-action]').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                const profile = profilesCache.find(function (p) { return String(p.id) === String(id); });
                if (!profile) return;

                if (action === 'toggle') {
                    const approved = btn.getAttribute('data-approved') === 'true';
                    await updateApproval(id, !approved);
                    return;
                }
                if (action === 'reject-delete') {
                    await deleteProfile(id, 'Tem certeza que deseja recusar o perfil e apagar os dados?', 'Perfil recusado e dados removidos com sucesso.');
                    return;
                }
                if (action === 'revoke-delete') {
                    await deleteProfile(id, 'Tem certeza que deseja retirar o acesso e apagar os dados?', 'Acesso retirado e dados removidos com sucesso.');
                    return;
                }
                if (action === 'edit-cargo') openEditModal(profile, 'cargo');
                if (action === 'edit-grupamento') openEditModal(profile, 'grupamento');
                if (action === 'edit-acesso') openEditModal(profile, 'acesso');
                if (action === 'edit-cursos') openEditModal(profile, 'cursos');
                if (action === 'edit-medalhas') openEditModal(profile, 'medalhas');
                if (action === 'history-bou') await openHistoryModal(profile, 'bou');
                if (action === 'history-ait') await openHistoryModal(profile, 'ait');
                if (action === 'history-patrulha') await openHistoryModal(profile, 'patrulha');
                if (action === 'history-aluno') await openHistoryModal(profile, 'aluno');
            });
        });
    }

    function renderProfiles(list) {
        const node = byId('aprovacoes-cards');
        if (!node) return;
        if (!Array.isArray(list) || !list.length) {
            node.innerHTML = '<div class="approvals-empty">Nenhum usuÃ¡rio encontrado.</div>';
            return;
        }
        node.innerHTML = list.map(buildProfileCard).join('');
        bindProfileActions();
    }

    async function loadProfiles() {
        setStatus('Carregando usuários...');
        const result = await supabaseClient
            .from('profiles')
            .select('id,email,nome_guerra,rg,cargo,grupamento,grupamento_principal,grupamento_secundario,acesso,cursos,unidade,foto_url,created_at,aprovado,is_admin')
            .order('created_at', { ascending: false });
        if (result.error) {
            setStatus('Falha ao carregar usuários: ' + result.error.message, true);
            return;
        }

        profilesCache = result.data || [];

        try {
            const pontosResult = await supabaseClient
                .from('agent_pontos')
                .select('user_id,status,duracao_min,inicio_at,fim_at,created_at')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (!pontosResult.error && Array.isArray(pontosResult.data)) {
                const latestByUser = {};
                pontosResult.data.forEach(function (row) {
                    if (!row || !row.user_id) return;
                    if (!latestByUser[row.user_id]) latestByUser[row.user_id] = row;
                });

                profilesCache = profilesCache.map(function (profile) {
                    const point = latestByUser[profile.id];
                    const liveMinutes = point && point.status === 'em_servico' && point.inicio_at
                        ? Math.max(0, Math.floor((Date.now() - new Date(point.inicio_at).getTime()) / 60000))
                        : 0;
                    return Object.assign({}, profile, {
                        shift_status: point ? point.status : '',
                        shift_minutes: liveMinutes || Number(point && point.duracao_min ? point.duracao_min : 0),
                        shift_last_at: point ? (point.fim_at || point.inicio_at || point.created_at || null) : null
                    });
                });
            }
        } catch (e) {
            /* fallback sem dados de ponto */
        }

        renderProfiles(profilesCache);
        setStatus('');
    }

    function renderLogs(logs, usersById) {
        const tbody = byId('logs-tbody');
        if (!tbody) return;
        if (!Array.isArray(logs) || !logs.length) {
            tbody.innerHTML = '<tr><td colspan="7">Nenhum log encontrado.</td></tr>';
            return;
        }
        tbody.innerHTML = logs.map(function (row) {
            const userInfo = usersById[row.triggered_by] || null;
            const userLabel = userInfo ? (userInfo.nome_guerra || userInfo.email || row.triggered_by) : row.triggered_by;
            const statusRaw = String(row.status || '').toLowerCase();
            const statusClass = statusRaw === 'failed' ? 'badge-failed' : (statusRaw === 'queued' ? 'badge-pending' : 'badge-ok');
            return '<tr>' +
                '<td>' + escapeHtml(String(row.id || '-')) + '</td>' +
                '<td>' + escapeHtml(String(row.bou_id || '-')) + '</td>' +
                '<td>' + escapeHtml(String(userLabel || '-')) + '</td>' +
                '<td>' + escapeHtml(String(row.request_id || '-')) + '</td>' +
                '<td><span class="approvals-badge ' + statusClass + '">' + escapeHtml(String(row.status || '-')) + '</span></td>' +
                '<td>' + escapeHtml(String(row.error_msg || '-')) + '</td>' +
                '<td>' + escapeHtml(formatDate(row.created_at)) + '</td>' +
            '</tr>';
        }).join('');
    }

    function getLogStatusClass(statusText) {
        const raw = String(statusText || '').toLowerCase();
        if (raw.includes('fail') || raw.includes('error')) return 'badge-failed';
        if (raw.includes('queued') || raw.includes('pending')) return 'badge-pending';
        return 'badge-ok';
    }

    function pickFirstField(row, fields) {
        for (let i = 0; i < fields.length; i += 1) {
            const key = fields[i];
            if (row && row[key] !== null && row[key] !== undefined) return row[key];
        }
        return null;
    }

    function normalizeLogRow(row, idFields) {
        const reportId = pickFirstField(row, idFields);
        const triggeredBy = row.triggered_by || row.user_id || row.created_by || row.owner_id || '-';
        const requestId = row.request_id || row.http_request_id || row.net_request_id || '-';
        const statusRaw = row.status || (row.http_status ? 'http' : '-') || '-';
        const httpSuffix = row.http_status ? (' (HTTP ' + String(row.http_status) + ')') : '';
        const statusText = (statusRaw === 'http' ? 'status' : String(statusRaw)) + httpSuffix;
        const errorMsg = row.error_msg || row.error_message || row.error || '-';
        const createdAt = row.created_at || row.data_criacao || row.data || null;
        return {
            id: row.id || '-',
            reportId: reportId !== null && reportId !== undefined ? reportId : '-',
            triggeredBy,
            requestId,
            statusText,
            statusClass: getLogStatusClass(statusText),
            errorMsg,
            createdAt
        };
    }

    function renderTypedLogs(tbodyId, logs, usersById, idLabel) {
        const tbody = byId(tbodyId);
        if (!tbody) return;
        if (!Array.isArray(logs) || !logs.length) {
            tbody.innerHTML = '<tr><td colspan="7">Nenhum log encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(function (row) {
            const userInfo = usersById[row.triggeredBy] || null;
            const userLabel = userInfo ? (userInfo.nome_guerra || userInfo.email || row.triggeredBy) : row.triggeredBy;
            return '<tr>' +
                '<td>' + escapeHtml(String(row.id || '-')) + '</td>' +
                '<td>' + escapeHtml(String(row.reportId || '-')) + '</td>' +
                '<td>' + escapeHtml(String(userLabel || '-')) + '</td>' +
                '<td>' + escapeHtml(String(row.requestId || '-')) + '</td>' +
                '<td><span class="approvals-badge ' + row.statusClass + '">' + escapeHtml(String(row.statusText || '-')) + '</span></td>' +
                '<td>' + escapeHtml(String(row.errorMsg || '-')) + '</td>' +
                '<td>' + escapeHtml(formatDate(row.createdAt)) + '</td>' +
            '</tr>';
        }).join('');
    }

    function formatTimeOnly(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleTimeString('pt-BR', { hour12: false });
    }

    function calcDurationMinutes(row) {
        const direct = Number(row && row.duracao_min ? row.duracao_min : 0);
        if (direct > 0) return direct;
        const start = row && row.inicio_at ? new Date(row.inicio_at).getTime() : NaN;
        const end = row && row.fim_at ? new Date(row.fim_at).getTime() : Date.now();
        if (Number.isNaN(start)) return 0;
        return Math.max(0, Math.floor((end - start) / 60000));
    }

    function toHm(minutes) {
        const safe = Math.max(0, Number(minutes || 0));
        const h = Math.floor(safe / 60);
        const m = safe % 60;
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function renderPontos(rows, usersById) {
        const tbody = byId('pontos-tbody');
        if (!tbody) return;
        if (!Array.isArray(rows) || !rows.length) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhum bate-ponto registrado nesta data.</td></tr>';
            return;
        }

        const grouped = {};
        rows.forEach(function (row) {
            if (!row || !row.user_id) return;
            if (!grouped[row.user_id]) grouped[row.user_id] = [];
            grouped[row.user_id].push(row);
        });

        const orderedUserIds = Object.keys(grouped).sort(function (a, b) {
            const listA = grouped[a] || [];
            const listB = grouped[b] || [];
            const timeA = listA.length ? new Date(listA[0].inicio_at || listA[0].created_at || 0).getTime() : 0;
            const timeB = listB.length ? new Date(listB[0].inicio_at || listB[0].created_at || 0).getTime() : 0;
            return timeB - timeA;
        });

        tbody.innerHTML = orderedUserIds.map(function (userId) {
            const user = usersById[userId] || null;
            const userLabel = user ? (user.nome_guerra || user.email || userId) : userId;
            const rg = user && user.rg ? user.rg : '-';
            const list = (grouped[userId] || []).slice().sort(function (a, b) {
                const ta = new Date(a.inicio_at || a.created_at || 0).getTime();
                const tb = new Date(b.inicio_at || b.created_at || 0).getTime();
                return ta - tb;
            });

            const intervalsHtml = list.map(function (item, idx) {
                const start = formatTimeOnly(item.inicio_at);
                const end = item.fim_at ? formatTimeOnly(item.fim_at) : 'Em aberto';
                const dur = toHm(calcDurationMinutes(item));
                return '<div class="approvals-point-line">' +
                    '<strong>#' + String(idx + 1) + '</strong> ' +
                    escapeHtml(start) + ' - ' + escapeHtml(end) +
                    ' <span>(' + escapeHtml(dur) + ')</span>' +
                '</div>';
            }).join('');

            const totalMinutes = list.reduce(function (acc, item) {
                return acc + calcDurationMinutes(item);
            }, 0);
            const hasOpen = list.some(function (item) { return String(item.status || '').toLowerCase() === 'em_servico' || !item.fim_at; });
            const statusLabel = hasOpen ? 'Em serviço' : 'Encerrado';
            const statusClass = hasOpen ? 'badge-pending' : 'badge-ok';

            return '<tr>' +
                '<td>' + escapeHtml(String(userLabel || '-')) + '</td>' +
                '<td>' + escapeHtml(String(rg || '-')) + '</td>' +
                '<td>' + intervalsHtml + '</td>' +
                '<td>' + escapeHtml(toHm(totalMinutes)) + '</td>' +
                '<td><span class="approvals-badge ' + statusClass + '">' + escapeHtml(statusLabel) + '</span></td>' +
            '</tr>';
        }).join('');
    }

    function getDateRangeIso(dateText) {
        const safe = String(dateText || '').trim();
        const base = safe ? new Date(safe + 'T00:00:00') : new Date();
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
        const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0, 0);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
    }

    async function loadPontosCalendar() {
        setPontosStatus('Carregando calendário...');
        const input = byId('pontos-date');
        const selectedDate = input && input.value ? input.value : new Date().toISOString().slice(0, 10);
        const range = getDateRangeIso(selectedDate);

        const pointsResult = await supabaseClient
            .from('agent_pontos')
            .select('user_id,inicio_at,fim_at,status,duracao_min,created_at')
            .gte('inicio_at', range.startIso)
            .lt('inicio_at', range.endIso)
            .order('inicio_at', { ascending: false })
            .limit(2000);

        if (pointsResult.error) {
            setPontosStatus('Falha ao carregar calendário: ' + pointsResult.error.message, true);
            renderPontos([], {});
            return;
        }

        const rows = pointsResult.data || [];
        const ids = Array.from(new Set(rows.map(function (r) { return r.user_id; }).filter(Boolean)));
        const usersById = {};
        if (ids.length) {
            const usersResult = await supabaseClient
                .from('profiles')
                .select('id,nome_guerra,email,rg')
                .in('id', ids);
            if (!usersResult.error && Array.isArray(usersResult.data)) {
                usersResult.data.forEach(function (u) { usersById[u.id] = u; });
            }
        }

        renderPontos(rows, usersById);
        setPontosStatus('');
    }

    function isRelationMissing(error) {
        if (!error) return false;
        const msg = String(error.message || error).toLowerCase();
        return msg.includes('does not exist') || msg.includes('relation') && msg.includes('does not exist');
    }

    async function fetchLogsFromTable(table, limit) {
        return supabaseClient
            .from(table)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit || 200);
    }

    async function loadTypedLogs(typeKey, config, incongruencias) {
        setTypedLogStatus(config.statusId, 'Carregando logs...');

        const result = await fetchLogsFromTable(config.table, config.limit || 200);
        if (result.error) {
            setTypedLogStatus(config.statusId, 'Falha ao carregar logs: ' + result.error.message, true);
            const tbody = byId(config.tbodyId);
            if (tbody) tbody.innerHTML = '<tr><td colspan="7">Falha ao carregar logs.</td></tr>';
            incongruencias.push(config.label + ': erro ao consultar logs (' + (result.error.message || result.error) + ').');
            return;
        }

        const normalized = (result.data || []).map(function (row) { return normalizeLogRow(row, config.idFields); });
        const ids = Array.from(new Set(normalized.map(function (r) { return r.triggeredBy; }).filter(Boolean)));
        const usersById = {};
        if (ids.length) {
            const usersResult = await supabaseClient.from('profiles').select('id,nome_guerra,email').in('id', ids);
            if (!usersResult.error && Array.isArray(usersResult.data)) {
                usersResult.data.forEach(function (u) { usersById[u.id] = u; });
            }
        }
        renderTypedLogs(config.tbodyId, normalized, usersById, config.idLabel);
        setTypedLogStatus(config.statusId, '');
    }

    function renderIncongruencias(list) {
        const node = byId('logs-incongruencias');
        const status = byId('logs-incongruencias-status');
        if (!node) return;
        if (!list || !list.length) {
            node.innerHTML = '<div class="approvals-empty">Nenhuma incongruência identificada.</div>';
            if (status) status.textContent = '';
            return;
        }
        node.innerHTML = list.map(function (item) {
            return '<div class="history-item"><p>' + escapeHtml(item) + '</p></div>';
        }).join('');
        if (status) status.textContent = 'Incongruências detectadas: ' + list.length;
    }

    async function loadAllLogs() {
        const incongruencias = [];
        const configs = [
            {
                key: 'bou',
                label: 'BOU',
                tbodyId: 'logs-tbody',
                statusId: 'logs-status',
                idFields: ['bou_id', 'registro_id', 'id_registro'],
                table: 'bou_dispatch_log'
            },
            {
                key: 'ait',
                label: 'AIT',
                tbodyId: 'logs-ait-tbody',
                statusId: 'logs-ait-status',
                idFields: ['ait_id', 'registro_id', 'id_registro'],
                table: 'ait_dispatch_log'
            },
            {
                key: 'ripat',
                label: 'RIPAT',
                tbodyId: 'logs-ripat-tbody',
                statusId: 'logs-ripat-status',
                idFields: ['patrulha_id', 'ripat_id', 'registro_id', 'id_registro'],
                table: 'patrulha_dispatch_log'
            },
            {
                key: 'ace',
                label: 'ACE',
                tbodyId: 'logs-ace-tbody',
                statusId: 'logs-ace-status',
                idFields: ['ace_id', 'relatorio_id', 'registro_id', 'id_registro'],
                table: 'ace_dispatch_log'
            },
            {
                key: 'ravop',
                label: 'RAVOP',
                tbodyId: 'logs-ravop-tbody',
                statusId: 'logs-ravop-status',
                idFields: ['relatorio_id', 'ravop_id', 'registro_id', 'id_registro'],
                table: 'ravop_dispatch_log'
            }
        ];

        for (let i = 0; i < configs.length; i += 1) {
            await loadTypedLogs(configs[i].key, configs[i], incongruencias);
        }
        renderIncongruencias(incongruencias);
    }

    function renderCursosCheckboxes() {
        const box = byId('roles-cursos');
        if (!box) return;
        box.innerHTML = CURSOS_OPTIONS.map(function (course) {
            return '<label><input type="checkbox" name="roles-cursos-opcao" value="' + escapeHtml(course) + '"> ' + escapeHtml(course) + '</label>';
        }).join('');
    }

    document.addEventListener('DOMContentLoaded', async function () {
        renderCursosCheckboxes();
        const ok = await ensureAdmin();
        if (!ok) return;

        byId('aprovacoes-reload').addEventListener('click', function () { loadProfiles(); });
        byId('logs-reload').addEventListener('click', function () { loadAllLogs(); });
        if (byId('logs-ait-reload')) byId('logs-ait-reload').addEventListener('click', function () { loadAllLogs(); });
        if (byId('logs-ripat-reload')) byId('logs-ripat-reload').addEventListener('click', function () { loadAllLogs(); });
        if (byId('logs-ace-reload')) byId('logs-ace-reload').addEventListener('click', function () { loadAllLogs(); });
        if (byId('logs-ravop-reload')) byId('logs-ravop-reload').addEventListener('click', function () { loadAllLogs(); });
        if (byId('pontos-date')) byId('pontos-date').value = new Date().toISOString().slice(0, 10);
        byId('pontos-reload').addEventListener('click', function () { loadPontosCalendar(); });
        byId('pontos-date').addEventListener('change', function () { loadPontosCalendar(); });
        byId('roles-modal-close').addEventListener('click', closeRoleModal);
        byId('roles-modal-cancel').addEventListener('click', closeRoleModal);
        byId('roles-modal-save').addEventListener('click', function () { saveRoleModal(); });
        byId('roles-modal').addEventListener('click', function (event) {
            if (event.target === byId('roles-modal')) closeRoleModal();
        });
        byId('history-modal-close').addEventListener('click', closeHistoryModal);
        byId('history-modal-close-bottom').addEventListener('click', closeHistoryModal);
        byId('history-modal').addEventListener('click', function (event) {
            if (event.target === byId('history-modal')) closeHistoryModal();
        });

        await loadProfiles();
        await loadAllLogs();
        await loadPontosCalendar();
    });
})();



