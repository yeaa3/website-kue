/* checkout.js — Cara Pesan: lokasi, ongkir, DP/Lunas, QRIS/Transfer/Cash, pesan WhatsApp */
(() => {
  const { loadJSON, esc, rupiah, getCart, setCart, copyText, waLink, toast, ROUTES } = App;

  /* ================= PENGATURAN (ubah di sini) ================= */
  const PENGATURAN = {
    radiusMaksKm: 15,     // di atas ini: ongkir "Konfirmasi Admin"
    jarakDasarKm: 3,      // 0–3 km = tarif dasar
    tarifDasar: 10000,    // Rp tarif dasar (SESUAIKAN)
    tarifPerKm: 3000,     // + Rp per km berikutnya (dibulatkan ke atas)
    zonaManual: []        // opsional, mis. [{ kata: "kanigoro", tarif: 8000 }] -> tarif tetap bila alamat memuat kata itu
  };

  /* ================= FUNGSI HITUNG ================= */
  const rad = (x) => (x * Math.PI) / 180;
  function haversine(lat1, lng1, lat2, lng2) { // jarak garis lurus (km)
    const R = 6371, dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function hitungOngkir(km, alamat) {
    const P = PENGATURAN;
    if (km > P.radiusMaksKm) return null; // konfirmasi admin
    const z = P.zonaManual.find((z) => (alamat || "").toLowerCase().includes(z.kata.toLowerCase()));
    if (z) return z.tarif;
    return km <= P.jarakDasarKm ? P.tarifDasar : P.tarifDasar + Math.ceil(km - P.jarakDasarKm) * P.tarifPerKm;
  }
  const kmTeks = (km) => km.toFixed(1).replace(".", ",") + " km";

  // Gambar QRIS contoh (dipakai sampai assets/qris.png tersedia)
  const QRIS_CONTOH = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260"><rect width="260" height="260" fill="#fff" stroke="#999" stroke-width="3"/><g fill="#555"><rect x="25" y="25" width="60" height="60"/><rect x="175" y="25" width="60" height="60"/><rect x="25" y="175" width="60" height="60"/><rect x="110" y="110" width="40" height="40"/><rect x="175" y="175" width="25" height="25"/></g><text x="130" y="135" font-size="15" font-weight="700" text-anchor="middle" fill="#c00" transform="rotate(-20 130 130)">BUKAN QRIS ASLI</text></svg>`);

  /* ================= GENERATOR PESAN WHATSAPP ================= */
  function buatPesanPesanan(d) {
    const L = [];
    L.push("*PESANAN BARU — Dapur Manis Lestari*", "");
    L.push(`Nama: ${d.nama}`, `No. WA: ${d.hp}`, `Tanggal ${d.antar ? "kirim" : "ambil"}: ${d.tanggal}`, "", "*Pesanan:*");
    d.items.forEach((i, n) => L.push(`${n + 1}. ${i.nama} x${i.qty} — ${rupiah(i.harga * i.qty)}`));
    L.push("", `Subtotal: ${rupiah(d.sub)}`);
    if (d.antar) {
      L.push(`Metode: Diantar (dari ${d.cabang.nama})`, `Alamat: ${d.alamat}`,
        `Titik lokasi: https://www.google.com/maps?q=${d.lat},${d.lng}`,
        `Jarak (garis lurus): ${kmTeks(d.jarak)}`, `Ongkir: ${rupiah(d.ongkir)}`);
    } else L.push(`Metode: Ambil di Toko (${d.cabang.nama})`);
    L.push("", `*TOTAL: ${rupiah(d.total)}*`);
    const ket = { qris: "QRIS", transfer: "Transfer", cash: "Cash" }[d.bayar];
    L.push(`Pembayaran: ${ket} — ${d.skema === "dp" ? `DP ${d.dpPersen}%` : "Lunas 100%"}`,
      `Dibayar sekarang: ${rupiah(d.bayarSekarang)}`);
    if (d.skema === "dp") L.push(`Sisa pelunasan: ${rupiah(d.total - d.bayarSekarang)} (${d.pelunasan})`);
    if (d.catatan) L.push("", `Catatan: ${d.catatan}`);
    L.push("", "Mohon konfirmasi pesanan saya. Terima kasih 🙏");
    return L.join("\n");
  }
  function buatPesanTanyaOngkir(d) {
    return ["*TANYA ONGKIR LUAR RADIUS — Dapur Manis Lestari*", "",
      `Nama: ${d.nama}`, `No. WA: ${d.hp}`, `Tanggal kirim: ${d.tanggal}`, "", "*Pesanan:*",
      ...d.items.map((i, n) => `${n + 1}. ${i.nama} x${i.qty}`), `Subtotal: ${rupiah(d.sub)}`, "",
      `Cabang terdekat: ${d.cabang.nama}`, `Alamat: ${d.alamat || "-"}`,
      `Titik lokasi: https://www.google.com/maps?q=${d.lat},${d.lng}`,
      `Jarak (garis lurus): ${kmTeks(d.jarak)} (di luar radius ${PENGATURAN.radiusMaksKm} km)`,
      d.catatan ? `Catatan: ${d.catatan}` : "", "", "Mohon info ongkir ke lokasi saya. Terima kasih 🙏"].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  }

  /* ================= HALAMAN ================= */
  App.pages["cara-pesan"] = async () => {
    const [{ produk }, cabang] = await Promise.all([loadJSON("produk"), loadJSON("cabang")]);
    const B = App.bisnis, PAY = B.pembayaran, dpPersen = PAY.dpPersen;
    const byId = Object.fromEntries(produk.map((p) => [p.id, p]));
    const s = { metode: "antar", cabangId: cabang[0].id, lat: null, lng: null, bayar: "qris", skema: "dp" };
    const app = document.getElementById("app");
    const $ = (sel) => app.querySelector(sel);
    const hariIni = new Date().toISOString().slice(0, 10);

    app.innerHTML = `
      <h1>Cara Pesan</h1>
      <ol class="steps">
        <li><b>Pilih kue</b><br>Tambahkan produk dari katalog ke pesanan.</li>
        <li><b>Isi data & lokasi</b><br>Ongkir dihitung otomatis dari jarak.</li>
        <li><b>Pilih pembayaran</b><br>DP ${dpPersen}% atau Lunas via QRIS/Transfer.</li>
        <li><b>Konfirmasi WhatsApp</b><br>Pesan dibuat otomatis, tinggal kirim.</li>
      </ol>
      <div class="co" style="margin-top:28px">
        <form id="f" novalidate>
          <section class="card"><h3>1. Pesanan Anda</h3><div id="cart"></div></section>
          <section class="card"><h3>2. Data Pemesan</h3>
            <div class="row">
              <div class="field"><label for="nama">Nama</label><input id="nama" required autocomplete="name"></div>
              <div class="field"><label for="hp">No. WhatsApp</label><input id="hp" type="tel" required autocomplete="tel" placeholder="08xxxxxxxxxx"></div>
              <div class="field"><label for="tgl">Tanggal ambil/kirim</label><input id="tgl" type="date" min="${hariIni}" required></div>
            </div>
            <div class="field"><label for="cat">Catatan (opsional)</label><textarea id="cat" rows="2" placeholder="Tulisan di kue, tema, dll."></textarea></div>
          </section>
          <section class="card"><h3>3. Pengambilan / Pengiriman</h3>
            <div class="opts" id="metode">
              <label class="opt"><input type="radio" name="metode" value="antar" checked> 🛵 Diantar</label>
              <label class="opt"><input type="radio" name="metode" value="ambil"> 🏪 Ambil di Toko</label>
            </div>
            <div class="field" style="margin-top:14px"><label for="cabang">Cabang</label>
              <select id="cabang">${cabang.map((c) => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join("")}</select></div>
            <div id="antar">
              <button type="button" class="btn small" id="gps">📍 Gunakan Lokasi Saya (GPS)</button>
              <div class="field" style="margin-top:12px"><label for="koor">Atau tempel koordinat (lat, lng)</label>
                <input id="koor" placeholder="-7.6298, 111.5239" inputmode="decimal"></div>
              <div class="field"><label for="alamat">Alamat lengkap</label><textarea id="alamat" rows="2" placeholder="Terisi otomatis dari GPS, boleh diedit"></textarea></div>
              <div id="lokInfo" class="info"></div>
            </div>
          </section>
          <section class="card"><h3>4. Pembayaran</h3>
            <label>Metode</label>
            <div class="opts" id="bayar">
              <label class="opt" data-b="qris"><input type="radio" name="bayar" value="qris" checked> QRIS</label>
              <label class="opt" data-b="transfer"><input type="radio" name="bayar" value="transfer"> Transfer / E-wallet</label>
              <label class="opt" data-b="cash"><input type="radio" name="bayar" value="cash"> Cash (Ambil di Toko)</label>
            </div>
            <label style="margin-top:14px">Skema</label>
            <div class="opts" id="skema">
              <label class="opt" data-s="dp"><input type="radio" name="skema" value="dp" checked> DP ${dpPersen}%</label>
              <label class="opt" data-s="lunas"><input type="radio" name="skema" value="lunas"> Lunas 100%</label>
            </div>
            <p class="muted" style="margin-top:8px">${esc(PAY.pelunasan)}</p>
            <div id="payPanel"></div>
          </section>
        </form>
        <aside class="card sum"><h3>Ringkasan</h3><div id="sum"></div>
          <button class="btn block" id="kirim" form="f" type="submit" style="margin-top:14px">Konfirmasi Pesanan via WhatsApp</button></aside>
      </div>`;

    /* ---- data turunan ---- */
    const items = () => Object.entries(getCart()).filter(([id, q]) => byId[id] && q > 0).map(([id, q]) => ({ ...byId[id], qty: q }));
    const cab = () => cabang.find((c) => c.id === s.cabangId);
    function hitung() {
      const its = items(), sub = its.reduce((a, i) => a + i.harga * i.qty, 0), antar = s.metode === "antar";
      const jarak = antar && s.lat != null ? haversine(cab().lat, cab().lng, s.lat, s.lng) : null;
      const luar = jarak != null && jarak > PENGATURAN.radiusMaksKm;
      const butuhLokasi = antar && jarak == null;
      const ongkir = !antar ? 0 : jarak == null || luar ? null : hitungOngkir(jarak, $("#alamat").value);
      const total = ongkir == null ? null : sub + ongkir;
      if (antar && s.bayar === "cash") s.bayar = "qris";           // Cash hanya Ambil di Toko
      if (s.bayar === "cash") s.skema = "lunas";                   // Cash otomatis Lunas 100%
      const bayarSekarang = total == null ? null : s.skema === "dp" ? Math.ceil((total * dpPersen) / 100) : total;
      return { its, sub, antar, jarak, luar, butuhLokasi, ongkir, total, bayarSekarang };
    }

    /* ---- render ---- */
    function renderCart() {
      const its = items();
      $("#cart").innerHTML = its.length ? its.map((i) => `<div class="cartrow"><div><b>${esc(i.nama)}</b><br><small>${rupiah(i.harga)}</small></div>
        <div class="qty"><button type="button" data-q="-1" data-id="${esc(i.id)}">−</button><b>${i.qty}</b><button type="button" data-q="1" data-id="${esc(i.id)}">+</button></div></div>`).join("")
        + `<p style="margin-top:12px"><a class="btn small ghost" href="${ROUTES.produk}">+ Tambah produk lain</a></p>`
        : `<p>Pesanan masih kosong.</p><a class="btn small" href="${ROUTES.produk}">Pilih Produk</a>`;
    }
    function recompute() {
      const h = hitung();
      // metode & status opsi
      $("#antar").classList.toggle("hidden", !h.antar);
      const kunciBayar = h.luar || h.butuhLokasi;
      app.querySelectorAll("#bayar .opt").forEach((o) => {
        const b = o.dataset.b, off = (b === "cash" && h.antar) || (b !== "cash" && h.luar);
        o.classList.toggle("off", off); o.querySelector("input").disabled = off; o.querySelector("input").checked = s.bayar === b;
      });
      app.querySelectorAll("#skema .opt").forEach((o) => {
        const off = s.bayar === "cash" || h.luar;
        o.classList.toggle("off", off); o.querySelector("input").disabled = off; o.querySelector("input").checked = s.skema === o.dataset.s;
      });
      // info lokasi
      $("#lokInfo").innerHTML = !h.antar ? "" : h.jarak == null
        ? "Tentukan lokasi (GPS atau koordinat) untuk menghitung jarak & ongkir."
        : `Jarak garis lurus dari <b>${esc(cab().nama)}</b>: <b>${kmTeks(h.jarak)}</b><br>` +
          (h.luar ? `<b>Di luar radius ${PENGATURAN.radiusMaksKm} km</b> — ongkir dikonfirmasi admin.`
            : `Ongkir: <b>${rupiah(h.ongkir)}</b> <small>(tarif dasar ${rupiah(PENGATURAN.tarifDasar)} s.d. ${PENGATURAN.jarakDasarKm} km, lalu +${rupiah(PENGATURAN.tarifPerKm)}/km)</small>`) +
          `<br><small>Jarak jalan sebenarnya biasanya sedikit lebih jauh.</small>`;
      // ringkasan
      $("#sum").innerHTML = `
        ${h.its.map((i) => `<div class="line"><span>${esc(i.nama)} ×${i.qty}</span><span>${rupiah(i.harga * i.qty)}</span></div>`).join("") || '<p class="muted">Belum ada produk.</p>'}
        <div class="line"><span>Subtotal</span><span>${rupiah(h.sub)}</span></div>
        <div class="line"><span>Ongkir</span><span>${!h.antar ? "Gratis (ambil)" : h.luar ? "Konfirmasi Admin" : h.ongkir == null ? "Belum dihitung" : rupiah(h.ongkir)}</span></div>
        <div class="line total"><span>Total</span><span>${h.total == null ? "—" : rupiah(h.total)}</span></div>
        ${h.total != null ? `<div class="line"><span>Bayar sekarang (${s.skema === "dp" ? "DP " + dpPersen + "%" : "Lunas"})</span><b>${rupiah(h.bayarSekarang)}</b></div>
        ${s.skema === "dp" ? `<div class="line"><span>Sisa pelunasan</span><span>${rupiah(h.total - h.bayarSekarang)}</span></div>` : ""}` : ""}`;
      const btn = $("#kirim");
      btn.textContent = h.luar ? "Tanya Ongkir Luar Radius ke Admin" : "Konfirmasi Pesanan via WhatsApp";
      btn.disabled = !h.its.length || h.butuhLokasi;
      // panel pembayaran
      let p = "";
      if (h.luar) p = `<div class="warn"><b>Lokasi di luar radius ${PENGATURAN.radiusMaksKm} km.</b> Pembayaran QRIS/Transfer dikunci. Tanyakan ongkir ke admin lewat tombol di ringkasan.</div>`;
      else if (h.butuhLokasi) p = `<div class="info">Tentukan lokasi pengiriman agar total & nominal pembayaran dapat dihitung.</div>`;
      else if (s.bayar === "cash") p = `<div class="info">Bayar tunai saat ambil di toko. Pembayaran otomatis <b>Lunas 100%</b>: <b>${rupiah(h.bayarSekarang)}</b>.</div>`;
      else if (h.total != null) {
        const nom = `<div class="nominal">${rupiah(h.bayarSekarang)}</div><p class="center"><button type="button" class="btn small" data-copy="${h.bayarSekarang}">Salin Nominal</button></p>`;
        p = s.bayar === "qris"
          ? `<div class="qris"><p><b>Scan QRIS</b> a.n. ${esc(PAY.qris.atasNama || B.nama)}</p>
              <img src="${esc(PAY.qris.gambar)}" data-fallback='${QRIS_CONTOH}' alt="QRIS ${esc(B.nama)}">
              <p>Masukkan nominal sendiri (QRIS statis):</p>${nom}</div>`
          : `<div class="info"><b>Transfer Bank</b>${(PAY.rekening || []).map((r) => `<div class="line"><span>${esc(r.bank)} ${esc(r.noRek)} <small>a.n. ${esc(r.atasNama)}</small></span><button type="button" class="btn small ghost" data-copy="${esc(r.noRek)}">Salin</button></div>`).join("")}
              <b>E-wallet</b>${(PAY.ewallet || []).map((r) => `<div class="line"><span>${esc(r.nama)} ${esc(r.nomor)} <small>a.n. ${esc(r.atasNama)}</small></span><button type="button" class="btn small ghost" data-copy="${esc(r.nomor)}">Salin</button></div>`).join("")}${nom}</div>`;
      }
      $("#payPanel").innerHTML = p;
      return h;
    }

    /* ---- lokasi ---- */
    function setLokasi(lat, lng, reverse) {
      s.lat = lat; s.lng = lng;
      $("#koor").value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      recompute();
      if (reverse) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=id&lat=${lat}&lon=${lng}`)
          .then((r) => r.json()).then((j) => { if (j.display_name) { $("#alamat").value = j.display_name; recompute(); } })
          .catch(() => toast("Alamat otomatis gagal, isi manual ya"));
      }
    }
    $("#gps").onclick = () => {
      if (!navigator.geolocation) return toast("Browser tidak mendukung GPS");
      toast("Mencari lokasi…");
      navigator.geolocation.getCurrentPosition(
        (pos) => setLokasi(pos.coords.latitude, pos.coords.longitude, true),
        () => toast("GPS gagal. GPS butuh HTTPS/localhost & izin lokasi. Coba tempel koordinat."),
        { enableHighAccuracy: true, timeout: 15000 });
    };
    $("#koor").addEventListener("change", (e) => {
      const m = e.target.value.match(/(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/);
      if (m) setLokasi(parseFloat(m[1]), parseFloat(m[2]), false); else toast("Format: -7.6298, 111.5239");
    });
    $("#alamat").addEventListener("input", recompute);

    /* ---- event umum ---- */
    app.addEventListener("click", (e) => {
      const q = e.target.closest("[data-q]");
      if (q) { const c = getCart(), id = q.dataset.id; c[id] = (c[id] || 0) + Number(q.dataset.q); if (c[id] <= 0) delete c[id]; setCart(c); renderCart(); recompute(); }
      const cp = e.target.closest("[data-copy]"); if (cp) copyText(cp.dataset.copy);
    });
    app.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "metode") s.metode = t.value;
      if (t.name === "bayar") s.bayar = t.value;
      if (t.name === "skema") s.skema = t.value;
      if (t.id === "cabang") s.cabangId = t.value;
      recompute();
    });

    /* ---- kirim ke WhatsApp ---- */
    $("#f").addEventListener("submit", (e) => {
      e.preventDefault();
      const h = hitung();
      const nama = $("#nama").value.trim(), hp = $("#hp").value.trim(), tgl = $("#tgl").value, alamat = $("#alamat").value.trim();
      if (!h.its.length) return toast("Pilih produk dulu");
      if (!nama || !hp || !tgl) return toast("Lengkapi nama, no. WhatsApp, dan tanggal");
      if (h.antar && h.jarak == null) return toast("Tentukan lokasi pengiriman dulu");
      if (h.antar && !alamat) return toast("Isi alamat lengkap");
      const d = {
        nama, hp, alamat, catatan: $("#cat").value.trim(), items: h.its, sub: h.sub, antar: h.antar, cabang: cab(),
        tanggal: new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        lat: s.lat, lng: s.lng, jarak: h.jarak, ongkir: h.ongkir, total: h.total, bayar: s.bayar, skema: s.skema,
        dpPersen, pelunasan: PAY.pelunasan, bayarSekarang: h.bayarSekarang
      };
      const teks = h.luar ? buatPesanTanyaOngkir(d) : buatPesanPesanan(d);
      window.open(waLink(B.whatsapp, teks), "_blank", "noopener");
    });

    renderCart(); recompute();
  };
})();
