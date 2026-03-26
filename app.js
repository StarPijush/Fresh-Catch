// ─────────────────────────────────────────────────────────
// app.js  ·  OceanFresh Premium — application logic
// Depends on: data.js
// ─────────────────────────────────────────────────────────

/* ── State ── */
let cart             = {};
let selectedLocation = null;
let currentFilter    = 'all';
let currentSearch    = '';
let products         = [];

/* ── Init ── */
window.addEventListener('load', async () => {
  // Safety timeout: Hide loader after max 8 seconds no matter what
  const safetyTimeout = setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader && !loader.classList.contains('hide')) {
      console.warn('Loading taking too long. Hiding loader anyway...');
      loader.classList.add('hide');
    }
  }, 8000);

  try {
    if (typeof Store !== 'undefined') {
      products = await Store.getProducts();
      // Keep products in sync from realtime database
      Store.subscribeProducts((newProducts) => {
        products = newProducts;
        renderFeaturedCards();
        renderFreshCatch();
        renderProductList();
        renderCart();
      });
    } else {
      console.error('Store is not defined!');
    }
    
    // Success: Hide loader normally
    clearTimeout(safetyTimeout);
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) loader.classList.add('hide');
      renderFeaturedCards();
      renderFreshCatch();
      renderProductList();
      renderCart();
      initReveal();
    }, 1500); 
  } catch (err) {
    console.error('Initialization error:', err.message);
    document.getElementById('loader').classList.add('hide');
  }
});

/* ── Scroll reveal ── */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  const io  = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('in'), i * 80);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

/* ── Navigation drawer ── */
const menuBtn    = document.getElementById('menu-btn');
const navDrawer  = document.getElementById('nav-drawer');
menuBtn.addEventListener('click', () => {
  const open = navDrawer.classList.toggle('open');
  menuBtn.classList.toggle('open', open);
});

/* ── Navigation top-nav light mode on scroll ── */
window.addEventListener('scroll', () => {
  const nav = document.getElementById('top-nav');
  const page = document.querySelector('.page.active');
  if (page && page.id === 'page-home') {
    nav.classList.toggle('light', window.scrollY > window.innerHeight * 0.7);
  }
}, { passive: true });

/* ── Show page ── */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  window.scrollTo(0, 0);

  // Close drawer if open
  navDrawer.classList.remove('open');
  menuBtn.classList.remove('open');

  // Nav color
  const nav = document.getElementById('top-nav');
  nav.classList.toggle('light', name !== 'home');

  if (name === 'order') renderCart();
  if (name === 'products') setTimeout(initReveal, 50);
}

/* ─────────────────────────────────────────────────────────
   RENDER — Featured horizontal cards
   ───────────────────────────────────────────────────────── */
