// Halaman: Beranda (dashboard) dan Data Santri
import { html, raw, mount, $, $$, on, esc, rp, num, rpShort, slot, namaBulan, periodeOf, addMonths, BULAN, tgl, ago, inisial, debounce, sheet, konfirmasi, toast, tombolKerja, stagger, barChart, lineChart, iconKosong, ymd } from './ui.js';

const STATUS = ['aktif', 'baru', 'pindahan', 'lulus', 'nonaktif'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const badgeStatus = (s) => ({ aktif: 'ok', baru: 'blue', pindahan: 'warn', lulus: 'gray', nonaktif: 'bad' }[s] || 'gray');
const SEARCH_SVG = raw('<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>');

/* ========================= BERANDA ========================= */
export async function beranda(root, ctx) {
  const { db } = ctx;
  let periode = periodeOf();
  let R = null, tahunan = null, tab = 'pemasukan';
  const tiles = (arr) => arr.map(([k, l]) => html`<div class="tile"><small>${l}</small><b data-k="${k}">0</b></div>`);
  mount(root, html`
    <div class="row rise" style="margin-bottom:6px">
      <button class="btn sm" data-p="-1" aria-label="Bulan sebelumnya">‹</button>
      <div class="sp" style="text-align:center"><b id="pl" style="font-size:17px"></b><div class="muted" style="font-size:12px" id="hari"></div></div>
      <button class="btn sm" data-p="1" aria-label="Bulan berikutnya">›</button>
    </div>
    <div class="sec-t">Ringkasan siswa</div>
    <div class="grid g3 rise">${tiles([['total', 'Total siswa'], ['aktif', 'Siswa aktif'], ['baru', 'Siswa baru'], ['pindahan', 'Pindahan'], ['lulus', 'Lulus'], ['nonaktif', 'Nonaktif']])}</div>
    <div class="sec-t">Ringkasan keuangan</div>
    <div class="tile hl rise" style="padding:16px;margin-bottom:12px">
      <small>Total pembayaran bulan ini</small>
      <b style="font-size:30px" data-k="bayar_bulan_ini">0</b>
      <div class="pbar" style="margin-top:12px;background:rgba(255,255,255,.25);box-shadow:none"><i id="prog" style="background:#fff;box-shadow:0 0 12px #fff;width:0"></i></div>
      <small id="progt" style="margin-top:8px"></small>
    </div>
    <div class="grid g2 rise" style="margin-bottom:12px">
      <div class="tile"><small>Total tagihan bulan ini</small><b class="" style="font-size:18px" data-k="tagihan_bulan_ini">0</b></div>
      <div class="tile"><small>Pembayaran hari ini</small><b style="font-size:18px" data-k="bayar_hari_ini">0</b></div>
    </div>
    <div class="tile rise" style="margin-bottom:12px"><small>Total tunggakan</small><b style="font-size:24px;color:var(--red)" data-k="total_tunggakan">0</b></div>
    <div class="grid g3 rise">
      <div class="tile"><small>Sudah bayar</small><b style="color:var(--green)" data-k="sudah_bayar">0</b></div>
      <div class="tile"><small>Belum bayar</small><b style="color:var(--red)" data-k="belum_bayar">0</b></div>
      <div class="tile"><small>Bayar sebagian</small><b style="color:#B38A00" data-k="sebagian">0</b></div>
    </div>
    <div class="sec-t">Grafik keuangan</div>
    <div class="card rise chart">
      <div class="chips" id="tabs">
        <button class="chip on" data-t="pemasukan">Pemasukan</button><button class="chip" data-t="kelas">Per kelas</button><button class="chip" data-t="tunggakan">Tunggakan</button><button class="chip" data-t="banding">Bandingkan</button><button class="chip" data-t="tahunan">Tahunan</button>
      </div>
      <div id="cv" style="min-height:190px"></div>
      <div class="chart-tip" id="tip">Ketuk batang untuk melihat nilainya</div>
    </div>
    <div class="sec-t">Aktivitas terbaru</div>
    <div class="feed" id="feed"><div class="empty">Memuat…</div></div>`);
  stagger(root);

  const setStats = () => {
    if (!R) return;
    const f = R.keuangan, s = R.siswa;
    $$('[data-k]', root).forEach((el) => {
      const k = el.dataset.k;
      const v = k in s ? s[k] : f[k];
      const money = ['bayar_bulan_ini', 'tagihan_bulan_ini', 'bayar_hari_ini', 'total_tunggakan'].includes(k);
      slot(el, v, { prefix: money ? 'Rp' : '' });
    });
    const p = f.tagihan_bulan_ini > 0 ? Math.min(100, (f.bayar_bulan_ini / f.tagihan_bulan_ini) * 100) : 0;
    $('#prog', root).style.width = p + '%';
    $('#prog', root).style.animation = 'none'; $('#prog', root).offsetWidth; $('#prog', root).style.animation = '';
    $('#progt', root).textContent = f.tagihan_bulan_ini > 0 ? `${Math.round(p)}% dari tagihan ${rp(f.tagihan_bulan_ini)}` : 'Belum ada tagihan bulan ini';
    $('#pl', root).textContent = namaBulan(periode);
    $('#hari', root).textContent = 'Hari ini: ' + tgl(new Date());
  };

  const drawChart = () => {
    const cv = $('#cv', root);
    if (!R) return;
    const g = R.grafik_bulanan || [];
    const lab = (b) => BULAN[Number(b.split('-')[1]) - 1].slice(0, 3);
    const full = (b) => namaBulan(b + '-01');
    $('#tip', root).textContent = 'Ketuk batang untuk melihat nilainya';
    if (tab === 'pemasukan') mount(cv, barChart(g.map((x) => ({ l: lab(x.bulan), v: x.pemasukan, t: full(x.bulan) }))));
    else if (tab === 'tunggakan') mount(cv, barChart(g.map((x) => ({ l: lab(x.bulan), v: x.tunggakan, t: full(x.bulan) })), { grad: 'gbar2' }));
    else if (tab === 'tahunan') {
      if (!tahunan) { mount(cv, html`<div class="empty">Memuat…</div>`); return; }
      const keys = Object.keys(tahunan).sort();
      if (!keys.length) { mount(cv, html`<div class="empty">Belum ada pembayaran</div>`); return; }
      mount(cv, barChart(keys.map((y) => ({ l: y, v: tahunan[y], t: 'Tahun ' + y }))));
    } else if (tab === 'kelas') {
      const pk = R.per_kelas || [];
      if (!pk.length) { mount(cv, html`<div class="empty">Belum ada tagihan bulan ini</div>`); return; }
      mount(cv, html`<div style="padding-top:6px">${pk.map((k, i) => {
        const p = k.tagihan > 0 ? (k.terbayar / k.tagihan) * 100 : 0;
        return html`<div class="hbar"><div class="t"><span>${k.kelas}</span><span class="num">${rp(k.terbayar)} / ${rp(k.tagihan)}</span></div><div class="pbar"><i style="width:${p}%;animation-delay:${i * 90}ms"></i></div></div>`;
      })}</div>`);
    } else if (tab === 'banding') {
      const n = g.length, cur = n ? g[n - 1].pemasukan : 0, prev = n > 1 ? g[n - 2].pemasukan : 0;
      const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
      const d = pct === null ? '' : html`<div class="delta ${pct >= 0 ? 'up' : 'dn'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% dibanding bulan lalu</div>`;
      mount(cv, html`<div style="text-align:center">${d}</div>${lineChart(g.map((x) => lab(x.bulan)), [{ v: g.map((x) => x.pemasukan), c: 'var(--green)' }, { v: g.map((x) => x.tagihan), c: '#E0A800' }])}<div class="legend"><span><i style="background:var(--green)"></i>Pemasukan</span><span><i style="background:#E0A800"></i>Tagihan</span></div>`);
    }
  };

  async function loadAll() {
    try {
      const [r, akt, tg] = await Promise.all([db.ringkasan(periode), db.listAktivitas(14), db.listTagihan(periodeOf())]);
      R = r; setStats(); drawChart();
      const belum = periode === periodeOf() ? tg.filter((x) => x.status === 'belum' && ['aktif', 'baru', 'pindahan'].includes(x.status_santri)).slice(0, 3) : [];
      const bub = [
        ...belum.map((x) => ({ k: 'n', t: `${x.nama} belum membayar SPP ${namaBulan(x.periode)}`, w: 'Tunggakan' })),
        ...akt.map((a) => ({ k: ['bayar', 'lunas'].includes(a.jenis) ? 'b' : ['batal', 'tagihan'].includes(a.jenis) ? 'n' : 'a', t: a.pesan, w: ago(a.waktu) })),
      ];
      mount($('#feed', root), bub.length ? html`${bub.map((b, i) => html`<div class="bub ${b.k}" style="--i:${i}">${b.t}<small>${b.w}</small></div>`)}` : html`<div class="empty">${iconKosong}<div>Belum ada aktivitas</div></div>`);
    } catch (e) { toast(e.message, 'err'); }
  }
  async function loadTahunan() {
    try {
      const rows = await db.bayarSemua(); const t = {};
      rows.forEach((r) => { const y = new Date(r.tanggal).getFullYear(); t[y] = (t[y] || 0) + r.total; });
      tahunan = t; if (tab === 'tahunan') drawChart();
    } catch { /* abaikan */ }
  }

  on(root, 'click', '[data-p]', (e, b) => { periode = addMonths(periode, Number(b.dataset.p)); loadAll(); });
  on(root, 'click', '[data-t]', (e, b) => { tab = b.dataset.t; $$('#tabs .chip', root).forEach((c) => c.classList.toggle('on', c === b)); drawChart(); });
  on(root, 'click', '.bar', (e, b) => { $$('.bar', root).forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); $('#tip', root).textContent = b.dataset.tip; });
  loadAll(); loadTahunan();
  const refresh = debounce(() => { loadAll(); loadTahunan(); }, 600);
  const unsub = db.subscribe(refresh);
  return () => { try { unsub(); } catch { /* */ } };
}

