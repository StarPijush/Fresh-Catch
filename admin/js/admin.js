// ═══════════════════════════════════════════════════════════
// admin.js  ·  OceanFresh Admin Panel
// Depends on: ../../store.js  (loaded before this file)
// ═══════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);
const fmt     = n  => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = ts => new Date(ts).toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
const fmtTime = ts => new Date(ts).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

/* ── Toast ── */
function toast(msg, type='') {
  const t = $('admin-toast');
  t.textContent = msg;
  t.className   = `show ${type}`.trim();
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, 2800);
}

/* ══════════════════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════════════════ */
function initAuth() {
  // Always show login screen first as per user request
  showAuthScreen('screen-login');
}

/* Login */
async function doLogin() {
  const mob  = $('login-mobile').value.trim();
  const pass = $('login-password').value;
  const err  = $('login-error');
  err.className = 'auth-msg error'; 
  err.classList.remove('show');

  if (!mob || !pass) { err.textContent = 'Please fill in all fields.'; err.classList.add('show'); return; }
  
  toast('Checking credentials...', 'info');
  window._loginError = null;

  try {
    const isValid = await Store.checkLogin(mob, pass);
    if (isValid) {
      toast('Login successful!', 'success');
      setTimeout(() => { launchAdmin(); }, 500);
    } else {
      err.textContent = window._loginError || 'Incorrect email/mobile or password.';
      err.classList.add('show');
      toast('Login failed', 'error');
    }
  } catch (e) {
    console.error('doLogin Critical Error:', e);
    err.textContent = 'A system error occurred. Check console.';
    err.classList.add('show');
  }
}

/* Forgot password */
async function doForgotSendOTP() {
  const mob = $('forgot-mobile').value.trim();
  const err = $('forgot-error');
  err.classList.remove('show');
  if (mob.length < 10) { err.textContent = 'Enter a valid mobile number.'; err.classList.add('show'); return; }
  
  const admin = await Store.getAdmin();
  if (admin.mobile !== mob) { err.textContent = 'Mobile number not found.'; err.classList.add('show'); return; }
  
  const otp = Store.generateOTP();
  alert(`🔑 Your OTP is: ${otp}\n(In production this is sent via SMS)`);
  $('otp-mobile-display').textContent = mob.slice(0, -4) + '****';
  showAuthScreen('screen-otp');
}

/* OTP inputs — auto-advance + Paste support */
function setupOTPInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((inp, i) => {
    // 1. Single digit input + Advance
    inp.addEventListener('input', (e) => {
      if (inp.value && i < inputs.length - 1) {
        inputs[i + 1].focus();
      } else if (inp.value && i === inputs.length - 1) {
        doVerifyOTP(); // Auto-submit on 6th digit
      }
    });
    // 2. Backspace back-navigation
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
    // 3. Paste support (fill all boxes)
    inp.addEventListener('paste', e => {
      const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (data) {
        data.split('').forEach((char, idx) => {
          if (inputs[idx]) inputs[idx].value = char;
        });
        const nextIndex = Math.min(data.length, inputs.length - 1);
        inputs[nextIndex].focus();
        e.preventDefault();
      }
    });
  });
}

function showAuthScreen(id) {
  document.querySelectorAll('.auth-screen').forEach(s => s.style.display = 'none');
  const el = $(id);
  if (el) {
    el.style.display = 'block';
    // Auto-focus improvements
    if (id === 'screen-otp') {
      setTimeout(() => { 
        const first = $('otp-input-1');
        if (first) first.focus(); 
      }, 100);
    } else if (id === 'screen-login') {
      $('login-mobile').focus();
    }
  }
}