function renderFeaturedCards() {
  const container = document.getElementById('featured-cards');
  const featured  = products.filter(p => p.available).slice(0, 6);

  container.innerHTML = featured.map(p => {
    const hasPhoto = p.image && !p.image.startsWith('data:image/svg');
    const imgArea = hasPhoto
      ? `<img src="${p.image}" alt="${p.name}" class="feat-card-img feat-card-img-photo">`
      : `<div class="feat-card-img">${p.emoji || '🐟'}</div>`;
    return `
    <div class="feat-card">
      ${imgArea}
      <div class="feat-card-body">
        <div class="feat-card-name">${p.name}</div>
        <div class="feat-card-sub">${p.sub}</div>
        <div class="feat-card-price">₹${p.price} <span style="font-size:0.65rem;color:var(--muted);font-weight:400;">/ kg</span></div>
        <div class="feat-card-footer">
          <div class="qty-row">
            <button class="qty-btn" onclick="changeQty('${p.id}',-1,'feat')">−</button>
            <span class="qty-val" id="feat-qty-${p.id}">${cart[p.id]||0}</span>
            <button class="qty-btn" onclick="changeQty('${p.id}',1,'feat')">+</button>
          </div>
          <button class="btn btn-aqua btn-sm" onclick="addToCart('${p.id}')">Add</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────
   RENDER — Fresh Catch table
   ───────────────────────────────────────────────────────── */
function renderFreshCatch() {
  const el = document.getElementById('fresh-catch-list');
  el.innerHTML = products
    .filter(p => p.available)
    .map(p => `
      <div class="catch-row-item reveal">
        <div>
          <div class="catch-fish-name">${p.emoji} ${p.name}</div>
          <div class="catch-fish-sub">${p.sub}</div>
        </div>
        <div style="text-align:right;">
          <div class="catch-price">₹${p.price}</div>
          <div style="font-size:0.6rem;color:var(--muted);margin-top:2px;">per kg</div>
        </div>
      </div>
    `).join('');
  initReveal();
}

/* ─────────────────────────────────────────────────────────
   RENDER — Product List
   ───────────────────────────────────────────────────────── */
function renderProductList() {
  let list = products;
  if (currentFilter !== 'all') list = list.filter(p => p.category === currentFilter);
  if (currentSearch)           list = list.filter(p => p.name.toLowerCase().includes(currentSearch.toLowerCase()) || p.sub.toLowerCase().includes(currentSearch.toLowerCase()));

  const countLabel = document.getElementById('prod-count-label');
  if (countLabel) {
    countLabel.textContent = `${list.length} Product${list.length !== 1 ? 's' : ''} Available`;
  }

  const container = document.getElementById('product-list');
  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Nothing found</div>
        <div class="empty-sub">Try a different filter or search term.</div>
      </div>`;
    return;
  }

  container.innerHTML = list.map(p => {
    const hasPhoto = p.image && !p.image.startsWith('data:image/svg');
    const thumb = hasPhoto
      ? `<div class="prod-emoji-box"><img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;"></div>`
      : `<div class="prod-emoji-box">${p.emoji || '🐟'}</div>`;
    return `
    <div class="prod-item" style="${!p.available ? 'opacity:0.5;' : ''}">
      ${thumb}
      <div class="prod-info">
        <div class="prod-sub">${p.sub}</div>
        <div class="prod-name">${p.name}</div>
        ${p.available
          ? `<div class="prod-price">₹${p.price} / kg</div>`
          : `<div class="prod-oos">Out of stock</div>`}
      </div>
      <div class="prod-actions">
        ${p.available ? `
          <div class="qty-row">
            <button class="qty-btn qty-btn-dark" onclick="changeQty('${p.id}',-1,'list')">−</button>
            <span class="qty-val qty-val-dark" id="list-qty-${p.id}">${cart[p.id]||0}</span>
            <button class="qty-btn qty-btn-dark" onclick="changeQty('${p.id}',1,'list')">+</button>
          </div>
          <button class="btn btn-aqua btn-sm" onclick="addToCart('${p.id}')">Add</button>
        ` : `<span class="tag-pill">Unavailable</span>`}
      </div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────
   RENDER — Cart
   ───────────────────────────────────────────────────────── */
async function renderCart() {
  const container   = document.getElementById('cart-container');
  const totalSec    = document.getElementById('cart-total-section');
  const cartItems   = Object.entries(cart).filter(([,q]) => q > 0);

  if (!cartItems.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <div class="empty-title">Your cart is empty</div>
        <div class="empty-sub">Browse our fresh catch and add something delicious.</div>
        <button class="btn btn-dark" onclick="showPage('products')">Browse Products</button>
      </div>`;
    totalSec.style.display = 'none';
    return;
  }

  let subtotal = 0;
  const rows = cartItems.map(([id, qty]) => {
    const p   = products.find(x => x.id == id);
    const sub = p.price * qty;
    subtotal += sub;
    const picture = p.image && !p.image.startsWith('data:image/svg')
      ? `<img src="${p.image}" alt="${p.name}" class="order-item-thumb">`
      : `<div class="order-item-emoji">${p.emoji || '🐟'}</div>`;
    return `
      <div class="order-item-row">
        <div class="order-item-thumb-wrap">${picture}</div>
        <div class="order-item-info">
          <div class="order-item-name">${p.name}</div>
          <div class="order-item-meta">${qty} kg · ₹${p.price} / kg</div>
        </div>
        <div class="order-item-price">₹${sub}</div>
        <button class="order-item-remove" onclick="removeFromCart('${id}')">✕</button>
      </div>`;
  });

  // Fetch delivery charge settings
  let deliveryAmt = 0;
  let deliveryLabel = 'Free';
  try {
    const dc = await Store.getDeliveryCharge();
    if (dc.amount > 0) {
      if (dc.freeAbove > 0 && subtotal >= dc.freeAbove) {
        deliveryLabel = `<span style="text-decoration:line-through;color:var(--muted);margin-right:4px;">₹${dc.amount}</span> <span class="free">Free</span>`;
        deliveryAmt = 0;
      } else {
        deliveryAmt = dc.amount;
        deliveryLabel = `₹${dc.amount}`;
        if (dc.freeAbove > 0) {
          deliveryLabel += ` <span style="font-size:0.6rem;color:var(--muted);">(free above ₹${dc.freeAbove})</span>`;
        }
      }
    }
  } catch(e) { console.warn('Could not fetch delivery charge:', e); }

  const total = subtotal + deliveryAmt;

  container.innerHTML = `
    <div class="order-section-label">Order Items · ${cartItems.length} item${cartItems.length>1?'s':''}</div>
    ${rows.join('')}`;
  totalSec.style.display = 'block';
  document.getElementById('subtotal-val').textContent = `₹${subtotal}`;
  document.getElementById('delivery-val').innerHTML = deliveryLabel;
  document.getElementById('total-val').textContent    = `₹${total}`;
}

/* ─────────────────────────────────────────────────────────
   Cart operations
   ───────────────────────────────────────────────────────── */
function changeQty(id, delta, prefix) {
  cart[id] = Math.max(0, (cart[id] || 0) + delta);
  ['feat','list'].forEach(p => {
    const el = document.getElementById(`${p}-qty-${id}`);
    if (el) el.textContent = cart[id];
  });
  updateCartCount();
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  ['feat','list'].forEach(p => {
    const el = document.getElementById(`${p}-qty-${id}`);
    if (el) el.textContent = cart[id];
  });
  updateCartCount();
  showToast('Added to order');
}

function removeFromCart(id) {
  delete cart[id];
  updateCartCount();
  renderCart();
}

function updateCartCount() {
  const count = Object.values(cart).reduce((a,b) => a+b, 0);
  const badge  = document.getElementById('tab-order-badge');
  const fc     = document.getElementById('floating-cart');
  const fcCount= document.getElementById('floating-cart-count');
  const navBadge = document.getElementById('nav-cart-count');

  badge.textContent = count;
  fcCount.textContent = count;
  navBadge.textContent = count;

  count > 0
    ? (badge.classList.add('show'), fc.classList.add('show'), navBadge.classList.add('show'))
    : (badge.classList.remove('show'), fc.classList.remove('show'), navBadge.classList.remove('show'));
}

/* ── Filters & search ── */
function filterProducts(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderProductList();
}
function searchProducts(val) {
  currentSearch = val;
  renderProductList();
}

/* ─────────────────────────────────────────────────────────
   Delivery checker
   ───────────────────────────────────────────────────────── */
function checkDelivery() {
  const pin = document.getElementById('pincode-input').value.trim();
  const el  = document.getElementById('pincode-result');
  el.className = 'pin-result';
  if (pin.length !== 6) {
    el.className += ' warn'; el.style.display = 'block';
    el.textContent = 'Please enter a valid 6-digit PIN code.';
    return;
  }
  el.style.display = 'block';
  if (servicePincodes.includes(pin)) {
    el.className += ' ok';
    el.textContent = '✓ Delivery available · Expected 2–3 hours';
  } else {
    el.className += ' err';
    el.textContent = '✕ Not delivering to this area yet — expanding soon.';
  }
}

/* ─────────────────────────────────────────────────────────
   Geolocation
   ───────────────────────────────────────────────────────── */
function getLocation() {
  const status = document.getElementById('location-status');
  const preview= document.getElementById('map-preview');
  status.textContent = 'Locating…';
  if (!navigator.geolocation) {
    status.textContent = 'Geolocation not supported.'; return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    selectedLocation = { lat, lng };
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    status.innerHTML = `Location captured · <a href="${url}" target="_blank" style="color:var(--aqua);font-weight:600;">Open in Maps →</a>`;
    preview.style.display = 'block';
    preview.innerHTML = `
      <a href="${url}" target="_blank" class="map-card" style="text-decoration:none;">
        <span style="font-size:1.6rem;">📍</span>
        <div class="map-card-text">
          <div class="name">Location Confirmed</div>
          <div class="coord">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div class="hint">Tap to open in Google Maps</div>
        </div>
      </a>`;
  }, () => {
    status.textContent = 'Unable to access location. Please allow permission.';
  });
}

/* ─────────────────────────────────────────────────────────
   WhatsApp order
   ───────────────────────────────────────────────────────── */
async function placeOrder() {
  const name    = document.getElementById('cust-name').value.trim();
  const phone   = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const items   = Object.entries(cart).filter(([,q]) => q > 0);

  if (!name)    { showToast('Enter your name');      return; }
  if (!phone)   { showToast('Enter phone number');   return; }
  if (!address) { showToast('Enter delivery address'); return; }
  if (!items.length) { showToast('Cart is empty');   return; }

  let subtotal = 0;
  const orderItems = [];
  const lines = items.map(([id, qty]) => {
    const p = products.find(x => x.id == id);
    const s = p.price * qty;
    subtotal += s;
    orderItems.push({ product_id: p.id, name: p.name, qty, price: p.price, sub: s });
    return `• ${p.name} — ${qty}kg — ₹${s}`;
  }).join('\n');

  // Fetch delivery charge
  let deliveryAmt = 0;
  try {
    const dc = await Store.getDeliveryCharge();
    if (dc.amount > 0) {
      if (dc.freeAbove > 0 && subtotal >= dc.freeAbove) {
        deliveryAmt = 0;
      } else {
        deliveryAmt = dc.amount;
      }
    }
  } catch(e) { console.warn('Could not fetch delivery charge:', e); }

  const total = subtotal + deliveryAmt;

  const locLine = selectedLocation
    ? `📍 Location:\nhttps://www.google.com/maps?q=${selectedLocation.lat},${selectedLocation.lng}`
    : '📍 Location: not shared';

  // Save the order to backend
  const ts = Date.now();
  const orderId = `ORD-${Math.floor(Math.random() * 900000 + 100000)}`;
  await Store.addOrder({
      id: orderId, ts, total, name, phone, address, items: orderItems, status: 'pending', delivery: deliveryAmt
  });

  const deliveryLine = deliveryAmt > 0 ? `🚚 *Delivery: ₹${deliveryAmt}*` : '🚚 *Delivery: Free*';

  const msg = [
    '🐟 *New Order — OceanFresh*',
    '',
    `👤 *Name:* ${name}`,
    `📱 *Phone:* ${phone}`,
    '',
    '*Order:*',
    lines,
    '',
    `💰 *Subtotal: ₹${subtotal}*`,
    deliveryLine,
    `💰 *Total: ₹${total}*`,
    '',
    `🏠 *Address:*\n${address}`,
    '',
    locLine,
    '',
    '_via OceanFresh_'
  ].join('\n');

  const waNum = await Store.getWA();
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
  
  // Clear cart and go home
  cart = {};
  renderCart();
  updateCartCount();
  showPage('home');
  showToast('Order sent!');
}

async function openWhatsAppSupport() {
  const waNum = await Store.getWA();
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent("Hi! I'd like to know more about today's fresh catch 🐟")}`, '_blank');
}

/* ── Toast ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}