/* ========================= SANTRI ========================= */
function opsiKelas(kelas, pilih) {
  return html`<option value="">— Tanpa kelas —</option>${kelas.map((k) => html`<option value="${k.id}" ${String(pilih) === String(k.id) ? raw('selected') : ''}>${k.nama}</option>`)}`;
}
const opsiStatus = (pilih) => STATUS.map((s) => html`<option value="${s}" ${pilih === s ? raw('selected') : ''}>${cap(s)}</option>`);

export async function santri(root, ctx) {
  const { db, admin } = ctx;
  let all = [], fs = 'semua', fk = '', q = '';
  mount(root, html`
    <div class="search rise">${SEARCH_SVG}<input class="in" id="q" placeholder="Cari nama, NIS, atau wali…" autocomplete="off"></div>
    <div class="chips rise" id="fs"><button class="chip on" data-s="semua">Semua</button>${STATUS.map((s) => html`<button class="chip" data-s="${s}">${cap(s)}</button>`)}</div>
    <div class="row rise" style="margin-bottom:14px"><select class="in sp" id="fk"></select><span class="badge ok" id="cnt" style="padding:10px 14px"></span></div>
    ${admin ? html`<div class="row rise" style="margin-bottom:14px"><button class="btn sm sp" id="banyak">Tambah banyak sekaligus</button></div>` : ''}
    <div class="list" id="ls"></div>
    ${admin ? html`<button class="fab" id="add" aria-label="Tambah santri">+</button>` : ''}`);
  stagger(root);
  const fkEl = $('#fk', root);
  const tampil = () => {
    const kw = q.toLowerCase();
    const rows = all.filter((s) => (fs === 'semua' || s.status === fs) && (!fk || String(s.kelas_id) === fk) &&
      (!kw || [s.nama, s.nis, s.nama_wali].some((x) => String(x || '').toLowerCase().includes(kw))));
    const cn = $('#cnt', root); if (cn) cn.textContent = rows.length + ' santri';
    mount($('#ls', root), rows.length ? html`${rows.map((s, i) => html`
      <button class="item rise" style="--i:${Math.min(i, 12) * .5}" data-id="${s.id}">
        <div class="av">${inisial(s.nama)}</div>
        <div class="tx"><b>${s.nama}</b><small>${s.kelas?.nama || 'Tanpa kelas'}${s.nama_wali ? ' · wali ' + s.nama_wali : ''}</small></div>
        <div class="end"><span class="badge ${badgeStatus(s.status)}">${cap(s.status)}</span></div>
      </button>`)}` : html`<div class="empty">${iconKosong}<div>${all.length ? 'Tidak ada santri yang cocok' : 'Belum ada santri. Tekan + untuk menambah.'}</div></div>`);
  };
  async function load() {
    try {
      all = await db.listSantri();
      fkEl.innerHTML = '<option value="">Semua kelas</option>' + ctx.st.kelas.map((k) => `<option value="${k.id}">${esc(k.nama)}</option>`).join('');
      fkEl.value = fk; tampil();
    } catch (e) { toast(e.message, 'err'); }
  }
  on(root, 'click', '[data-s]', (e, b) => { fs = b.dataset.s; $$('#fs .chip', root).forEach((c) => c.classList.toggle('on', c === b)); tampil(); });
  fkEl.addEventListener('change', () => { fk = fkEl.value; tampil(); });
  $('#q', root).addEventListener('input', debounce((e) => { q = e.target.value.trim(); tampil(); }));
  on(root, 'click', '[data-id]', (e, b) => formSantri(ctx, all.find((s) => String(s.id) === b.dataset.id), load));
  if (admin) {
    $('#add', root).addEventListener('click', () => formSantri(ctx, null, load));
    $('#banyak', root).addEventListener('click', () => formBanyak(ctx, load));
  }
  await load();
}