function doVerifyOTP() {
  const inputs = document.querySelectorAll('.otp-input');
  const val    = [...inputs].map(i => i.value).join('');
  const err    = $('otp-error');
  err.classList.remove('show');
  if (val.length !== 6) { err.textContent = 'Enter all 6 digits.'; err.classList.add('show'); return; }
  if (Store.verifyOTP(val)) {
    Store.clearOTP();
    showAuthScreen('screen-reset');
  } else {
    err.textContent = 'Incorrect OTP.';
    err.classList.add('show');
    inputs.forEach(i => { i.value = ''; });
    inputs[0].focus();
  }
}

async function doResetPassword() {
  const p1  = $('reset-pass1').value;
  const p2  = $('reset-pass2').value;
  const err = $('reset-error');
  err.classList.remove('show');
  if (p1.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.classList.add('show'); return; }
  if (p1 !== p2)     { err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
  await Store.updateAdmin({ password: p1 });
  toast('Password updated successfully', 'success');
  showAuthScreen('screen-login');
}

/* ══════════════════════════════════════════════════════
   LAUNCH ADMIN
   ══════════════════════════════════════════════════════ */
async function launchAdmin() {
  $('auth-shell').style.display = 'none';
  $('admin-app').classList.add('show');
  const a = await Store.getAdmin();
  $('sb-name').textContent     = a.name;
  $('sb-mobile').textContent   = a.mobile;
  $('sb-initials').textContent = a.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  $('topbar-date').textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
  // Delay rendering to ensure DOM layout is complete
  setTimeout(() => navigateTo('dashboard'), 100);
}

/* Sidebar nav */
function navigateTo(panel) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const el  = $('panel-' + panel);
  const nav = $('nav-'   + panel);
  // Force reflow to ensure DOM updates
  if (el) { el.offsetHeight; el.classList.add('active'); }
  if (nav) nav.classList.add('active');
  const titles = { dashboard:'Dashboard', products:'Products', orders:'Orders', settings:'Settings' };
  $('topbar-title').textContent = titles[panel] || panel;
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('show');
  // Use requestAnimationFrame to ensure rendering happens after classList changes
  requestAnimationFrame(() => {
    if (panel === 'dashboard') renderDashboard();
    if (panel === 'products')  renderProducts();
    if (panel === 'orders')    renderOrders();
    if (panel === 'settings')  renderSettings();
  });
}

/* Mobile hamburger */
$('topbar-hamburger').addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
  $('sidebar-overlay').classList.toggle('show');
});
$('sidebar-overlay').addEventListener('click', () => {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('show');
});

