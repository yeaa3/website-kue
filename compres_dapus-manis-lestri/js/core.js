/* core.js — utilitas bersama: rute, data, keranjang, header/footer, WhatsApp */
(() => {
  // Alamat halaman dikelola di satu tempat
  const ROUTES = { home: "index.html", produk: "produk.html", caraPesan: "cara-pesan.html", cabang: "cabang.html", faq: "faq.html" };
  const NAV = [["home", "Beranda"], ["produk", "Produk"], ["caraPesan", "Cara Pesan"], ["cabang", "Cabang"], ["faq", "FAQ"]];
  const PAGE_ROUTE = { home: "home", produk: "produk", "cara-pesan": "caraPesan", cabang: "cabang", faq: "faq" };

  const cache = {};
  const loadJSON = (n) => (cache[n] ||= fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error("Gagal memuat " + n); return r.json(); }));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rupiah = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

  // Keranjang (localStorage, aman jika diblokir)
  const KEY = "dml_cart";
  const getCart = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const setCart = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} updateBadge(); };
  const cartCount = () => Object.values(getCart()).reduce((a, b) => a + b, 0);
  const updateBadge = () => { const b = document.getElementById("cart-badge"); if (b) b.textContent = cartCount(); };

  const waLink = (nomor, teks) => `https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`;
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); }
    catch { const a = document.createElement("textarea"); a.value = t; document.body.append(a); a.select(); document.execCommand("copy"); a.remove(); }
    toast("Tersalin: " + t);
  }
  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t);
    setTimeout(() => t.remove(), 2200);
  }

  // Gambar gagal dimuat -> pakai emoji / gambar cadangan
  document.addEventListener("error", (e) => {
    const t = e.target;
    if (!t || t.tagName !== "IMG") return;
    if (t.dataset.fallback) { const f = t.dataset.fallback; delete t.dataset.fallback; t.src = f; return; }
    if (t.dataset.emoji) { const s = document.createElement("span"); s.className = "ph"; s.textContent = t.dataset.emoji; t.replaceWith(s); }
  }, true);

  function layout(b, page) {
    const aktif = PAGE_ROUTE[page];
    document.getElementById("site-header").innerHTML = `
      <div class="bar">
        <a class="brand" href="${ROUTES.home}">🧁 ${esc(b.nama)}</a>
        <button class="burger" aria-label="Menu" id="burger">☰</button>
        <nav id="nav"><ul>
          ${NAV.map(([k, l]) => `<li><a href="${ROUTES[k]}" class="${k === aktif ? "active" : ""}">${l}</a></li>`).join("")}
          <li><a href="${ROUTES.caraPesan}">🛒<span class="badge" id="cart-badge">${cartCount()}</span></a></li>
        </ul></nav>
      </div>`;
    document.getElementById("burger").onclick = () => document.getElementById("nav").classList.toggle("open");
    const s = b.sosmed || {};
    document.getElementById("site-footer").innerHTML = `
      <div class="foot">
        <div><h3>${esc(b.nama)}</h3><p>${esc(b.tagline)}</p></div>
        <div><h3>Jam Buka</h3><p>${esc(b.jamBuka)}</p></div>
        <div><h3>Ikuti Kami</h3><ul>
          ${Object.entries(s).map(([k, v]) => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(k[0].toUpperCase() + k.slice(1))}: ${esc(v.handle)}</a></li>`).join("")}
        </ul></div>
      </div>
      <p class="copy">© ${new Date().getFullYear()} ${esc(b.nama)}</p>`;
  }

  const App = { ROUTES, loadJSON, esc, rupiah, getCart, setCart, cartCount, updateBadge, waLink, copyText, toast, pages: {}, bisnis: null };
  window.App = App;

  document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;
    try {
      App.bisnis = await loadJSON("bisnis");
      layout(App.bisnis, page);
      await App.pages[page]?.();
    } catch (err) {
      console.error(err);
      document.getElementById("app").innerHTML = `<div class="card"><h2>Oops, data gagal dimuat</h2>
        <p>Situs ini memuat data lewat <code>fetch()</code>, jadi harus dijalankan lewat server (mis. Live Server di VS Code atau hosting), bukan dibuka langsung dari file.</p></div>`;
    }
  });
})();