function formSantri(ctx, s, done) {
  const { db, admin } = ctx; const baru = !s; s = s || { status: 'aktif', tanggal_masuk: ymd(new Date()) };
  const dis = admin ? '' : raw('disabled');
  const sh = sheet(html`
    <label class="field"><span>Nama santri *</span><input class="in" id="f_nama" value="${s.nama || ''}" ${dis} autocomplete="off"></label>
    <div class="frow"><label class="field"><span>NIS</span><input class="in" id="f_nis" value="${s.nis || ''}" ${dis}></label>
      <label class="field"><span>Jenis kelamin</span><select class="in" id="f_jk" ${dis}><option value="">—</option><option value="L" ${s.jenis_kelamin === 'L' ? raw('selected') : ''}>Laki-laki</option><option value="P" ${s.jenis_kelamin === 'P' ? raw('selected') : ''}>Perempuan</option></select></label></div>
    <div class="frow"><label class="field"><span>Kelas</span><select class="in" id="f_kelas" ${dis}>${opsiKelas(ctx.st.kelas, s.kelas_id)}</select></label>
      <label class="field"><span>Status</span><select class="in" id="f_status" ${dis}>${opsiStatus(s.status)}</select></label></div>
    <label class="field"><span>Nama wali</span><input class="in" id="f_wali" value="${s.nama_wali || ''}" ${dis}></label>
    <label class="field"><span>No. WhatsApp wali</span><input class="in" id="f_wa" inputmode="tel" value="${s.no_wa || ''}" ${dis}></label>
    <label class="field"><span>Alamat</span><input class="in" id="f_alamat" value="${s.alamat || ''}" ${dis}></label>
    <div class="frow"><label class="field"><span>Tanggal masuk</span><input class="in" type="date" id="f_masuk" value="${s.tanggal_masuk || ''}" ${dis}></label>
      <label class="field"><span>SPP khusus (Rp)</span><input class="in" id="f_spp" inputmode="numeric" placeholder="Ikut kelas" value="${s.nominal_spp ?? ''}" ${dis}></label></div>
    <label class="field"><span>Catatan</span><textarea class="in" id="f_cat" ${dis}>${s.catatan || ''}</textarea></label>
    ${admin ? html`<button class="btn pri block" id="simpan">${baru ? 'Tambah santri' : 'Simpan perubahan'}</button>
      ${baru ? '' : html`<div class="row" style="margin-top:12px"><button class="btn sp" id="bayarx">Bayar SPP</button><button class="btn red sp" id="hapus">Hapus</button></div>`}` : ''}`,
  { title: baru ? 'Tambah santri' : 'Data santri' });
  const g = (id) => $('#' + id, sh.el);
  if (!admin) return;
  g('simpan').addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
    const nama = g('f_nama').value.trim();
    if (!nama) throw new Error('Nama santri wajib diisi.');
    const spp = g('f_spp').value.replace(/\D/g, '');
    await db.saveSantri({
      id: s.id, nama, nis: g('f_nis').value.trim(), jenis_kelamin: g('f_jk').value, kelas_id: g('f_kelas').value || null, status: g('f_status').value,
      nama_wali: g('f_wali').value.trim(), no_wa: g('f_wa').value.trim(), alamat: g('f_alamat').value.trim(),
      tanggal_masuk: g('f_masuk').value || ymd(new Date()), nominal_spp: spp === '' ? null : Number(spp), catatan: g('f_cat').value.trim(),
    });
    toast(baru ? 'Santri ditambahkan' : 'Perubahan disimpan', 'ok'); sh.close(); done();
  }));
  if (!baru) {
    g('bayarx').addEventListener('click', () => { sh.close(); ctx.go('#/bayar?santri=' + s.id); });
    g('hapus').addEventListener('click', async () => {
      if (!(await konfirmasi(`Hapus santri "${s.nama}"? Semua tagihannya ikut terhapus.`, { ya: 'Hapus', merah: true }))) return;
      try { await db.delSantri(s.id); toast('Santri dihapus', 'ok'); sh.close(); done(); } catch (e) { toast(e.message, 'err'); }
    });
  }
}