function doLogout() {
  Store.logout();
  $('admin-app').classList.remove('show');
  $('auth-shell').style.display = '';
  showAuthScreen('screen-login');
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════ */
let chartMode = 'income';

async function renderDashboard() {
  try {
    const s = await Store.getStats();
    if (!s) {
      toast('Unable to load dashboard stats', 'error');
      // Show placeholder stats instead of blank
      $('stat-today-sales').textContent  = '0';
      $('stat-today-income').textContent = '₹0';
      $('stat-week-income').textContent  = '₹0';
      $('stat-pending').textContent      = '0';
      $('stat-total-income').textContent = '₹0';
      $('stat-total-orders').textContent = '0';
      $('stat-products').textContent     = '0/0';
      return;
    }
    $('stat-today-sales').textContent  = s.todaySales;
    $('stat-today-income').textContent = fmt(s.todayIncome);
    $('stat-week-income').textContent  = fmt(s.weekIncome);
    $('stat-pending').textContent      = s.pendingOrders;
    $('stat-total-income').textContent = fmt(s.totalIncome);
    $('stat-total-orders').textContent = s.totalOrders;
    $('stat-products').textContent     = `${s.availableProducts}/${s.totalProducts}`;

    const badge = $('pending-badge');
    badge.textContent = s.pendingOrders;
    badge.style.display = s.pendingOrders > 0 ? 'inline' : 'none';

    renderChart(s.chart);
    renderTopProducts(s.topProducts);
    renderRecentOrders(s.recentOrders);
  } catch (err) {
    console.error('Dashboard render error:', err);
    toast('Dashboard load failed - check console', 'error');
  }
}

function renderChart(chart) {
  const bars  = $('chart-bars');
  const max   = Math.max(...chart.map(d => chartMode === 'income' ? d.income : d.sales), 1);
  const today = new Date().toLocaleDateString('en-IN', { weekday:'short' });
  bars.innerHTML = chart.map(d => {
    const val = chartMode === 'income' ? d.income : d.sales;
    const pct = Math.round((val / max) * 100);
    return `<div class="chart-bar-wrap">
      <div class="chart-bar-outer">
        <div class="chart-bar${d.label === today ? ' today' : ''}" style="height:${Math.max(pct,4)}%;"
             title="${d.label}: ${chartMode==='income' ? fmt(d.income) : d.sales+' orders'}"></div>
      </div>
      <div class="chart-bar-label">${d.label}</div>
    </div>`;
  }).join('');
}

async function setChartMode(mode) {
  chartMode = mode;
  document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const stats = await Store.getStats();
  renderChart(stats.chart);
}

function renderTopProducts(items) {
  if (!items || !Array.isArray(items)) items = [];
  const el = $('top-products-list');
  if (!items.length) { el.innerHTML = '<div class="empty-state-sub" style="padding:16px;color:var(--muted);">No data yet</div>'; return; }
  const max = items[0].qty;
  el.innerHTML = items.map((p, i) => `
    <div class="top-prod-item">
      <div class="top-prod-rank">${i+1}</div>
      <div class="top-prod-name">${p.name}</div>
      <div class="top-prod-bar-wrap"><div class="top-prod-bar" style="width:${Math.round(p.qty/max*100)}%"></div></div>
      <div class="top-prod-qty">${p.qty}kg</div>
    </div>`).join('');
}

function renderRecentOrders(orders) {
  const el = $('recent-orders-list');
  if (!orders.length) { el.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:.78rem;">No orders yet</div>'; return; }
  el.innerHTML = orders.map(o => `
    <div class="table-row">
      <div class="col-id">${o.id}</div>
      <div class="col-cust"><div class="cell-name-main">${o.name}</div><div class="cell-name-sub">${o.items.length} item${o.items.length>1?'s':''}</div></div>
      <div class="col-total">${fmt(o.total)}</div>
      <div class="col-ostatus">${statusBadge(o.status)}</div>
    </div>`).join('');
}

function statusBadge(s) {
  const map = { delivered:'badge-green', pending:'badge-gold', preparing:'badge-aqua' };
  return `<span class="badge ${map[s]||'badge-muted'}">${s}</span>`;
}

/* ══════════════════════════════════════════════════════
   PRODUCTS
   ══════════════════════════════════════════════════════ */
let prodFilter = 'all';
let prodSearch = '';

async function renderProducts() {
  try {
    let list = await Store.getProducts();
    if (!list) list = [];
    if (prodFilter !== 'all') list = list.filter(p => p.category === prodFilter);
    if (prodSearch) list = list.filter(p =>
      p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
      p.sub.toLowerCase().includes(prodSearch.toLowerCase())
    );
    $('prod-count').textContent = `${list.length} product${list.length !== 1 ? 's' : ''}`;
    const el = $('products-tbody');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state" style="padding:48px 16px;">
        <div class="empty-state-icon">🐟</div>
        <div class="empty-state-title">No products found</div>
        <div class="empty-state-sub">Try a different filter or search term.</div>
      </div>`; return;
    }
    el.innerHTML = list.map(p => `
      <div class="table-row">
        <div class="col-img">
          <div class="col-img-thumb">
            <img src="${p.image}" alt="${p.name}" onerror="this.style.background='#1c2030';this.style.display='flex';">
          </div>
        </div>
        <div class="col-name">
          <div class="cell-name-main">${p.name}</div>
          <div class="cell-name-sub">${p.sub}</div>
        </div>
        <div class="col-cat"><span class="badge badge-muted">${p.category}</span></div>
        <div class="col-price" style="font-weight:600;color:var(--aqua);">${fmt(p.price)}</div>
        <div class="col-status">
          <label class="toggle">
            <input type="checkbox" ${p.available ? 'checked' : ''} onchange="doToggleAvailable('${p.id}')">
            <div class="toggle-track"></div>
          </label>
        </div>
        <div class="col-feat">
          <label class="toggle">
            <input type="checkbox" ${p.featured ? 'checked' : ''} onchange="doToggleFeatured('${p.id}')">
            <div class="toggle-track"></div>
          </label>
        </div>
        <div class="col-actions">
          <button class="icon-btn" onclick="openEditModal('${p.id}')" title="Edit">✏️</button>
          <button class="icon-btn danger" onclick="confirmDelete('${p.id}','${p.name.replace(/'/g,"\\\'")}')">🗑</button>
        </div>
      </div>`).join('');
  } catch (err) {
    console.error('Products render error:', err);
    $('products-tbody').innerHTML = '<div style="padding:20px;color:var(--warn);">Error loading products</div>';
    toast('Products load failed', 'error');
  }
}

function setProdFilter(cat, el) {
  prodFilter = cat;
  document.querySelectorAll('.prod-filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderProducts();
}

function searchProducts(val) { prodSearch = val; renderProducts(); }

async function doToggleAvailable(id) {
  await Store.toggleAvailable(id);
  const p = await Store.getProduct(id);
  toast(`${p.name} is now ${p.available ? 'available' : 'unavailable'}`, 'success');
}

async function doToggleFeatured(id) {
  await Store.toggleFeatured(id);
  const p = await Store.getProduct(id);
  toast(`${p.name} ${p.featured ? 'added to' : 'removed from'} featured`, 'success');
}

/* ── Product Modal ─────────────────────────────────────────
   State held here, NOT in a <form> (avoid .reset() bugs)
   ─────────────────────────────────────────────────────────── */
let _modalImageData = null;   // base64 string or null

function extractEmoji(dataUrl) {
  if (!dataUrl) return '🐟';
  try {
    const decoded = decodeURIComponent(dataUrl);
    const m = decoded.match(/<text[^>]*>([^<]+)<\/text>/);
    if (m) return m[1];
  } catch(e) {}
  return '🐟';
}

function generateEmojiImage(emoji) {
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#1c2030"/>
      <text x="200" y="155" font-family="serif" font-size="64" text-anchor="middle" fill="rgba(74,184,193,0.3)">${emoji}</text>
      <text x="200" y="195" font-family="sans-serif" font-size="13" text-anchor="middle" fill="rgba(255,255,255,0.2)" letter-spacing="2">NO IMAGE</text>
    </svg>`);
}

function _clearModal() {
  $('prod-modal-id').value         = '';
  $('prod-modal-name').value       = '';
  $('prod-modal-sub').value        = '';
  $('prod-modal-price').value      = '';
  $('prod-modal-cat').value        = 'fresh';
  $('prod-modal-avail').checked    = true;
  $('prod-modal-featured').checked = false;
  $('prod-modal-emoji').value      = '🐟';
  _modalImageData = null;
  // Reset image UI
  const preview = $('prod-modal-img-preview');
  const placeholder = $('prod-img-upload-placeholder');
  const removeBtn = $('prod-img-remove-btn');
  const fileInp = $('prod-modal-img-file');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'block';
  if (removeBtn) removeBtn.style.display = 'none';
  if (fileInp) fileInp.value = '';
}

function openAddModal() {
  $('prod-modal-title').textContent = 'Add New Product';
  _clearModal();
  $('prod-modal').classList.add('show');
}

async function openEditModal(id) {
  const p = await Store.getProduct(id);
  if (!p) return;
  $('prod-modal-title').textContent   = 'Edit Product';
  $('prod-modal-id').value            = id;
  $('prod-modal-name').value          = p.name;
  $('prod-modal-sub').value           = p.sub || '';
  $('prod-modal-price').value         = p.price;
  $('prod-modal-cat').value           = p.category;
  $('prod-modal-avail').checked       = p.available;
  $('prod-modal-featured').checked    = p.featured;
  $('prod-modal-emoji').value         = extractEmoji(p.image);
  _modalImageData = p.image || null;
  // Show existing photo if it's a real image (not a placeholder SVG)
  const isRealPhoto = _modalImageData && !_modalImageData.startsWith('data:image/svg');
  const preview = $('prod-modal-img-preview');
  const placeholder = $('prod-img-upload-placeholder');
  const removeBtn = $('prod-img-remove-btn');
  if (isRealPhoto) {
    preview.src = _modalImageData;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'inline';
  } else {
    preview.src = ''; preview.style.display = 'none';
    placeholder.style.display = 'block';
    removeBtn.style.display = 'none';
  }
  $('prod-modal').classList.add('show');
}

function closeProdModal() { $('prod-modal').classList.remove('show'); }

let _modalImageFile = null; // Store the actual File object for Firebase Storage

/* ── Image upload handler ─────────────────────────────── */
function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('Image is too large. Max 2MB.', 'error'); input.value = ''; return;
  }
  _modalImageFile = file; // Store file for saving later
  const reader = new FileReader();
  reader.onload = (e) => {
    _modalImageData = e.target.result; // Still use base64 for local preview
    const preview = $('prod-modal-img-preview');
    preview.src = _modalImageData;
    preview.style.display = 'block';
    $('prod-img-upload-placeholder').style.display = 'none';
    $('prod-img-remove-btn').style.display = 'inline';
  };
  reader.readAsDataURL(file);
}

