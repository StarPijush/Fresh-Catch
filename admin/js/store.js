// ═══════════════════════════════════════════════════════════
// store.js  ·  OceanFresh — Shared Data Store (REALTIME DB)
// Used by BOTH the storefront (index.html) and admin panel.
// ═══════════════════════════════════════════════════════════

// NOTE: This file now uses Realtime Database instead of Firestore
// to avoid the "Billing required" error in some regions.

// ── Firebase Service Check ────────────────────────────────────
let _db, _auth, _storage;
try {
  _db = firebase.database(); // Now using Realtime Database
  _auth = firebase.auth();
  _storage = firebase.storage();
  console.log('✓ Firebase Realtime DB initialized successfully.');
} catch (err) {
  console.error('✕ CRITICAL: Firebase SDK failed to initialize. Check if scripts are loaded correctly.');
  console.error(err.message);
  // Basic mock
  _db = { ref: () => ({ once: () => Promise.resolve({ val: () => ({}) }), set: () => Promise.resolve(), remove: () => Promise.resolve(), push: () => ({ key: 'mock' }), update: () => Promise.resolve() }) };
}

const Store = (() => {

  // ── Session ────────────────────────────────────────────────
  if (_auth) {
    _auth.onAuthStateChanged((user) => {
      if (user) {
        localStorage.setItem('of_session', JSON.stringify({ loggedIn: true, ts: Date.now(), uid: user.uid }));
      } else {
        // Fix: Don't overwrite if we have a manual DB session (admin_db_user)
        try {
          const current = JSON.parse(localStorage.getItem('of_session'));
          if (current && current.loggedIn && current.uid === 'admin_db_user') return;
        } catch(e) {}
        localStorage.setItem('of_session', JSON.stringify({ loggedIn: false }));
      }
    });
  }

  function isLoggedIn() { 
    try { 
      return JSON.parse(localStorage.getItem('of_session')).loggedIn === true; 
    } catch { 
      return false; 
    } 
  }
  
  async function logout() { 
    if (_auth) await _auth.signOut();
    localStorage.setItem('of_session', JSON.stringify({ loggedIn: false })); 
  }

  // ── Admin ──────────────────────────────────────────────────
  async function getAdmin() { 
    const snap = await _db.ref('settings/of_admin').once('value');
    const defaults = { mobile: '8509597935', password: '', name: 'Shop Owner' }; 
    if (snap.exists()) {
      const data = snap.val();
      return { ...defaults, ...data }; // Merge defaults with database data
    }
    return defaults; 
  }

  async function updateAdmin(data) { 
    await _db.ref('settings/of_admin').update(data);
  }

  let _otpData = null;

  function generateOTP() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    _otpData = { code, ts: Date.now() };
    return code;
  }

  function verifyOTP(val) {
    if (!_otpData) return false;
    const isExpired = Date.now() - _otpData.ts > 300000; // 5 min
    return !isExpired && _otpData.code === val;
  }

  function clearOTP() { _otpData = null; }

  async function checkLogin(mobile, password) { 
    console.log('--- SIGN IN ATTEMPT ---');
    try {
      if (!_auth) throw new Error('Auth not initialized');
      const input = mobile.trim();
      const email = input.includes('@') ? input : `${input}@freshcatch.com`;
      
      // 1. Try Firebase Auth first
      try {
        const result = await _auth.signInWithEmailAndPassword(email, password);
        console.log('Firebase Auth success');
        return true;
      } catch (err) {
        console.warn('Firebase Auth failed, trying DB fallback...');
      }

      // 2. Fallback to Database Password (allows immediate login after OTP reset)
      const admin = await getAdmin();
      
      console.log('--- DB FALLBACK DIAGNOSTICS ---');
      console.log('Expected Mobile:', admin.mobile);
      console.log('Provided Mobile:', input);
      console.log('Mobile Match:', admin.mobile === input);
      console.log('Password Match:', admin.password === password);
      if (admin.password === '') console.warn('Note: Admin password in DB is currently EMPTY.');

      if (admin.mobile === input && admin.password === password) {
        console.log('✓ Database Auth success');
        // Force a session in localStorage even if Firebase Auth isn't active
        localStorage.setItem('of_session', JSON.stringify({ 
          loggedIn: true, ts: Date.now(), uid: 'admin_db_user' 
        }));
        return true;
      }

      window._loginError = 'Incorrect mobile or password.';
      console.error('✕ DB Fallback failed: Credentials mismatch.');
      if (admin.mobile !== input) console.error('  -> Mobile mismatch: Expected', admin.mobile, 'but got', input);
      if (admin.password !== password) console.error('  -> Password mismatch');
      return false;
    } catch (err) {
      console.error('Sign in critical failed:', err.message);
      window._loginError = err.message; 
      return false;
    } finally {
      console.log('-----------------------');
    }
  }

  // ── WhatsApp ───────────────────────────────────────────────
  async function getWA() { 
    const snap = await _db.ref('settings/of_wa').once('value');
    if (snap.exists()) return snap.val().number;
    return '918509597935'; 
  }

  async function setWA(num) { 
    await _db.ref('settings/of_wa').set({ number: num });
  }

  // ── Delivery Charge ────────────────────────────────────
  async function getDeliveryCharge() {
    const snap = await _db.ref('settings/delivery_charge').once('value');
    if (snap.exists()) return snap.val();
    return { amount: 0, freeAbove: 0 };
  }

  async function setDeliveryCharge(data) {
    await _db.ref('settings/delivery_charge').set(data);
  }

  // ── Products ───────────────────────────────────────────────
  async function getProducts() { 
    try {
      const snap = await _db.ref('products').once('value');
      const data = snap.val() || {};
      return Object.entries(data).map(([id, val]) => ({ id, ...val }));
    } catch (err) {
      console.error('Error fetching products:', err.message);
      return [];
    }
  }
  
  async function getProduct(id) { 
    const snap = await _db.ref(`products/${id}`).once('value');
    return snap.exists() ? { id, ...snap.val() } : null;
  }

  async function addProduct(prod) {
    const newRef = _db.ref('products').push();
    await newRef.set(prod);
    return newRef.key;
  }

  async function updateProduct(id, data) {
    await _db.ref(`products/${id}`).update(data);
  }

  async function deleteProduct(id) { 
    await _db.ref(`products/${id}`).remove(); 
  }

  async function subscribeProducts(onChange) {
    const ref = _db.ref('products');
    const callback = (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      onChange(list);
    };
    ref.on('value', callback);
    return () => ref.off('value', callback);
  }

  async function toggleAvailable(id) { 
    const p = await getProduct(id); 
    if (p) await updateProduct(id, { available: !p.available }); 
  }

  async function toggleFeatured(id) { 
    const p = await getProduct(id); 
    if (p) await updateProduct(id, { featured: !p.featured }); 
  }

  // ── Storage (Image Upload) ─────────────────────────────────
  async function uploadImage(file) {
    if (!_storage) throw new Error('Firebase Storage not initialized. Check Firebase configuration.');
    console.log('--- IMAGE UPLOAD ATTEMPT ---', file.name, `(${(file.size/1024).toFixed(2)}KB)`);

    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const ref = _storage.ref(`product-images/${fileName}`);
    const uploadTask = ref.put(file);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          console.log(`Upload progress: ${progress}%`);
        },
        (error) => {
          console.error('Upload error:', error);
          if (error.code === 'storage/project-not-found') {
            reject(new Error('Firebase Storage not configured. Check your Firebase project settings.'));
          } else if (error.code === 'storage/unauthorized') {
            reject(new Error('Not authorized to upload. Check Firebase Storage rules.'));
          } else if (error.code === 'storage/retry-limit-exceeded') {
            reject(new Error('Upload failed - network issues. Please try again.'));
          } else {
            reject(new Error(`Upload failed: ${error.message || error}`));
          }
        },
        async () => {
          try {
            const url = await uploadTask.snapshot.ref.getDownloadURL();
            console.log('✓ Image upload success:', url);
            resolve(url);
          } catch (err) {
            console.error('Failed to get download URL:', err);
            reject(new Error('Upload succeeded, but failed to get download URL.'));
          }
        }
      );
    });
  }

  // ── Orders ─────────────────────────────────────────────────
  async function getOrders() { 
    try {
      const snap = await _db.ref('orders').once('value');
      const data = snap.val() || {};
      return Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a,b) => b.ts - a.ts);
    } catch (err) {
      console.error('Error fetching orders:', err.message);
      return [];
    }
  }
  
  async function addOrder(o) { 
    await _db.ref(`orders/${o.id}`).set(o); 
  }
  
  async function updateOrderStatus(id, s) { 
    await _db.ref(`orders/${id}`).update({ status: s }); 
  }

  // ── Stats ──────────────────────────────────────────────────
  async function getStats() {
    const orders = await getOrders();
    const products = await getProducts();
    const todayTs = new Date().setHours(0,0,0,0);
    const sum = arr => arr.reduce((a,o) => a + (o.total || 0), 0);
    const todayO = orders.filter(o => o.ts >= todayTs);
    
    const chart = [];
    for(let i=6; i>=0; i--) {
      const day = new Date(todayTs - i*86400000);
      const s = day.getTime(), e = s + 86400000;
      const d = orders.filter(o => o.ts >= s && o.ts < e);
      chart.push({ 
        label: day.toLocaleDateString('en-IN', {weekday:'short'}), 
        sales: d.length, 
        income: sum(d) 
      });
    }

    return {
      todaySales: todayO.length, todayIncome: sum(todayO),
      totalOrders: orders.length, totalIncome: sum(orders),
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      totalProducts: products.length,
      availableProducts: products.filter(p => p.available).length,
      chart,
      recentOrders: orders.slice(0,5),
    };
  }

  const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#1c2030"/>
      <text x="200" y="155" font-family="serif" font-size="64" text-anchor="middle" fill="rgba(74,184,193,0.3)">🐟</text>
      <text x="200" y="195" font-family="sans-serif" font-size="13" text-anchor="middle" fill="rgba(255,255,255,0.2)" letter-spacing="2">NO IMAGE</text>
    </svg>`);

  async function subscribeProducts(onChange) {
    if (_db && _db.ref) {
      const ref = _db.ref('products');
      const callback = (snap) => {
        const data = snap.val() || {};
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        onChange(list);
      };
      ref.on('value', callback);
      return () => ref.off('value', callback);
    } else {
      console.warn('subscribeProducts not supported by fallback store.');
      return () => {};
    }
  }

  return {
    isLoggedIn, logout,
    getAdmin, updateAdmin, checkLogin,
    generateOTP, verifyOTP, clearOTP,
    getWA, setWA,
    getDeliveryCharge, setDeliveryCharge,
    getProducts, getProduct, addProduct, updateProduct, deleteProduct, toggleAvailable, toggleFeatured,
    subscribeProducts,
    uploadImage,
    getOrders, addOrder, updateOrderStatus,
    getStats,
    PLACEHOLDER,
  };
})();

window.Store = Store;