function formBanyak(ctx, done) {
  const { db } = ctx;
  const sh = sheet(html`
    <p class="muted" style="margin:-6px 0 12px;font-size:13.5px">Tulis satu nama per baris. Semua akan memakai kelas dan status yang sama.</p>
    <label class="field"><span>Daftar nama</span><textarea class="in" id="b_n" style="min-height:160px" placeholder="Ahmad&#10;Fatimah&#10;Muhammad"></textarea></label>
    <div class="frow"><label class="field"><span>Kelas</span><select class="in" id="b_k">${opsiKelas(ctx.st.kelas, '')}</select></label>
      <label class="field"><span>Status</span><select class="in" id="b_s">${opsiStatus('aktif')}</select></label></div>
    <button class="btn pri block" id="b_go">Tambahkan semua</button>`, { title: 'Tambah banyak santri' });
  $('#b_go', sh.el).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
    const names = [...new Set($('#b_n', sh.el).value.split('\n').map((x) => x.trim()).filter(Boolean))];
    if (!names.length) throw new Error('Tulis minimal satu nama.');
    const kelas_id = $('#b_k', sh.el).value || null, status = $('#b_s', sh.el).value, tanggal_masuk = ymd(new Date());
    await db.insertSantriBanyak(names.map((nama) => ({ nama, kelas_id, status, tanggal_masuk })));
    toast(names.length + ' santri ditambahkan', 'ok'); sh.close(); done();
  }));
}