function removeProductImage() {
  _modalImageData = null;
  _modalImageFile = null;
  const preview = $('prod-modal-img-preview');
  preview.src = ''; preview.style.display = 'none';
  $('prod-img-upload-placeholder').style.display = 'block';
  $('prod-img-remove-btn').style.display = 'none';
  $('prod-modal-img-file').value = '';
}

/* ── Compress image to base64 using canvas ─────────── */
function compressImage(dataUrl, maxWidth = 600, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}

async function saveProdModal() {
  const id    = $('prod-modal-id').value;
  const name  = $('prod-modal-name').value.trim();
  const sub   = $('prod-modal-sub').value.trim();
  const price = parseFloat($('prod-modal-price').value);
  const cat   = $('prod-modal-cat').value;
  const avail = $('prod-modal-avail').checked;
  const feat  = $('prod-modal-featured').checked;
  const emoji = $('prod-modal-emoji').value.trim() || '🐟';

  if (!name)                       { toast('Product name is required', 'error'); return; }
  if (isNaN(price) || price <= 0)  { toast('Enter a valid price', 'error'); return; }

  toast('Preparing to save...', 'info');

  let finalImage = _modalImageData;

  // Compress base64 image (bypasses Firebase Storage CORS issues)
  if (_modalImageFile && _modalImageData && !_modalImageData.startsWith('data:image/svg')) {
    try {
      toast('Compressing image...', 'info');
      finalImage = await compressImage(_modalImageData, 600, 0.7);
      console.log('✓ Image compressed to base64 (' + Math.round(finalImage.length / 1024) + 'KB)');
    } catch (err) {
      console.warn('Image compression failed, using original:', err);
    }
  } else if (!_modalImageData || _modalImageData.startsWith('data:image/svg')) {
    finalImage = generateEmojiImage(emoji);
  }

  const data = {
    name, sub, price, category: cat,
    available: avail, featured: feat,
    image: finalImage,
    emoji,
    updated_at: Date.now()
  };

  try {
    toast('Saving product data...', 'info');
    if (id) {
      await Store.updateProduct(id, data);
      toast(`✓ ${name} updated successfully`, 'success');
    } else {
      await Store.addProduct(data);
      toast(`✓ ${name} added successfully`, 'success');
    }
    closeProdModal();
    renderProducts();
  } catch (err) {
    console.error('Save failed:', err);
    toast(`Save failed: ${err.message}`, 'error');
  }
}

