'use strict';

(function () {
    const el = {
        status: document.getElementById('gerenciamento-status'),
        grid: document.getElementById('gerenciamento-grid')
    };

    function normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function safe(value, fallback) {
        const s = String(value || '').trim();
        return s || (fallback || '-');
    }

    function parseGroups(value) {
        return String(value || '')
            .split(' || ')
            .map(function (v) { return v.trim(); })
            .filter(Boolean);
    }

    function resolvePrimaryGroup(profile) {
        const direct = String(profile && profile.grupamento_principal ? profile.grupamento_principal : '').trim();
        if (direct) return direct;
        const legacy = parseGroups(profile && profile.grupamento ? profile.grupamento : '');
        return legacy.length ? legacy[0] : '';
    }

    function resolveSecondaryGroup(profile) {
        const direct = String(profile && profile.grupamento_secundario ? profile.grupamento_secundario : '').trim();
        if (direct) return direct;
        const legacy = parseGroups(profile && profile.grupamento ? profile.grupamento : '');
        return legacy.length > 1 ? legacy[1] : '';
    }

    function buildTokens(profile) {
        const raw = [profile.nome_guerra, profile.rg, profile.email].filter(Boolean);
        const tokens = raw.map(normalize).filter(function (v) { return v.length >= 3; });
        const nomeParts = String(profile.nome_guerra || '')
            .split(' ')
            .map(function (v) { return normalize(v); })
            .filter(function (v) { return v.length >= 4; });
        return Array.from(new Set(tokens.concat(nomeParts)));
    }

    function hasMention(row, tokens, userId) {
        if (!row || !tokens.length) return false;
        if (row.user_id && String(row.user_id) === String(userId)) return false;
        const source = normalize([
            row.conteudo_completo,
            row.texto,
            row.observacoes,
            row.relato,
            row.detalhes,
            row.resumo,
            row.titulo,
            row.subtitulo,
            row.numero_ait
        ].join(' '));
        return tokens.some(function (t) { return source.includes(t); });
    }

    function minutesToHhmm(totalMinutes) {
        const safeMinutes = Math.max(0, Math.floor(Number(totalMinutes || 0)));
        const h = Math.floor(safeMinutes / 60);
        const m = safeMinutes % 60;
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function overlapMinutes(start, end, windowStart, windowEnd) {
        const s = Math.max(start, windowStart);
        const e = Math.min(end, windowEnd);
        if (e <= s) return 0;
        return Math.floor((e - s) / 60000);
    }

    function rolePriority(cargo) {
        const c = normalize(cargo);
        if (c.includes('chefe de divisao')) return 1;
        if (c.includes('chefe de serviço') || c.includes('chefe de servico')) return 2;
        return 3;
    }

    function formatTeamCard(member) {
        const foto = safe(member.foto_url, 'assets/img/prf.png');
        return `
            <div class="gerenciamento-card">
                <div class="gerenciamento-card-head">
                    <img src="${foto}" alt="${member.nome}" class="gerenciamento-avatar" onerror="this.src='assets/img/prf.png'">
                    <div>
                        <div class="gerenciamento-name">${member.nome}</div>
                        <div class="gerenciamento-meta">RG: ${member.rg} • ${member.cargo}</div>
                        <div class="gerenciamento-meta">Principal: ${member.grupamentoPrincipal} | Secundário: ${member.grupamentoSecundario}</div>
                    </div>
                </div>
                <div class="gerenciamento-metrics">
                    <div><strong>${member.serviceTotal}</strong><span>Serviço total</span></div>
                    <div><strong>${member.service7}</strong><span>Últimos 7 dias</span></div>
                    <div><strong>${member.bou7}</strong><span>BOU 7 dias</span></div>
                    <div><strong>${member.ait7}</strong><span>AIT 7 dias</span></div>
                    <div><strong>${member.ripat7}</strong><span>RIPAT 7 dias</span></div>
                </div>
            </div>
        `;
    }

    function render(list, options) {
        if (!el.grid) return;
        if (!list.length) {
            el.grid.innerHTML = '<div class="info-card"><p>Nenhum registro disponível.</p></div>';
            return;
        }
        const groupMode = options && options.groupMode;
        if (!groupMode) {
            el.grid.innerHTML = list.map(formatTeamCard).join('');
            return;
        }

        const grouped = {};
        list.forEach(function (m) {
            const key = m.grupamentoPrincipal || 'Sem grupamento principal';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(m);
        });

        const headers = Object.keys(grouped).sort(function (a, b) {
            return normalize(a).localeCompare(normalize(b));
        });

        el.grid.innerHTML = headers.map(function (grp) {
            const items = grouped[grp] || [];
            const title = (options && options.groupTitlePrefix)
                ? (options.groupTitlePrefix + grp)
                : grp;
            const countLabel = ' (' + items.length + ')';
            return (
                '<section class="gerenciamento-group">' +
                '<h3 class="gerenciamento-group-title">' + title + countLabel + '</h3>' +
                '<div class="gerenciamento-group-list">' +
                items.map(formatTeamCard).join('') +
                '</div>' +
                '</section>'
            );
        }).join('');
    }

    async function init() {
        if (!window.supabase || !window.supabase.createClient) return;
        const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        const sessionResult = await client.auth.getSession();
        const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
        const user = session ? session.user : null;
        if (!user) return;

        const profileResult = await client
            .from('profiles')
            .select('id, nome_guerra, rg, cargo, grupamento, grupamento_principal, grupamento_secundario, is_admin, email')
            .eq('id', user.id)
            .maybeSingle();
        const profile = profileResult && profileResult.data ? profileResult.data : null;
        if (!profile) return;

        const cargoNorm = normalize(profile.cargo || '');
        const isAdmin = profile.is_admin === true;
        const isDiretor = cargoNorm.includes('diretor');
        const isSuperintendente = cargoNorm.includes('superintendente');
        const isCoordenador = cargoNorm.includes('coordenador');
        const isChefeDiv = cargoNorm.includes('chefe de divisao');
        const isChefeServ = cargoNorm.includes('chefe de serviço') || cargoNorm.includes('chefe de servico');

        const canAccess = isAdmin || isDiretor || isSuperintendente || isCoordenador || isChefeDiv || isChefeServ;
        if (!canAccess) {
            if (el.status) {
                el.status.textContent = 'Seu perfil não possui permissão para acessar este painel.';
                el.status.style.color = '#b42318';
            }
            render([]);
            return;
        }

        let allowedGroups = [];
        let coordinatorScoped = false;
        const ownPrimary = resolvePrimaryGroup(profile);
        const ownSecondary = resolveSecondaryGroup(profile);
        const ownGroups = [ownPrimary, ownSecondary].concat(parseGroups(profile.grupamento || '')).filter(Boolean);
        const ownPrimaryNorm = normalize(ownPrimary);
        if (isAdmin || isDiretor || isSuperintendente) {
            allowedGroups = [];
        } else if (isChefeDiv || isChefeServ) {
            allowedGroups = ownGroups;
        } else if (isCoordenador) {
            coordinatorScoped = true;
            const isDiretoriaExecutiva = ownPrimaryNorm === normalize('Diretoria Executiva')
                || ownPrimaryNorm === normalize('Diretoria Exectuiva');
            const isDiretoriaOperacional = ownPrimaryNorm === normalize('Diretoria Operacional');
            if (isDiretoriaExecutiva) {
                allowedGroups = [
                    'Ronda PRF',
                    'Grupo de Patrulhamento Motorizado',
                    'Universidade Corporativa da PRF'
                ];
            } else if (isDiretoriaOperacional) {
                allowedGroups = [
                    'Grupo de Patrulhamento Tático',
                    'Divisão de Operações Aéreas',
                    'Núcleo de Operações Especiais'
                ];
            } else {
                allowedGroups = ['__sem_escopo__'];
            }
        }

        if (el.status) {
            el.status.textContent = 'Carregando equipe...';
            el.status.style.color = '#475569';
        }

        const profilesResult = await client
            .from('profiles')
            .select('id, nome_guerra, rg, cargo, grupamento, grupamento_principal, grupamento_secundario, foto_url, email')
            .eq('aprovado', true)
            .order('nome_guerra', { ascending: true });
        if (profilesResult.error) {
            if (el.status) {
                el.status.textContent = 'Falha ao carregar equipe: ' + profilesResult.error.message;
                el.status.style.color = '#b42318';
            }
            return;
        }

        let profiles = Array.isArray(profilesResult.data) ? profilesResult.data : [];
        if (isChefeDiv || isChefeServ) {
            const ownPrimaryNorm = normalize(ownPrimary);
            profiles = profiles.filter(function (p) {
                const pPrimary = resolvePrimaryGroup(p);
                const pSecondary = resolveSecondaryGroup(p);
                const pPrimaryNorm = normalize(pPrimary);
                const pSecondaryNorm = normalize(pSecondary);

                if (!ownPrimaryNorm) return false;
                if (ownPrimaryNorm === normalize('Ronda PRF')) {
                    return pPrimaryNorm === ownPrimaryNorm || pSecondaryNorm === ownPrimaryNorm;
                }
                return pPrimaryNorm === ownPrimaryNorm;
            });
        } else if (coordinatorScoped) {
            const allowedNorm = allowedGroups.map(normalize);
            profiles = profiles.filter(function (p) {
                const pPrimaryNorm = normalize(resolvePrimaryGroup(p));
                return allowedNorm.includes(pPrimaryNorm);
            });
        } else if (allowedGroups.length) {
            const allowedNorm = allowedGroups.map(normalize);
            profiles = profiles.filter(function (p) {
                const groups = [resolvePrimaryGroup(p), resolveSecondaryGroup(p)]
                    .concat(parseGroups(p.grupamento || ''))
                    .filter(Boolean);
                return groups.some(function (g) { return allowedNorm.includes(normalize(g)); });
            });
        }

        const ids = profiles.map(function (p) { return p.id; }).filter(Boolean);
        if (!ids.length) {
            if (el.status) {
                el.status.textContent = 'Nenhum membro encontrado para seu grupamento.';
                el.status.style.color = '#b42318';
            }
            render([]);
            return;
        }

        const now = Date.now();
        const windowStart = now - 7 * 24 * 60 * 60 * 1000;

        const pontosResult = await client
            .from('agent_pontos')
            .select('user_id,inicio_at,fim_at,duracao_min,status')
            .in('user_id', ids)
            .order('inicio_at', { ascending: false });
        const pontos = Array.isArray(pontosResult.data) ? pontosResult.data : [];

        const bousResult = await client.from('bous').select('id,user_id,conteudo_completo,created_at,data_criacao');
        const aitsResult = await client.from('aits').select('id,user_id,conteudo_completo,numero_ait,created_at,data_criacao');
        const ripatResult = await client
            .from('patrulhas')
            .select('id,user_id,conteudo_completo,created_at,data_criacao');
        const ripatAltResult = await client
            .from('relatorios_patrulha')
            .select('id,user_id,conteudo_completo,created_at,data_criacao');

        const bous = Array.isArray(bousResult.data) ? bousResult.data : [];
        const aits = Array.isArray(aitsResult.data) ? aitsResult.data : [];
        const ripats = (Array.isArray(ripatResult.data) ? ripatResult.data : [])
            .concat(Array.isArray(ripatAltResult.data) ? ripatAltResult.data : []);

        const userTokens = {};
        profiles.forEach(function (p) {
            userTokens[p.id] = buildTokens(p);
        });

        const baseMembers = profiles.map(function (p) {
            const tokens = userTokens[p.id] || [];
            let totalMinutes = 0;
            let last7Minutes = 0;
            pontos.forEach(function (row) {
                if (String(row.user_id) !== String(p.id)) return;
                const start = row.inicio_at ? new Date(row.inicio_at).getTime() : null;
                const end = row.fim_at ? new Date(row.fim_at).getTime() : null;
                if (start && end) {
                    const mins = row.duracao_min ? Number(row.duracao_min) : Math.floor((end - start) / 60000);
                    totalMinutes += Math.max(0, mins);
                    last7Minutes += overlapMinutes(start, end, windowStart, now);
                } else if (start && row.status === 'em_servico') {
                    const mins = Math.floor((now - start) / 60000);
                    totalMinutes += Math.max(0, mins);
                    last7Minutes += overlapMinutes(start, now, windowStart, now);
                }
            });

            const countRecent = function (rows) {
                let made = 0;
                let cited = 0;
                rows.forEach(function (row) {
                    const dateRaw = row.data_criacao || row.created_at;
                    const when = dateRaw ? new Date(dateRaw).getTime() : 0;
                    if (when < windowStart) return;
                    if (String(row.user_id) === String(p.id)) {
                        made += 1;
                    } else if (hasMention(row, tokens, p.id)) {
                        cited += 1;
                    }
                });
                return made + cited;
            };

            return {
                id: p.id,
                nome: safe(p.nome_guerra, 'Agente'),
                rg: safe(p.rg, '-'),
                cargo: safe(p.cargo, '-'),
                grupamentoPrincipal: resolvePrimaryGroup(p) || '-',
                grupamentoSecundario: resolveSecondaryGroup(p) || '-',
                foto_url: p.foto_url || 'assets/img/prf.png',
                serviceTotal: minutesToHhmm(totalMinutes),
                service7: minutesToHhmm(last7Minutes),
                bou7: countRecent(bous),
                ait7: countRecent(aits),
                ripat7: countRecent(ripats),
                rolePriority: rolePriority(p.cargo || '')
            };
        });

        const members = baseMembers.map(function (base) {
            return {
                nome: base.nome,
                rg: base.rg,
                cargo: base.cargo,
                grupamentoPrincipal: base.grupamentoPrincipal,
                grupamentoSecundario: base.grupamentoSecundario,
                foto_url: base.foto_url,
                serviceTotal: base.serviceTotal,
                service7: base.service7,
                bou7: base.bou7,
                ait7: base.ait7,
                ripat7: base.ripat7,
                rolePriority: base.rolePriority
            };
        });

        members.sort(function (a, b) {
            if (a.rolePriority !== b.rolePriority) return a.rolePriority - b.rolePriority;
            return normalize(a.nome).localeCompare(normalize(b.nome));
        });

        if (el.status) {
            el.status.textContent = 'Equipe carregada.';
            el.status.style.color = '#166534';
        }
        const groupMode = (isAdmin || isDiretor || isSuperintendente || isCoordenador || isChefeDiv)
            ? 'grupamento'
            : '';
        const groupTitlePrefix = isChefeDiv ? 'Grupamento: ' : '';

        render(members, { groupMode: groupMode, groupTitlePrefix: groupTitlePrefix });
    }

    init();
})();
