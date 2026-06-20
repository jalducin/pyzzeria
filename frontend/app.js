// Estado en memoria
const estado = {
  productos: [],        // lista completa del servidor
  categoriaActiva: null,
  carrito: [],          // [{ product_id, name, price, quantity }]
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  cargarCatalogo();
});

async function cargarCatalogo() {
  try {
    const [productos, categorias] = await Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]);
    estado.productos = productos;
    renderCategorias(categorias);
    renderProductos();
  } catch (e) {
    document.getElementById("products-grid").innerHTML =
      '<p class="loading">Error al cargar el catálogo. ¿Está corriendo el backend?</p>';
  }
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

function renderCategorias(categorias) {
  const nav = document.getElementById("category-nav");
  const todas = ["Todas", ...categorias];
  nav.innerHTML = todas
    .map(cat => `<button class="category-btn${cat === "Todas" ? " active" : ""}"
                   onclick="filtrarCategoria('${cat}')">${cat}</button>`)
    .join("");
}

function filtrarCategoria(cat) {
  estado.categoriaActiva = cat === "Todas" ? null : cat;
  document.querySelectorAll(".category-btn").forEach(b => {
    b.classList.toggle("active", b.textContent === cat);
  });
  renderProductos();
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

function renderProductos() {
  const grid = document.getElementById("products-grid");
  const lista = estado.categoriaActiva
    ? estado.productos.filter(p => p.category === estado.categoriaActiva)
    : estado.productos;

  if (!lista.length) {
    grid.innerHTML = '<p class="loading">Sin productos en esta categoría.</p>';
    return;
  }

  grid.innerHTML = lista.map(p => {
    const enCarrito = stockEnCarrito(p.id);
    const stockDisponible = p.stock - enCarrito;
    const sinStock = stockDisponible <= 0;
    return `
      <div class="product-card${sinStock ? " out-of-stock" : ""}"
           onclick="${sinStock ? "" : `agregarAlCarrito(${p.id})`}"
           title="${sinStock ? "Sin stock disponible" : "Agregar al ticket"}">
        <span class="product-name">${p.name}</span>
        <span class="product-category">${p.category}</span>
        <span class="product-price">$${p.price.toFixed(2)}</span>
        <span class="product-stock${stockDisponible <= 3 ? " low" : ""}">
          Stock: ${stockDisponible}${sinStock ? " — agotado" : ""}
        </span>
      </div>`;
  }).join("");
}

function stockEnCarrito(productId) {
  const item = estado.carrito.find(i => i.product_id === productId);
  return item ? item.quantity : 0;
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

function agregarAlCarrito(productId) {
  const producto = estado.productos.find(p => p.id === productId);
  if (!producto) return;

  const enCarrito = stockEnCarrito(productId);
  if (producto.stock - enCarrito <= 0) {
    mostrarToast("Sin stock disponible", "error");
    return;
  }

  const item = estado.carrito.find(i => i.product_id === productId);
  if (item) {
    item.quantity += 1;
  } else {
    estado.carrito.push({
      product_id: productId,
      name: producto.name,
      price: producto.price,
      quantity: 1,
    });
  }

  renderProductos();
  renderTicket();
}

function quitarDelCarrito(productId) {
  const idx = estado.carrito.findIndex(i => i.product_id === productId);
  if (idx === -1) return;
  if (estado.carrito[idx].quantity > 1) {
    estado.carrito[idx].quantity -= 1;
  } else {
    estado.carrito.splice(idx, 1);
  }
  renderProductos();
  renderTicket();
}

// ---------------------------------------------------------------------------
// Ticket
// ---------------------------------------------------------------------------

function renderTicket() {
  const lista = document.getElementById("ticket-items");
  const totalEl = document.getElementById("ticket-total-amount");
  const btnPay = document.getElementById("btn-pay");
  const status = document.getElementById("ticket-status");

  if (!estado.carrito.length) {
    lista.innerHTML = '<li style="color:#888;font-size:0.8rem;padding:8px 0">Toca un producto para agregarlo</li>';
    totalEl.textContent = "$0.00";
    btnPay.disabled = true;
    status.textContent = "";
    return;
  }

  lista.innerHTML = estado.carrito.map(item => {
    const sub = (item.price * item.quantity).toFixed(2);
    return `
      <li class="ticket-item">
        <span class="ticket-item-name">${item.name}</span>
        <span class="ticket-item-qty">${item.quantity} × $${item.price.toFixed(2)}</span>
        <span class="ticket-item-sub">$${sub}</span>
        <button class="ticket-item-remove" onclick="quitarDelCarrito(${item.product_id})" title="Quitar">✕</button>
      </li>`;
  }).join("");

  const total = estado.carrito.reduce((acc, i) => acc + i.price * i.quantity, 0);
  totalEl.textContent = `$${total.toFixed(2)}`;
  btnPay.disabled = false;
  status.textContent = "";
  status.className = "ticket-status";
}

// ---------------------------------------------------------------------------
// Confirmar cobro
// ---------------------------------------------------------------------------

async function confirmarCobro() {
  const btnPay = document.getElementById("btn-pay");
  const status = document.getElementById("ticket-status");

  if (!estado.carrito.length) return;

  btnPay.disabled = true;
  btnPay.textContent = "Procesando…";

  const payload = {
    items: estado.carrito.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
    })),
  };

  try {
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 201) {
      const venta = await res.json();
      estado.carrito = [];
      await cargarCatalogo();   // actualiza stock real desde servidor
      renderTicket();
      status.textContent = `✓ Venta #${venta.id} — Total $${venta.total.toFixed(2)}`;
      status.className = "ticket-status";
      mostrarToast(`Venta #${venta.id} registrada — $${venta.total.toFixed(2)}`, "success");
    } else {
      const err = await res.json();
      const msg = err.detail || "Error al procesar la venta";
      status.textContent = msg;
      status.className = "ticket-status error";
      mostrarToast(msg, "error");
      btnPay.disabled = false;
    }
  } catch (e) {
    status.textContent = "Error de conexión con el servidor";
    status.className = "ticket-status error";
    mostrarToast("Error de conexión", "error");
    btnPay.disabled = false;
  } finally {
    btnPay.textContent = "Cobrar";
  }
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

let toastTimer = null;

function mostrarToast(msg, tipo = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${tipo}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = "toast hidden"; }, 3500);
}