/* Delete */
function confirmDelete(id, name) {
  $('delete-modal-msg').textContent = `Delete "${name}"? This cannot be undone.`;
  $('delete-modal').classList.add('show');
  $('delete-modal').dataset.deleteId = id;
}
function closeDeleteModal() { $('delete-modal').classList.remove('show'); }

async function doDelete() {
  const id = $('delete-modal').dataset.deleteId;
  const p  = await Store.getProduct(id);
  await Store.deleteProduct(id);
  toast(`${p?.name || 'Product'} deleted`, 'error');
  closeDeleteModal();
  renderProducts();
}

/* ══════════════════════════════════════════════════════
   ORDERS
   ══════════════════════════════════════════════════════ */
let orderFilter = 'all';
let orderSearch = '';

async function renderOrders() {
  try {
    let list = await Store.getOrders();
    if (!list) list = [];
    if (orderFilter !== 'all') list = list.filter(o => o.status === orderFilter);
    if (orderSearch) list = list.filter(o =>
      o.name.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.phone.includes(orderSearch)
    );
    $('order-count').textContent = `${list.length} order${list.length !== 1 ? 's' : ''}`;
    const el = $('orders-tbody');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state" style="padding:40px 16px;">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-title">No orders found</div>
      </div>`; return;
    }
    el.innerHTML = list.map(o => `
      <div class="table-row" style="cursor:pointer;" onclick="openOrderDetail('${o.id}')">
        <div class="col-id">${o.id}</div>
        <div class="col-cust"><div class="cell-name-main">${o.name}</div><div class="cell-name-sub">${o.phone}</div></div>
        <div class="col-total">${fmt(o.total)}</div>
        <div class="col-ostatus">${statusBadge(o.status)}</div>
        <div class="col-date">${fmtDate(o.ts)}<br><span style="font-size:.6rem;color:var(--muted);">${fmtTime(o.ts)}</span></div>
      </div>`).join('');
  } catch (err) {
    console.error('Orders render error:', err);
    $('orders-tbody').innerHTML = '<div style="padding:20px;color:var(--warn);">Error loading orders</div>';
    toast('Orders load failed', 'error');
  }
}

function setOrderFilter(f, el) {
  orderFilter = f;
  document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderOrders();
}

function searchOrders(val) { orderSearch = val; renderOrders(); }

async function openOrderDetail(id) {
  const orders = await Store.getOrders();
  const o = orders.find(x => x.id === id);
  if (!o) return;
  $('order-detail-content').innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;">Order ID</div>
      <div style="font-size:.9rem;font-weight:600;color:var(--aqua);">${o.id}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div>
        <div style="font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;">Customer</div>
        <div style="font-size:.85rem;color:var(--cream);">${o.name}</div>
        <div style="font-size:.72rem;color:var(--muted2);">${o.phone}</div>
      </div>
      <div>
        <div style="font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;">Date & Time</div>
        <div style="font-size:.82rem;color:var(--cream);">${fmtDate(o.ts)}</div>
        <div style="font-size:.72rem;color:var(--muted2);">${fmtTime(o.ts)}</div>
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <div style="font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Delivery Address</div>
      <div style="font-size:.82rem;color:var(--cream);line-height:1.5;">${o.address}</div>
    </div>
    <div style="height:1px;background:var(--border);margin:14px 0;"></div>
    <div style="font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Items</div>
    ${o.items.map(it => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:.85rem;color:var(--cream);">${it.name}</div>
          <div style="font-size:.7rem;color:var(--muted2);">${it.qty}kg × ${fmt(it.price)}</div>
        </div>
        <div style="font-weight:600;color:var(--aqua);">${fmt(it.sub)}</div>
      </div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:700;font-size:.95rem;">
      <span>Total</span><span style="color:var(--aqua);">${fmt(o.total)}</span>
    </div>
    <div style="height:1px;background:var(--border);margin:4px 0 16px;"></div>
    <div style="font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Update Status</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${['pending','preparing','delivered'].map(s => `
        <button class="btn btn-sm ${o.status===s?'btn-primary':'btn-ghost'}" onclick="updateStatus('${o.id}','${s}')">${s}</button>`).join('')}
    </div>`;
  $('order-detail-modal').classList.add('show');
}

function closeOrderDetail() { $('order-detail-modal').classList.remove('show'); }

async function updateStatus(id, status) {
  await Store.updateOrderStatus(id, status);
  toast(`Order ${id} → ${status}`, 'success');
  closeOrderDetail();
  await renderOrders();
  
  const stats = await Store.getStats();
  const badge = $('pending-badge');
  badge.textContent   = stats.pendingOrders;
  badge.style.display = stats.pendingOrders > 0 ? 'inline' : 'none';
}

/* ══════════════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════════════ */
async function renderSettings() {
  const a = await Store.getAdmin();
  $('settings-name-val').value   = a.name   || '';
  $('settings-mobile-val').value = a.mobile || '';
  // Load delivery charge settings
  const dc = await Store.getDeliveryCharge();
  $('settings-delivery-charge').value     = dc.amount || 0;
  $('settings-delivery-free-above').value = dc.freeAbove || 0;
}

async function saveProfileSettings() {
  const name   = $('settings-name-val').value.trim();
  const mobile = $('settings-mobile-val').value.trim();
  if (!name)           { toast('Name cannot be empty', 'error'); return; }
  if (mobile.length < 10) { toast('Enter a valid mobile number', 'error'); return; }
  await Store.updateAdmin({ name, mobile });
  $('sb-name').textContent     = name;
  $('sb-mobile').textContent   = mobile;
  $('sb-initials').textContent = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  toast('Profile updated', 'success');
}

async function savePasswordSettings() {
  const cur   = $('settings-cur-pass').value;
  const p1    = $('settings-new-pass').value;
  const p2    = $('settings-confirm-pass').value;
  const admin = await Store.getAdmin();
  if (cur !== admin.password) { toast('Current password is incorrect', 'error'); return; }
  if (p1.length < 6)         { toast('New password must be at least 6 characters', 'error'); return; }
  if (p1 !== p2)             { toast('Passwords do not match', 'error'); return; }
  await Store.updateAdmin({ password: p1 });
  $('settings-cur-pass').value     = '';
  $('settings-new-pass').value     = '';
  $('settings-confirm-pass').value = '';
  toast('Password changed successfully', 'success');
}

async function saveWASettings() {
  const num = $('settings-wa-val').value.trim().replace(/\D/g, '');
  if (num.length < 10) { toast('Enter a valid WhatsApp number', 'error'); return; }
  await Store.setWA('91' + num.slice(-10));
  toast('WhatsApp number updated', 'success');
}

async function saveDeliverySettings() {
  const amount    = parseFloat($('settings-delivery-charge').value) || 0;
  const freeAbove = parseFloat($('settings-delivery-free-above').value) || 0;
  if (amount < 0) { toast('Charge cannot be negative', 'error'); return; }
  await Store.setDeliveryCharge({ amount, freeAbove });
  toast('Delivery charge updated', 'success');
}

/* ══════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupOTPInputs();
  initAuth();
  $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('login-mobile').addEventListener('keydown',   e => { if (e.key === 'Enter') doLogin(); });
});

/* Password Toggle */
function togglePassword(inputId, btn) {
  const inp = $(inputId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁️';
  }
}