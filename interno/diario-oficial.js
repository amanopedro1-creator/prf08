"use strict";

(function () {
    let client = null;
    let currentUser = null;
    let isAdmin = false;
    let canPublish = false;
    let currentDiarios = [];
    let currentUserName = "";
    let currentUserCargo = "";
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1474964160054952079/Z4JPYwL70v554ZyJ7Wgur_mshHz-_dhoBsybbX07eYvGcOZ8dfi12OrIT92A6Lj0zjj4";

    function byId(id) { return document.getElementById(id); }

    function setStatus(message, isError) {
        const node = byId("diario-status");
        if (!node) return;
        node.textContent = message || "";
        node.className = isError ? "approvals-status is-error" : "approvals-status";
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatPtDate(dateValue) {
        const d = dateValue ? new Date(dateValue) : new Date();
        return d.toLocaleDateString("pt-BR");
    }

    function formatLongPt(dateValue) {
        const d = dateValue ? new Date(dateValue) : new Date();
        const day = d.getDate();
        const month = d.toLocaleDateString("pt-BR", { month: "long" });
        const year = d.getFullYear();
        return day + " de " + month + " de " + year;
    }

    function formatLongUpper(dateValue) {
        return formatLongPt(dateValue).toUpperCase();
    }

    function splitDiscordChunks(value, maxLen) {
        const text = String(value || "");
        const safeMax = Math.max(200, Number(maxLen) || 1900);
        if (!text) return [""];
        if (text.length <= safeMax) return [text];

        const lines = text.split("\n");
        const chunks = [];
        let current = "";
        const pushCurrent = function () {
            if (current) chunks.push(current);
            current = "";
        };

        lines.forEach(function (line, idx) {
            const withBreak = idx < lines.length - 1 ? (line + "\n") : line;
            if ((current + withBreak).length <= safeMax) {
                current += withBreak;
                return;
            }
            if (current) pushCurrent();
            if (withBreak.length <= safeMax) {
                current = withBreak;
                return;
            }
            for (let i = 0; i < withBreak.length; i += safeMax) {
                chunks.push(withBreak.slice(i, i + safeMax));
            }
        });
        pushCurrent();
        return chunks.length ? chunks : [text.slice(0, safeMax)];
    }

    async function sendDiarioToDiscord(row) {
        if (!DISCORD_WEBHOOK_URL) return;
        const complemento = (row.texto || "").trim();
        const meta = buildMetaLine(row);
        const decreto = buildDecretoTitle(row);
        const assinaturaData = "São Paulo, " + formatLongPt(row.created_at) + ".";
        const assinante = "**" + (currentUserCargo || "Cargo") + " " + (currentUserName || "Usuário") + "**";
        const prefixo = "O DIRETOR-GERAL da Polícia Rodoviária Federal, no uso das atribuições que lhe conferem ";
        const marcacao = "||@👮‍♂️| Polícia Rodoviária Federal ||"
        const body = [
            "**DIÁRIO OFICIAL DA UNIÃO**",
            meta,
            "**Órgão:** Atos do Poder Executivo",
            "",
            "#", decreto,
            prefixo + complemento,
            "",
            assinaturaData,
            assinante,
            marcacao
        ].join("\n");

        const chunks = splitDiscordChunks(body, 1900);
        const MAX_MESSAGES = 100;
        if (chunks.length > MAX_MESSAGES) {
            throw new Error("Texto excede o limite operacional do webhook (" + MAX_MESSAGES + " mensagens).");
        }

        let lastResponse = null;
        let lastMessageId = null;
        for (let i = 0; i < chunks.length; i += 1) {
            const prefix = chunks.length > 1 ? `[Parte ${i + 1}/${chunks.length}]\n` : "";
            const payload = { content: prefix + chunks[i] };
            const response = await fetch(DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const text = await response.text().catch(function () { return ""; });
                throw new Error("Webhook falhou na parte " + (i + 1) + ": " + response.status + " " + text);
            }

            try {
                const json = await response.clone().json();
                if (json && json.id) lastMessageId = String(json.id);
            } catch (e) {
                /* ignore parse errors */
            }
            lastResponse = response;
        }

        return { response: lastResponse, messageId: lastMessageId };
    }

    async function enforceAuth() {
        if (!window.supabase || !window.supabase.createClient) {
            window.location.replace("../login.html");
            return false;
        }
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

        const result = await client.auth.getSession();
        const session = result && result.data ? result.data.session : null;
        currentUser = session ? session.user : null;
        if (!currentUser) {
            window.location.replace("../login.html");
            return false;
        }

        const profileQuery = await client
            .from("profiles")
            .select("aprovado, is_admin, acesso, nome_guerra, cargo")
            .eq("id", currentUser.id)
            .maybeSingle();
        const profile = profileQuery ? profileQuery.data : null;
        const profileError = profileQuery ? profileQuery.error : null;
        if (profileError || !profile || profile.aprovado !== true) {
            await client.auth.signOut();
            window.location.replace("../login.html");
            return false;
        }

        const adminRaw = String(profile.is_admin || "").trim().toLowerCase();
        isAdmin = profile.is_admin === true || adminRaw === "true" || adminRaw === "1" || adminRaw === "sim";
        const accessRaw = String(profile.acesso || "").trim().toLowerCase();
        const hasAcesso = Boolean(accessRaw)
            && (accessRaw.includes("acesso") || accessRaw === "sim" || accessRaw === "true" || accessRaw === "1");
        canPublish = isAdmin || hasAcesso;
        currentUserName = String(profile.nome_guerra || currentUser.email || "Usu\u00e1rio").trim();
        currentUserCargo = String(profile.cargo || "Cargo").trim();
        const formCard = byId("diario-form-card");
        if (formCard) formCard.style.display = canPublish ? "block" : "none";
        return true;
    }

    function buildMetaLine(row) {
        return "Publicado em: " + formatPtDate(row.created_at)
            + " | Edi\u00e7\u00e3o: " + String(row.edicao_num || "-")
            + " | Se\u00e7\u00e3o: " + String(row.secao_num || "-")
            + " | P\u00e1gina: " + String(row.pagina_num || "-");
    }

    function buildDecretoTitle(row) {
        return "DECRETO N\u00daMERO " + String(row.numero_decreto || "-") + ", DE " + formatLongUpper(row.created_at);
    }

    function renderDiarioCard(row) {
        const complemento = escapeHtml(row.texto || "").replace(/\n/g, "<br>");
        const decreto = buildDecretoTitle(row);
        const meta = buildMetaLine(row);
        const assinatura = "S\u00e3o Paulo, " + formatLongPt(row.created_at) + ".";

        return "<article class=\"diario-edicao-card\">"
            + "<img src=\"assets/img/brasao_gov.jpg\" alt=\"Bras\u00e3o do Governo\" class=\"diario-brasao\">"
            + "<h3 class=\"diario-titulo-principal\">DI\u00c1RIO OFICIAL DA UNI\u00c3O</h3>"
            + "<p class=\"diario-meta\">" + escapeHtml(meta) + "</p>"
            + "<p class=\"diario-orgao\"><strong>\u00d3rg\u00e3o:</strong> Atos do Poder Executivo</p>"
            + "<h4 class=\"diario-decreto\">" + escapeHtml(decreto) + "</h4>"
            + "<div class=\"diario-texto\">"
            + "<p>O DIRETOR-GERAL da Pol\u00edcia Rodovi\u00e1ria Federal, no uso das atribui\u00e7\u00f5es que lhe conferem " + complemento + "</p>"
            + "</div>"
            + "<div class=\"diario-assinatura\">"
            + "<p>" + escapeHtml(assinatura) + "</p>"
            + "<p><strong>Diretor-Geral Lucas Santhi</strong></p>"
            + "</div>"
            + (isAdmin
                ? "<div class=\"aviso-card-actions\"><button type=\"button\" class=\"approvals-btn danger diario-delete-btn\" data-id=\"" + escapeHtml(row.id) + "\">Excluir publica\u00e7\u00e3o</button></div>"
                : "")
            + "</article>";
    }

    async function deleteDiario(id) {
        if (!isAdmin) {
            setStatus("Somente administradores podem excluir publicações.", true);
            return;
        }
        if (!id) return;
        if (!window.confirm("Deseja realmente excluir esta publicação do Diário Oficial?")) return;

        setStatus("Excluindo publicação...");
        const result = await client.from("diarios_oficiais").delete().eq("id", id);
        if (result.error) {
            setStatus("Falha ao excluir publicação: " + result.error.message, true);
            return;
        }

        setStatus("Publicação excluída com sucesso.");
        await loadDiarios();
    }

    function renderList(rows) {
        const box = byId("diario-lista");
        if (!box) return;

        currentDiarios = Array.isArray(rows) ? rows.slice() : [];
        if (!Array.isArray(rows) || !rows.length) {
            box.innerHTML = "<div class=\"approvals-empty\">Nenhuma edi\u00e7\u00e3o publicada at\u00e9 o momento.</div>";
            return;
        }

        box.innerHTML = rows.map(renderDiarioCard).join("");

        if (isAdmin) {
            box.querySelectorAll(".diario-delete-btn").forEach(function (btn) {
                btn.addEventListener("click", async function () {
                    const id = btn.getAttribute("data-id");
                    if (!id) return;
                    const found = currentDiarios.find(function (d) { return String(d.id) === String(id); });
                    if (!found) return;
                    await deleteDiario(id);
                });
            });
        }
    }

    async function loadDiarios() {
        const result = await client
            .from("diarios_oficiais")
            .select("*")
            .order("created_at", { ascending: false });

        if (result.error) {
            const box = byId("diario-lista");
            if (box) box.innerHTML = "<div class=\"approvals-empty\">Erro ao carregar Di\u00e1rio Oficial: " + escapeHtml(result.error.message) + "</div>";
            return;
        }
        renderList(result.data || []);
    }

    async function publishDiario(event) {
        event.preventDefault();
        if (!canPublish) {
            setStatus("Somente administradores ou perfis com acesso podem publicar Di\u00e1rio Oficial.", true);
            return;
        }

        const complemento = (byId("diario-complemento").value || "").trim();
        if (!complemento) {
            setStatus("Informe o complemento do decreto.", true);
            return;
        }

        setStatus("Publicando Di\u00e1rio Oficial...");

        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const startIso = dayStart.toISOString();
        const endIso = dayEnd.toISOString();

        const todaysResult = await client
            .from("diarios_oficiais")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startIso)
            .lte("created_at", endIso);

        if (todaysResult.error) {
            setStatus("Falha ao calcular edi\u00e7\u00e3o do dia: " + todaysResult.error.message, true);
            return;
        }

        const totalResult = await client
            .from("diarios_oficiais")
            .select("id", { count: "exact", head: true });

        if (totalResult.error) {
            setStatus("Falha ao calcular n\u00famero do decreto: " + totalResult.error.message, true);
            return;
        }

        const edicao = Number(todaysResult.count || 0) + 1;
        const numeroDecreto = Number(totalResult.count || 0) + 1;
        const secao = Math.floor(Math.random() * 20) + 1;
        const pagina = Math.floor(Math.random() * 100) + 1;

        const payload = {
            texto: complemento,
            edicao_num: edicao,
            secao_num: secao,
            pagina_num: pagina,
            numero_decreto: numeroDecreto,
            created_by: currentUser ? currentUser.id : null
        };

        const insert = await client.from("diarios_oficiais").insert(payload).select("*").single();
        if (insert.error) {
            setStatus("Falha ao publicar Di\u00e1rio Oficial: " + insert.error.message, true);
            return;
        }

        const savedRow = insert.data || payload;
        try {
            const webhookResult = await sendDiarioToDiscord(savedRow);
            const discordMessageId = webhookResult && webhookResult.messageId ? webhookResult.messageId : null;
            if (savedRow.id) {
                await client
                    .from("diarios_oficiais")
                    .update({
                        discord_sent_at: new Date().toISOString(),
                        discord_message_id: discordMessageId
                    })
                    .eq("id", savedRow.id);
            }
        } catch (e) {
            setStatus("Di\u00e1rio Oficial publicado, mas falhou ao enviar ao Discord.", true);
        }

        byId("diario-form").reset();
        setStatus("Di\u00e1rio Oficial publicado com sucesso.");
        await loadDiarios();
    }

    document.addEventListener("DOMContentLoaded", async function () {
        try {
            const ok = await enforceAuth();
            if (!ok) return;
            const form = byId("diario-form");
            if (form) form.addEventListener("submit", publishDiario);
            await loadDiarios();
        } catch (e) {
            window.location.replace("../login.html");
        }
    });
})();




