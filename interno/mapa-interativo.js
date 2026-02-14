"use strict";

(function () {
    const mapEl = document.getElementById('mapa-interativo');
    if (!mapEl) return;

    let isAdmin = Boolean(window.__painelIsAdmin || window.__ripatIsAdmin);

    const el = {
        status: document.getElementById('mapa-status'),
        form: document.getElementById('mapa-form'),
        submit: document.getElementById('mapa-submit'),
        cancel: document.getElementById('mapa-cancel'),
        warning: document.getElementById('mapa-admin-warning'),
        cor: document.getElementById('mapa-cor'),
        categoria: document.getElementById('mapa-categoria'),
        quantidade: document.getElementById('mapa-quantidade'),
        addCategoria: document.getElementById('mapa-add-categoria'),
        categoriasLista: document.getElementById('mapa-categorias-lista'),
        titulo: document.getElementById('mapa-titulo'),
        descricao: document.getElementById('mapa-descricao'),
        x: document.getElementById('mapa-x'),
        y: document.getElementById('mapa-y'),
        filters: Array.from(document.querySelectorAll('.mapa-filter')),
        search: document.getElementById('mapa-search'),
        setores: Array.from(document.querySelectorAll('.mapa-setor')),
        setoresClear: document.getElementById('mapa-setores-clear')
    };

    const STORAGE_KEY = 'prf_mapa_interativo_points';
    const MAP_IMAGES = {
        base: 'assets/img/map.png',
        full: 'assets/img/mapfull.png',
        red: 'assets/img/mapred.png',
        yellow: 'assets/img/mapyellow.png',
        green: 'assets/img/mapgreen.png',
        yellowGreen: 'assets/img/mapyellowgreen.png',
        yellowRed: 'assets/img/mapyellowred.png',
        greenRed: 'assets/img/mapgreenred.png'
    };

    const CATEGORIES = {
        'Denúncia realizadas': { color: '#dc2626' },
        'Roubo de veículo': { color: '#f97316' },
        'Tráfico': { color: '#7c3aed' },
        'Disparos': { color: '#0ea5e9' },
        'Outros': { color: '#16a34a' }
    };

    let map = null;
    let mapBounds = null;
    let mapImageOverlay = null;
    let markersLayer = null;
    let points = [];
    let editingId = null;

    function setStatus(message, isError) {
        if (!el.status) return;
        el.status.textContent = message || '';
        el.status.style.color = isError ? '#b42318' : '#166534';
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

    function normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function formatDate(value) {
        if (!value) return '-';
        try {
            return new Date(value).toLocaleString('pt-BR');
        } catch (e) {
            return '-';
        }
    }

    function loadPoints() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function savePoints(list) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
        } catch (e) {
            setStatus('Falha ao salvar pontos.', true);
        }
    }

    function getSelectedCategories() {
        const selected = el.filters
            .filter((item) => item.checked)
            .map((item) => item.value);
        return new Set(selected);
    }

    function getSelectedSetores() {
        return el.setores
            .filter((item) => item.checked)
            .map((item) => item.value)
            .sort();
    }

    function resolveSetorImage(selected, isClearAction) {
        if (!selected.length) return MAP_IMAGES.base;
        const key = selected.join(',');
        if (key === '0') return MAP_IMAGES.red;
        if (key === '1') return MAP_IMAGES.yellow;
        if (key === '2') return MAP_IMAGES.green;
        if (key === '1,2') return MAP_IMAGES.yellowGreen;
        if (key === '0,1') return MAP_IMAGES.yellowRed;
        if (key === '0,2') return MAP_IMAGES.greenRed;
        return MAP_IMAGES.full;
    }

    function updateSetorImage(isClearAction) {
        if (!mapImageOverlay) return;
        const selected = getSelectedSetores();
        const url = resolveSetorImage(selected, isClearAction);
        mapImageOverlay.setUrl(url);
    }

    function applyFilters() {
        const selected = getSelectedCategories();
        const query = normalize(el.search ? el.search.value : '');
        return points.filter((point) => {
            const categorias = Array.isArray(point.categorias) ? point.categorias : [];
            const hasCategory = !selected.size
                ? true
                : categorias.some((cat) => selected.has(cat.categoria));
            if (!hasCategory) return false;
            if (!query) return true;
            const text = normalize(point.titulo + ' ' + (point.descricao || ''));
            return text.includes(query);
        });
    }

    function renderCategoriasLista(categorias) {
        if (!el.categoriasLista) return;
        if (!categorias.length) {
            el.categoriasLista.innerHTML = '<p class="mapa-categoria-empty">Nenhuma categoria adicionada.</p>';
            return;
        }
        el.categoriasLista.innerHTML = categorias.map((item, index) => {
            return `
                <div class="mapa-categoria-item">
                    <span>${escapeHtml(item.categoria)} (${item.quantidade})</span>
                    <button type="button" class="mapa-categoria-remove" data-index="${index}">Remover</button>
                </div>
            `;
        }).join('');
    }

    function parseCategoriasFromList() {
        if (!el.categoriasLista) return [];
        const items = Array.from(el.categoriasLista.querySelectorAll('.mapa-categoria-item span')).map((node) => node.textContent);
        return items.map((text) => {
            const match = text.match(/^(.*)\\s\\((\\d+)\\)$/);
            if (!match) return null;
            return { categoria: match[1], quantidade: Number(match[2]) };
        }).filter(Boolean);
    }

    function buildPopupHtml(point) {
        const safeTitle = escapeHtml(point.titulo || 'Registro');
        const safeDesc = escapeHtml(point.descricao || '');
        const categorias = Array.isArray(point.categorias) ? point.categorias : [];
        const categoriasHtml = categorias.length
            ? categorias.map((cat) => `<li>${escapeHtml(cat.categoria)}: ${escapeHtml(cat.quantidade)}</li>`).join('')
            : '<li>Nenhuma categoria registrada</li>';
        const created = formatDate(point.createdAt);
        const coords = `X ${point.x} | Y ${point.y}`;

        const actions = isAdmin
            ? `
                <div class="mapa-popup-actions">
                    <button type="button" class="approvals-btn" data-action="edit" data-id="${escapeHtml(point.id)}">Editar</button>
                    <button type="button" class="approvals-btn danger" data-action="delete" data-id="${escapeHtml(point.id)}">Excluir</button>
                </div>
            `
            : '';

        return `
            <section class="painel-docs-inline mapa-popup is-open">
                <article class="info-card painel-docs-frame-wrap">
                    <h3>${safeTitle}</h3>
                    <details class="mapa-popup-details" open>
                        <summary>Detalhes do registro</summary>
                        <div class="mapa-popup-body">
                            <p><strong>Categorias:</strong></p>
                            <ul class="mapa-popup-list">${categoriasHtml}</ul>
                            <p><strong>Descrição:</strong> ${safeDesc || 'N/A'}</p>
                            <p><strong>Data/Hora:</strong> ${escapeHtml(created)}</p>
                            <p><strong>Coordenadas:</strong> ${escapeHtml(coords)}</p>
                        </div>
                    </details>
                    ${actions}
                </article>
            </section>
        `;
    }

    function renderMarkers() {
        if (!markersLayer) return;
        markersLayer.clearLayers();
        const filtered = applyFilters();

        if (!filtered.length) {
            setStatus('Nenhum ponto encontrado com os filtros atuais.', false);
            return;
        }

        filtered.forEach((point) => {
            const color = point.cor || '#2563eb';
            const marker = L.circleMarker([point.y, point.x], {
                radius: 8,
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 2
            });
            marker.bindPopup(buildPopupHtml(point), { maxWidth: 360, className: 'mapa-leaflet-popup' });
            marker.addTo(markersLayer);
        });

        setStatus(`${filtered.length} ponto(s) exibido(s).`, false);
    }

    function resetForm() {
        if (!el.form) return;
        el.form.reset();
        editingId = null;
        if (el.cor) el.cor.value = '#0ea5e9';
        if (el.categoriasLista) el.categoriasLista.innerHTML = '';
        if (el.submit) el.submit.textContent = 'Publicar ponto';
        if (el.cancel) el.cancel.classList.add('is-hidden');
    }

    function fillForm(point) {
        if (!point || !el.form) return;
        if (el.cor) el.cor.value = point.cor || '#0ea5e9';
        el.titulo.value = point.titulo || '';
        el.descricao.value = point.descricao || '';
        el.x.value = point.x;
        el.y.value = point.y;
        if (el.categoriasLista) renderCategoriasLista(point.categorias || []);
        if (el.submit) el.submit.textContent = 'Atualizar ponto';
        if (el.cancel) el.cancel.classList.remove('is-hidden');
    }

    function upsertPoint(data) {
        if (!data) return;
        if (editingId) {
            points = points.map((point) => (point.id === editingId ? { ...point, ...data } : point));
        } else {
            points.unshift({
                id: String(Date.now()),
                createdAt: new Date().toISOString(),
                ...data
            });
        }
        savePoints(points);
        renderMarkers();
    }

    function deletePoint(id) {
        points = points.filter((point) => point.id !== id);
        savePoints(points);
        renderMarkers();
    }

    function handlePopupActions(event) {
        const target = event.target.closest('button[data-action]');
        if (!target) return;
        const action = target.getAttribute('data-action');
        const id = target.getAttribute('data-id');
        if (!action || !id) return;
        const found = points.find((point) => point.id === id);
        if (!found) return;

        if (action === 'edit') {
            editingId = id;
            fillForm(found);
            if (map) map.closePopup();
            return;
        }

        if (action === 'delete') {
            const ok = window.confirm('Deseja realmente excluir este ponto?');
            if (!ok) return;
            deletePoint(id);
            if (map) map.closePopup();
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (!isAdmin) return;

        const cor = el.cor ? el.cor.value.trim() : '#2563eb';
        const titulo = el.titulo.value.trim();
        const descricao = el.descricao.value.trim();
        const x = Number(el.x.value);
        const y = Number(el.y.value);
        const categorias = parseCategoriasFromList();

        if (!titulo || !Number.isFinite(x) || !Number.isFinite(y) || !categorias.length) {
            setStatus('Informe título, coordenadas válidas e ao menos uma categoria.', true);
            return;
        }

        upsertPoint({ cor, titulo, descricao, x, y, categorias });
        resetForm();
    }

    function handleMapClick(event) {
        if (!isAdmin) return;
        if (!el.x || !el.y) return;
        const x = Math.round(event.latlng.lng * 100) / 100;
        const y = Math.round(event.latlng.lat * 100) / 100;
        el.x.value = x;
        el.y.value = y;
    }

    function initMap(imageUrl) {
        const img = new Image();
        img.onload = function () {
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            if (!width || !height) {
                setStatus('Falha ao ler dimensões do mapa.', true);
                return;
            }

            const bounds = [[0, 0], [height, width]];
            mapBounds = bounds;

            map = L.map(mapEl, {
                crs: L.CRS.Simple,
                zoomSnap: 0.25,
                zoomDelta: 0.5,
                wheelPxPerZoomLevel: 100
            });

            mapImageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);
            markersLayer = L.layerGroup().addTo(map);

            const fitZoom = map.getBoundsZoom(bounds, false);
            map.setMinZoom(fitZoom - 3);
            map.fitBounds(bounds);
            map.setZoom(fitZoom + 1);
            map.setMaxBounds(L.latLngBounds(bounds).pad(0.15));

            map.on('click', handleMapClick);
            map.on('popupopen', (e) => {
                const node = e.popup && e.popup.getElement ? e.popup.getElement() : null;
                if (!node) return;
                node.addEventListener('click', handlePopupActions);
            });

            setStatus('Mapa pronto.', false);
            renderMarkers();
        };

        img.onerror = function () {
            setStatus('Falha ao carregar imagem do mapa. Verifique assets/img/mapfull.png.', true);
        };

        img.src = imageUrl;
    }

    function bindUi() {
        if (el.form) el.form.addEventListener('submit', handleSubmit);
        if (el.addCategoria) {
            el.addCategoria.addEventListener('click', function () {
                const categoria = el.categoria ? el.categoria.value.trim() : '';
                const quantidade = el.quantidade ? Number(el.quantidade.value) : 0;
                if (!categoria || !Number.isFinite(quantidade) || quantidade <= 0) {
                    setStatus('Selecione categoria e informe quantidade válida.', true);
                    return;
                }
                const categorias = parseCategoriasFromList();
                const existing = categorias.find((item) => item.categoria === categoria);
                if (existing) existing.quantidade += quantidade;
                else categorias.push({ categoria, quantidade });
                renderCategoriasLista(categorias);
                if (el.quantidade) el.quantidade.value = 1;
                if (el.categoria) el.categoria.value = '';
                setStatus('', false);
            });
        }
        if (el.categoriasLista) {
            el.categoriasLista.addEventListener('click', function (event) {
                const btn = event.target.closest('.mapa-categoria-remove');
                if (!btn) return;
                const idx = Number(btn.getAttribute('data-index'));
                const categorias = parseCategoriasFromList();
                categorias.splice(idx, 1);
                renderCategoriasLista(categorias);
            });
        }
        if (el.cancel) {
            el.cancel.addEventListener('click', function () {
                resetForm();
            });
        }
        el.filters.forEach((filter) => filter.addEventListener('change', renderMarkers));
        if (el.setores.length) {
            el.setores.forEach((setor) => setor.addEventListener('change', function () {
                updateSetorImage(false);
            }));
        }
        if (el.setoresClear) {
            el.setoresClear.addEventListener('click', function () {
                el.setores.forEach((setor) => {
                    setor.checked = false;
                });
                updateSetorImage(true);
            });
        }
        if (el.search) el.search.addEventListener('input', renderMarkers);
    }

    function enforceAdminUi() {
        if (isAdmin) {
            if (el.form) {
                el.form.classList.remove('is-disabled');
                el.form.classList.remove('is-hidden');
            }
            if (el.submit) el.submit.removeAttribute('disabled');
            if (el.cor) el.cor.removeAttribute('disabled');
            if (el.categoria) el.categoria.removeAttribute('disabled');
            if (el.quantidade) el.quantidade.removeAttribute('disabled');
            if (el.addCategoria) el.addCategoria.removeAttribute('disabled');
            if (el.titulo) el.titulo.removeAttribute('disabled');
            if (el.descricao) el.descricao.removeAttribute('disabled');
            if (el.x) el.x.removeAttribute('disabled');
            if (el.y) el.y.removeAttribute('disabled');
            if (el.warning) el.warning.classList.add('is-hidden');
            return;
        }

        if (el.form) {
            el.form.classList.add('is-disabled');
            el.form.classList.add('is-hidden');
        }
        if (el.submit) el.submit.setAttribute('disabled', 'disabled');
        if (el.cor) el.cor.setAttribute('disabled', 'disabled');
        if (el.categoria) el.categoria.setAttribute('disabled', 'disabled');
        if (el.quantidade) el.quantidade.setAttribute('disabled', 'disabled');
        if (el.addCategoria) el.addCategoria.setAttribute('disabled', 'disabled');
        if (el.titulo) el.titulo.setAttribute('disabled', 'disabled');
        if (el.descricao) el.descricao.setAttribute('disabled', 'disabled');
        if (el.x) el.x.setAttribute('disabled', 'disabled');
        if (el.y) el.y.setAttribute('disabled', 'disabled');
        if (el.warning) el.warning.classList.remove('is-hidden');
    }

    function watchAdminState() {
        let attempts = 0;
        const timer = window.setInterval(function () {
            attempts += 1;
            if (window.__painelIsAdmin === true || window.__ripatIsAdmin === true) {
                isAdmin = true;
                enforceAdminUi();
                window.clearInterval(timer);
                return;
            }
            if (attempts >= 20) window.clearInterval(timer);
        }, 300);
    }

    if (!window.L) {
        setStatus('Leaflet não disponível. Verifique o carregamento da biblioteca.', true);
        return;
    }

    points = loadPoints();
    bindUi();
    enforceAdminUi();
    watchAdminState();
    (function tryLoadMap() {
        const img = new Image();
        img.onload = function () {
            initMap(MAP_IMAGES.base);
        };
        img.onerror = function () {
            setStatus('Falha ao carregar imagem do mapa. Verifique assets/img/map.png.', true);
        };
        img.src = MAP_IMAGES.base;
    })();

    window.__mapaInterativoRefresh = function () {
        if (!map) return;
        map.invalidateSize();
        if (mapBounds) map.fitBounds(mapBounds);
    };
})();
