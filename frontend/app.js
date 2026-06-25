'use strict';

// ─── Estado global ────────────────────────────────────────────────────────────
const appState = {
  screen: 'size',
  sizes: [],
  toppings: [],
  selectedSize: null,         // { id, name, diameter_cm, base_price }
  selectedToppings: [],       // [{ id, name, price, category }, ...]
  customerName: '',
  currentOrder: null,         // OrderResponse del servidor
  ws: null,
  wsRetries: 0,
  wsMaxRetries: 3,
};

// ─── Inicialización ───────────────────────────────────────────────────────────
async function initApp() {
  try {
    const [sizesRes, toppingsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/menu/sizes`),
      fetch(`${API_BASE_URL}/api/menu/toppings`),
    ]);
    appState.sizes    = await sizesRes.json();
    appState.toppings = await toppingsRes.json();
  } catch (err) {
    console.error('Error cargando menú:', err);
    appState.sizes    = [];
    appState.toppings = [];
  }

  renderSizes();
  renderToppings();
  showScreen('size');
}

// ─── Navegación ───────────────────────────────────────────────────────────────
function showScreen(name) {
  appState.screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${name}`);
  if (target) {
    target.classList.add('active');
    // Re-trigger animation
    target.style.animation = 'none';
    target.offsetHeight; // reflow
    target.style.animation = '';
  }
}

// ─── Pantalla 1: Tamaños ──────────────────────────────────────────────────────
function renderSizes() {
  const grid = document.getElementById('sizes-grid');
  if (!grid) return;

  const icons = { chica: '🍕', mediana: '🍕🍕', grande: '🍕🍕🍕' };

  grid.innerHTML = appState.sizes.map(s => `
    <div class="size-card" onclick="selectSize(${s.id})" data-size-id="${s.id}">
      <div class="pizza-icon">${icons[s.name] || '🍕'}</div>
      <div class="size-name">${s.name}</div>
      <div class="size-diam">${s.diameter_cm} cm</div>
      <div class="size-price">$${s.base_price.toFixed(2)}</div>
    </div>
  `).join('');
}

function selectSize(sizeId) {
  appState.selectedSize = appState.sizes.find(s => s.id === sizeId) || null;
  appState.selectedToppings = [];

  document.querySelectorAll('.size-card').forEach(c => {
    c.classList.toggle('selected', Number(c.dataset.sizeId) === sizeId);
  });

  updatePriceDisplay();
  showScreen('toppings');
}

// ─── Pantalla 2: Toppings ─────────────────────────────────────────────────────
function renderToppings() {
  const container = document.getElementById('toppings-by-category');
  if (!container) return;

  const byCategory = {};
  appState.toppings.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  });

  container.innerHTML = Object.entries(byCategory).map(([cat, items]) => `
    <div class="category-group">
      <div class="category-title">${cat}</div>
      <div class="toppings-row">
        ${items.map(t => `
          <div class="topping-card" onclick="toggleTopping(${t.id})" data-topping-id="${t.id}">
            ${t.name}<span class="t-price">+$${t.price.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function toggleTopping(toppingId) {
  const topping = appState.toppings.find(t => t.id === toppingId);
  if (!topping) return;

  const idx = appState.selectedToppings.findIndex(t => t.id === toppingId);
  if (idx === -1) {
    if (appState.selectedToppings.length >= 8) return; // límite del spec
    appState.selectedToppings.push(topping);
  } else {
    appState.selectedToppings.splice(idx, 1);
  }

  document.querySelectorAll('.topping-card').forEach(c => {
    c.classList.toggle('selected', appState.selectedToppings.some(t => t.id === Number(c.dataset.toppingId)));
  });

  updatePriceDisplay();
}

function updatePriceDisplay() {
  const base   = appState.selectedSize ? appState.selectedSize.base_price : 0;
  const extras = appState.selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const total  = base + extras;
  const el = document.getElementById('price-display');
  if (el) el.textContent = `$${total.toFixed(2)}`;
}

function goToName() {
  if (!appState.selectedSize) return;
  renderOrderRecap();
  showScreen('name');
}

// ─── Pantalla 3: Nombre ───────────────────────────────────────────────────────
function renderOrderRecap() {
  const el = document.getElementById('order-recap');
  if (!el || !appState.selectedSize) return;

  const base   = appState.selectedSize.base_price;
  const extras = appState.selectedToppings.reduce((s, t) => s + t.price, 0);
  const total  = base + extras;
  const toppingNames = appState.selectedToppings.map(t => t.name).join(', ') || 'Sin extras';

  el.innerHTML = `
    <strong>Pizza ${appState.selectedSize.name}</strong> (${appState.selectedSize.diameter_cm} cm)<br>
    ${toppingNames}<br>
    <strong style="color:var(--accent)">Total: $${total.toFixed(2)}</strong>
  `;
}

async function submitOrder() {
  const nameEl = document.getElementById('customer-name');
  const errEl  = document.getElementById('order-error');
  const btnEl  = document.getElementById('btn-order');
  const name   = (nameEl ? nameEl.value : '').trim();

  errEl.classList.add('hidden');
  errEl.textContent = '';

  if (!name) {
    errEl.textContent = 'Por favor ingresa tu nombre.';
    errEl.classList.remove('hidden');
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = 'Enviando…';

  try {
    const res = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        size_id:       appState.selectedSize.id,
        topping_ids:   appState.selectedToppings.map(t => t.id),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Error ${res.status}`);
    }

    appState.currentOrder = await res.json();
    appState.customerName = name;
    appState.wsRetries = 0;

    showTrackerScreen();
    connectWebSocket(appState.currentOrder.id);
  } catch (err) {
    errEl.textContent = `Error al crear el pedido: ${err.message}`;
    errEl.classList.remove('hidden');
    btnEl.disabled = false;
    btnEl.textContent = 'Ordenar 🍕';
  }
}

// ─── Pantalla 4: Tracker ──────────────────────────────────────────────────────
function showTrackerScreen() {
  const order = appState.currentOrder;
  if (!order) return;

  document.getElementById('tracker-customer').textContent = `Para: ${order.customer_name}`;

  const toppingNames = (order.topping_snapshots || []).map(t => t.name).join(', ') || 'Sin extras';
  document.getElementById('tracker-summary').textContent =
    `Pizza ${order.size_snapshot.name} · ${toppingNames} · $${parseFloat(order.total).toFixed(2)}`;

  updateStepper(order.status);
  showScreen('tracker');
}

const STATUS_MSGS = {
  recibido:   '¡Pedido recibido! Preparando tu orden…',
  preparando: '¡Manos en la masa! Estamos armando tu pizza 👨‍🍳',
  horno:      '¡Al horno! Cocinando a 300°C 🔥',
  listo:      '¡Lista! Empaquetando tu pizza ✅',
  en_ruta:    '¡En camino! Tu pizza está en ruta 🛵',
  entregado:  '¡Entregado! Buen provecho 🎉',
};

const STATUS_ORDER = ['recibido', 'preparando', 'horno', 'listo', 'en_ruta', 'entregado'];

function updateStepper(status) {
  const activeIdx = STATUS_ORDER.indexOf(status);
  const totalGaps = STATUS_ORDER.length - 1;
  const fillPct   = activeIdx > 0 ? (activeIdx / totalGaps) * 100 : 0;

  const fill = document.getElementById('tracker-fill');
  if (fill) fill.style.width = `${fillPct}%`;

  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < activeIdx) el.classList.add('done');
    if (i === activeIdx) el.classList.add('active');
  });

  const msgEl = document.getElementById('tracker-status-msg');
  if (msgEl) msgEl.textContent = STATUS_MSGS[status] || '';

  updateStateVisual(status);
}

function updateStateVisual(status) {
  const el = document.getElementById('state-visual');
  if (!el) return;

  if (status === 'horno') {
    el.innerHTML = `
      <div class="scene-oven">
        <div class="oven-flames"><span>🔥</span><span>🔥</span><span>🔥</span></div>
        <div class="oven-body">
          <div class="oven-glass"><span class="pizza-spin">🍕</span></div>
          <div class="oven-knobs"><span></span><span></span></div>
        </div>
        <p class="scene-label">Cocinando a 300°C 🌡️</p>
      </div>`;
  } else if (status === 'en_ruta') {
    el.innerHTML = `
      <div class="scene-map">
        <div class="map-viewport">
          <svg class="map-bg" viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <rect width="300" height="120" fill="#182218"/>
            <rect x="0" y="48" width="300" height="24" fill="#243224"/>
            <rect x="98" y="0" width="18" height="48" fill="#243224"/>
            <rect x="98" y="72" width="18" height="48" fill="#243224"/>
            <rect x="196" y="0" width="18" height="48" fill="#243224"/>
            <rect x="196" y="72" width="18" height="48" fill="#243224"/>
            <rect x="8"   y="6"  width="78" height="30" fill="#1e2e1e" rx="4"/>
            <rect x="128" y="6"  width="56" height="30" fill="#1e2e1e" rx="4"/>
            <rect x="226" y="6"  width="66" height="30" fill="#1e2e1e" rx="4"/>
            <rect x="8"   y="84" width="78" height="28" fill="#1e2e1e" rx="4"/>
            <rect x="128" y="84" width="56" height="28" fill="#1e2e1e" rx="4"/>
            <rect x="226" y="84" width="66" height="28" fill="#1e2e1e" rx="4"/>
            <line x1="0"  y1="60" x2="300" y2="60" stroke="#ffffff08" stroke-width="1.5" stroke-dasharray="10 6"/>
            <line x1="28" y1="60" x2="272" y2="60" stroke="#e63946"   stroke-width="2"   stroke-opacity="0.45"/>
          </svg>
          <span class="map-origin-pin">🍕</span>
          <span class="map-dest-pin">🏠</span>
          <span class="map-moto">🛵</span>
        </div>
        <p class="scene-label">Tu pizza está en camino</p>
      </div>`;
  } else {
    el.innerHTML = '';
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWebSocket(orderId) {
  if (typeof WS_URL === 'undefined') return;

  const wsStatusEl = document.getElementById('ws-status');
  const url = `${WS_URL}?orderId=${orderId}`;

  try {
    appState.ws = new WebSocket(url);
  } catch (err) {
    setWsStatus('Conexión en tiempo real no disponible — refrescando estado…');
    return;
  }

  appState.ws.onopen = () => {
    appState.wsRetries = 0;
    setWsStatus('');
  };

  appState.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'status_update') {
        updateStepper(msg.status);
      }
    } catch (_) { /* ignorar mensajes malformados */ }
  };

  appState.ws.onclose = () => {
    reconnectWithBackoff(orderId);
  };

  appState.ws.onerror = () => {
    setWsStatus('Reconectando…');
  };
}

function reconnectWithBackoff(orderId) {
  if (appState.wsRetries >= appState.wsMaxRetries) {
    setWsStatus('Sin conexión en tiempo real. Usa "Consultar estado" si el tracker no avanza.');
    return;
  }

  const delay = Math.pow(2, appState.wsRetries) * 1000; // 1s, 2s, 4s
  appState.wsRetries++;
  setWsStatus(`Reconectando en ${delay / 1000}s…`);
  setTimeout(() => connectWebSocket(orderId), delay);
}

function setWsStatus(msg) {
  const el = document.getElementById('ws-status');
  if (el) el.textContent = msg;
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function startOver() {
  if (appState.ws) {
    appState.ws.onclose = null; // evitar reconexión al cerrar a propósito
    appState.ws.close();
    appState.ws = null;
  }

  appState.selectedSize     = null;
  appState.selectedToppings = [];
  appState.customerName     = '';
  appState.currentOrder     = null;
  appState.wsRetries        = 0;

  const nameEl = document.getElementById('customer-name');
  if (nameEl) nameEl.value = '';
  const btnEl = document.getElementById('btn-order');
  if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Ordenar 🍕'; }

  // Limpiar selección visual de tamaños y toppings
  document.querySelectorAll('.size-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.topping-card').forEach(c => c.classList.remove('selected'));
  updatePriceDisplay();
  showScreen('size');
}

// ─── Arranque ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initApp);
