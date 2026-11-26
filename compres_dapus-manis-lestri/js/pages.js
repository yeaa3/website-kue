/* pages.js — Beranda, Produk, FAQ, Cabang */
(() => {
  const { ROUTES, loadJSON, esc, rupiah, getCart, setCart, toast, waLink } = App;

  // Foto hero HD (≥1920px): isi dengan path lokal (mis. "assets/hero1.jpg") atau URL penuh. Kosong = latar burgundy polos.
  const HERO_FOTO = [];

  function kartuProduk(p, kategori) {
    const kat = kategori.find((k) => k.id === p.kategori);
    const gambar = p.gambar
      ? `<img src="${esc(p.gambar)}" alt="${esc(p.nama)}" loading="lazy" data-emoji="${esc(p.emoji || "🍰")}">`
      : `<span class="ph">${esc(p.emoji || "🍰")}</span>`;
    return `<article class="card pcard">
      <div class="pimg">${gambar}</div>
      <div class="pbody">
        ${kat ? `<span class="tag">${esc(kat.nama)}</span>` : ""}
        <h3>${esc(p.nama)}</h3><p>${esc(p.deskripsi)}</p>
        <div class="price">${rupiah(p.harga)}</div>
        <button class="btn small" data-add="${esc(p.id)}">+ Tambah ke Pesanan</button>
      </div></article>`;
  }
  function pasangTombolTambah(root) {
    root.addEventListener("click", (e) => {
      const id = e.target.closest("[data-add]")?.dataset.add;
      if (!id) return;
      const c = getCart(); c[id] = (c[id] || 0) + 1; setCart(c); toast("Ditambahkan ke pesanan 🛒");
    });
  }

  // ---------- BERANDA ----------
  App.pages.home = async () => {
    const [{ kategori, produk }, testimoni] = await Promise.all([loadJSON("produk"), loadJSON("testimoni")]);
    const b = App.bisnis;
    const teks = [
      ["Kue Manis untuk Momen Spesialmu", b.tagline],
      ["Dessert Table Cantik & Lezat", "Cocok untuk ulang tahun, arisan, dan hajatan."],
      ["Pesan Mudah, Ongkir Langsung Ketahuan", "Hitung jarak & ongkir otomatis, bayar DP atau lunas lewat QRIS."]
    ];
    const unggulan = produk.filter((p) => p.unggulan).slice(0, 4);
    document.getElementById("app").innerHTML = `
      <section class="hero" id="hero">
        ${teks.map(([h, s], i) => `<div class="slide ${i ? "" : "on"}" ${HERO_FOTO[i] ? `style="background-image:url('${esc(HERO_FOTO[i])}')"` : ""}>
          <h1>${esc(h)}</h1><p>${esc(s)}</p>
          <div><a class="btn" href="${ROUTES.produk}">Lihat Produk</a> <a class="btn ghost" style="color:var(--color-on-dark)!important;border-color:var(--color-on-dark)" href="${ROUTES.caraPesan}">Cara Pesan</a></div></div>`).join("")}
        <div class="dots">${teks.map((_, i) => `<button class="${i ? "" : "on"}" aria-label="Slide ${i + 1}"></button>`).join("")}</div>
      </section>
      <section class="section"><h2>Produk Unggulan</h2><div class="grid" id="unggulan">${unggulan.map((p) => kartuProduk(p, kategori)).join("")}</div>
        <p class="center" style="margin-top:20px"><a class="btn" href="${ROUTES.produk}">Semua Produk</a></p></section>
      <section class="section"><h2>Kategori</h2><div class="chips">${kategori.map((k) => `<a class="chip" style="text-decoration:none" href="${ROUTES.produk}?kategori=${encodeURIComponent(k.id)}">${esc(k.nama)}</a>`).join("")}</div></section>
      <section class="section"><h2>Kata Mereka</h2><div class="grid wide">${testimoni.map((t) => `<div class="card"><div class="stars">${"★".repeat(t.bintang)}</div><p>“${esc(t.teks)}”</p><strong>— ${esc(t.nama)}</strong></div>`).join("")}</div></section>
      <section class="section card center"><h2>Siap Memesan?</h2><p>Pilih kue, hitung ongkir, lalu konfirmasi lewat WhatsApp.</p><a class="btn" href="${ROUTES.caraPesan}">Mulai Pesan</a></section>`;
    pasangTombolTambah(document.getElementById("app"));
    // slider
    const slides = [...document.querySelectorAll(".slide")], dots = [...document.querySelectorAll(".dots button")];
    let i = 0, timer;
    const go = (n) => { i = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle("on", k === i)); dots.forEach((d, k) => d.classList.toggle("on", k === i)); };
    const start = () => { clearInterval(timer); timer = setInterval(() => go(i + 1), 5000); };
    dots.forEach((d, k) => d.addEventListener("click", () => { go(k); start(); }));
    start();
  };

  // ---------- PRODUK (?q= & ?kategori=) ----------
  App.pages.produk = async () => {
    const { kategori, produk } = await loadJSON("produk");
    const url = new URL(location.href);
    let q = url.searchParams.get("q") || "", kat = url.searchParams.get("kategori") || "";
    const app = document.getElementById("app");
    app.innerHTML = `<h1>Katalog Produk</h1>
      <div class="toolbar"><input type="search" id="q" placeholder="Cari kue…" value="${esc(q)}" aria-label="Cari produk">
        <div class="chips" id="chips"></div></div>
      <div class="grid" id="list"></div><p class="center muted hidden" id="kosong">Produk tidak ditemukan.</p>`;
    const render = () => {
      document.getElementById("chips").innerHTML = [{ id: "", nama: "Semua" }, ...kategori].map((k) => `<button class="chip ${k.id === kat ? "on" : ""}" data-k="${esc(k.id)}">${esc(k.nama)}</button>`).join("");
      const hasil = produk.filter((p) => (!kat || p.kategori === kat) && (p.nama + " " + p.deskripsi).toLowerCase().includes(q.trim().toLowerCase()));
      document.getElementById("list").innerHTML = hasil.map((p) => kartuProduk(p, kategori)).join("");
      document.getElementById("kosong").classList.toggle("hidden", hasil.length > 0);
      const u = new URL(location.href); q ? u.searchParams.set("q", q) : u.searchParams.delete("q"); kat ? u.searchParams.set("kategori", kat) : u.searchParams.delete("kategori");
      history.replaceState(null, "", u);
    };
    document.getElementById("q").addEventListener("input", (e) => { q = e.target.value; render(); });
    app.addEventListener("click", (e) => { const k = e.target.closest("[data-k]"); if (k) { kat = k.dataset.k; render(); } });
    pasangTombolTambah(app);
    render();
  };

  // ---------- FAQ ----------
  App.pages.faq = async () => {
    const faq = await loadJSON("faq");
    document.getElementById("app").innerHTML = `<h1>Pertanyaan Umum (FAQ)</h1>
      ${faq.map((f) => `<details><summary>${esc(f.tanya)}</summary><p>${esc(f.jawab)}</p></details>`).join("")}
      <p class="center" style="margin-top:24px">Belum terjawab? <a class="btn small" target="_blank" rel="noopener" href="${waLink(App.bisnis.whatsapp, "Halo Admin, saya ingin bertanya…")}">Tanya Admin</a></p>`;
  };

  // ---------- CABANG ----------
  App.pages.cabang = async () => {
    const cabang = await loadJSON("cabang");
    document.getElementById("app").innerHTML = `<h1>Cabang Kami</h1><div class="grid wide">
      ${cabang.map((c) => {
        const d = 0.01, bbox = [c.lng - d, c.lat - d, c.lng + d, c.lat + d].join("%2C");
        return `<article class="card"><h3>${esc(c.nama)}</h3><p>📍 ${esc(c.alamat)}</p><p>🕒 ${esc(c.jam)}</p>
          <a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${c.lat},${c.lng}">Buka di Google Maps</a>
          <a class="btn small ghost" target="_blank" rel="noopener" href="${waLink(c.telepon || App.bisnis.whatsapp, "Halo " + c.nama + ", saya ingin bertanya…")}">WhatsApp</a>
          <iframe class="map" loading="lazy" title="Peta ${esc(c.nama)}" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${c.lat}%2C${c.lng}"></iframe></article>`;
      }).join("")}</div>`;
  };
})();
