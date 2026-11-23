// Halaman: Tagihan, Bayar, Tunggakan, Kuitansi, Laporan, Pengaturan
import { html, raw, mount, $, $$, on, esc, rp, num, slot, namaBulan, periodeOf, addMonths, BULAN, tgl, jam, ago, inisial, debounce, sheet, konfirmasi, toast, tombolKerja, stagger, iconKosong, tickSvg, terbilang, waLink, ymd } from './ui.js';

const SEARCH_SVG = raw('<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>');
const bStatus = (s) => ({ lunas: ['ok', 'Lunas'], sebagian: ['warn', 'Sebagian'], belum: ['bad', 'Belum bayar'] }[s] || ['gray', s]);
const digits = (s) => Number(String(s).replace(/\D/g, '')) || 0;
const fmtInput = (el) => el.addEventListener('input', () => { const n = digits(el.value); el.value = n ? n.toLocaleString('id-ID') : ''; });
const monthPicker = (periode, id) => html`<div class="row rise" style="margin-bottom:6px"><button class="btn sm" data-p="-1">‹</button><div class="sp" style="text-align:center"><b id="${id}" style="font-size:17px">${namaBulan(periode)}</b></div><button class="btn sm" data-p="1">›</button></div>`;

/* ========================= TAGIHAN ========================= */
export async function tagihan(root, ctx) {
  const { db, admin } = ctx;
  let periode = periodeOf(), rows = [], fs = 'semua', q = '';
  mount(root, html`
    ${monthPicker(periode, 'pl')}
    <div class="card rise" id="sum"></div>
    ${admin ? html`<button class="btn pri block rise" id="buat" style="margin-bottom:14px">Buat tagihan bulan ini</button>` : ''}
    <div class="search rise">${SEARCH_SVG}<input class="in" id="q" placeholder="Cari nama santri…" autocomplete="off"></div>
    <div class="chips rise" id="fs"><button class="chip on" data-s="semua">Semua</button><button class="chip" data-s="belum">Belum bayar</button><button class="chip" data-s="sebagian">Sebagian</button><button class="chip" data-s="lunas">Lunas</button></div>
    <div class="list" id="ls"></div>`);
  stagger(root);
  const tampil = () => {
    const tot = rows.reduce((a, r) => a + r.harus_bayar, 0), bay = rows.reduce((a, r) => a + r.terbayar, 0), sis = rows.reduce((a, r) => a + r.sisa, 0);
    const p = tot ? Math.round((bay / tot) * 100) : 0;
    mount($('#sum', root), html`<div class="grid g3" style="margin-bottom:12px">
      <div class="tile"><small>Tagihan</small><b class="sm" style="font-size:15px" data-v="${tot}">0</b></div>
      <div class="tile"><small>Terbayar</small><b style="font-size:15px;color:var(--green)" data-v="${bay}">0</b></div>
      <div class="tile"><small>Sisa</small><b style="font-size:15px;color:var(--red)" data-v="${sis}">0</b></div></div>
      <div class="pbar"><i style="width:${p}%"></i></div><div class="muted" style="font-size:12.5px;margin-top:8px">${rows.length} tagihan · ${p}% terbayar</div>`);
    $$('[data-v]', root).forEach((e) => slot(e, Number(e.dataset.v), { prefix: 'Rp' }));
    const kw = q.toLowerCase();
    const ls = rows.filter((r) => (fs === 'semua' || r.status === fs) && (!kw || r.nama.toLowerCase().includes(kw)));
    mount($('#ls', root), ls.length ? html`${ls.map((r, i) => { const [c, t] = bStatus(r.status); return html`
      <button class="item rise" style="--i:${Math.min(i, 10) * .5}" data-id="${r.id}"><div class="av">${inisial(r.nama)}</div>
        <div class="tx"><b>${r.nama}</b><small>${r.kelas || 'Tanpa kelas'} · ${rp(r.harus_bayar)}</small></div>
        <div class="end"><span class="badge ${c}">${t}</span>${r.sisa > 0 && r.status === 'sebagian' ? html`<small class="muted">sisa ${rp(r.sisa)}</small>` : ''}</div></button>`; })}`
      : html`<div class="empty">${iconKosong}<div>${rows.length ? 'Tidak ada tagihan yang cocok' : 'Belum ada tagihan bulan ini.' + (admin ? ' Tekan "Buat tagihan bulan ini".' : '')}</div></div>`);
  };
  async function load() {
    try { rows = await db.listTagihan(periode); tampil(); } catch (e) { toast(e.message, 'err'); }
  }
  on(root, 'click', '[data-p]', (e, b) => { periode = addMonths(periode, Number(b.dataset.p)); $('#pl', root).textContent = namaBulan(periode); load(); });
  on(root, 'click', '[data-s]', (e, b) => { fs = b.dataset.s; $$('#fs .chip', root).forEach((c) => c.classList.toggle('on', c === b)); tampil(); });
  $('#q', root).addEventListener('input', debounce((e) => { q = e.target.value.trim(); tampil(); }));
  on(root, 'click', '[data-id]', (e, b) => detailTagihan(ctx, rows.find((r) => String(r.id) === b.dataset.id), load));
  if (admin) $('#buat', root).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
    const n = await db.buatTagihan(periode);
    toast(n > 0 ? `${n} tagihan ${namaBulan(periode)} dibuat` : 'Semua tagihan bulan ini sudah ada', n > 0 ? 'ok' : ''); load();
  }));
  await load();
}

function detailTagihan(ctx, r, done) {
  const { db, admin } = ctx; const [c, t] = bStatus(r.status);
  const sh = sheet(html`
    <div class="row" style="margin-bottom:14px"><div class="tx" style="flex:1"><b style="font-size:17px">${r.nama}</b><div class="muted">${r.kelas || 'Tanpa kelas'} · ${namaBulan(r.periode)}</div></div><span class="badge ${c}">${t}</span></div>
    <div class="grid g3" style="margin-bottom:14px"><div class="tile"><small>Harus bayar</small><b style="font-size:14px">${rp(r.harus_bayar)}</b></div><div class="tile"><small>Terbayar</small><b style="font-size:14px;color:var(--green)">${rp(r.terbayar)}</b></div><div class="tile"><small>Sisa</small><b style="font-size:14px;color:var(--red)">${rp(r.sisa)}</b></div></div>
    ${admin ? html`<div class="frow"><label class="field"><span>Nominal (Rp)</span><input class="in" id="t_nom" inputmode="numeric" value="${num(r.nominal)}"></label>
      <label class="field"><span>Potongan (Rp)</span><input class="in" id="t_pot" inputmode="numeric" value="${num(r.potongan)}"></label></div>
      <button class="btn pri block" id="t_save">Simpan tagihan</button>
      <div class="row" style="margin-top:12px">${r.sisa > 0 ? html`<button class="btn sp" id="t_bayar">Bayar</button>` : ''}<button class="btn red sp" id="t_del">Hapus tagihan</button></div>` : ''}`, { title: 'Detail tagihan' });
  if (!admin) return;
  fmtInput($('#t_nom', sh.el)); fmtInput($('#t_pot', sh.el));
  $('#t_save', sh.el).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
    await db.saveTagihan(r.id, { nominal: digits($('#t_nom', sh.el).value), potongan: digits($('#t_pot', sh.el).value) });
    toast('Tagihan disimpan', 'ok'); sh.close(); done();
  }));
  $('#t_bayar', sh.el)?.addEventListener('click', () => { sh.close(); ctx.go('#/bayar?santri=' + r.santri_id); });
  $('#t_del', sh.el).addEventListener('click', async () => {
    if (!(await konfirmasi(`Hapus tagihan ${namaBulan(r.periode)} milik ${r.nama}?`, { ya: 'Hapus', merah: true }))) return;
    try { await db.delTagihan(r.id); toast('Tagihan dihapus', 'ok'); sh.close(); done(); } catch (e) { toast(e.message, 'err'); }
  });
}

/* ========================= BAYAR ========================= */
export async function bayar(root, ctx) {
  const { db } = ctx;
  let santri = [], pilih = null, buka = [];
  let metode = 'tunai';
  mount(root, html`
    <div class="card rise"><h3>Pilih santri</h3>
      <div class="search" style="margin-bottom:8px">${SEARCH_SVG}<input class="in" id="q" placeholder="Ketik nama santri…" autocomplete="off"></div>
      <div class="list" id="hasil"></div></div>
    <div id="form"></div>
    <div class="sec-t">Pembayaran terbaru</div><div class="list" id="riwayat"></div>`);
  stagger(root);
  const hasilEl = $('#hasil', root), formEl = $('#form', root);
  const cari = (kw) => {
    kw = kw.toLowerCase();
    const r = santri.filter((s) => ['aktif', 'baru', 'pindahan'].includes(s.status) && (!kw || s.nama.toLowerCase().includes(kw))).slice(0, kw ? 8 : 5);
    mount(hasilEl, r.length ? html`${r.map((s) => html`<button class="item" data-s="${s.id}"><div class="av">${inisial(s.nama)}</div><div class="tx"><b>${s.nama}</b><small>${s.kelas?.nama || 'Tanpa kelas'}</small></div></button>`)}` : html`<div class="empty" style="padding:14px">Santri tidak ditemukan</div>`);
  };
  async function pilihSantri(id) {
    pilih = santri.find((s) => String(s.id) === String(id));
    if (!pilih) return;
    $('#q', root).value = pilih.nama; hasilEl.innerHTML = '';
    let semua;
    try { [buka, semua] = await Promise.all([db.listTagihanBuka(pilih.id), db.tagihanSantri(pilih.id)]); } catch (e) { toast(e.message, 'err'); return; }
    // Bulan berikutnya yang belum punya tagihan (dibuat otomatis hanya saat pembayaran dicatat)
    const sudah = new Set(semua.map((t) => t.periode));
    const awal = semua.length ? semua[semua.length - 1].periode : addMonths(periodeOf(), -1);
    const nominalDasar = semua.length ? semua[semua.length - 1].nominal
      : (pilih.nominal_spp ?? ctx.st.kelas.find((k) => k.id === pilih.kelas_id)?.nominal_spp ?? ctx.st.pengaturan.spp_default ?? 0);
    let tambah = 0;
    const barisBln = (t) => html`<label class="item" style="cursor:pointer"><input type="checkbox" class="ck" value="${t.virtual ? 'v:' + t.periode : t.id}" data-sisa="${t.sisa}" ${t.cek === false ? '' : raw('checked')} style="width:22px;height:22px;accent-color:var(--green)"><div class="tx"><b>${namaBulan(t.periode)}</b><small>${t.virtual ? 'bulan berikutnya' : t.terbayar > 0 ? 'sudah dibayar ' + rp(t.terbayar) : 'belum dibayar'}</small></div><div class="end"><b>${rp(t.sisa)}</b></div></label>`;
    mount(formEl, html`<div class="card rise"><div class="row" style="margin-bottom:12px"><div class="av item" style="width:42px;height:42px;padding:0;box-shadow:none;cursor:default;justify-content:center;color:#fff;background:linear-gradient(145deg,var(--green-l),var(--green-d))">${inisial(pilih.nama)}</div><div class="tx" style="flex:1;min-width:0"><b class="nm">${pilih.nama}</b><div class="muted" style="font-size:13px">${pilih.kelas?.nama || 'Tanpa kelas'}</div></div><button class="btn sm" id="ganti">✕ Batal</button></div>
      <h3>Bulan yang dibayar</h3>
      <div class="list" id="bln">${buka.map((t) => barisBln(t))}</div>
      <button class="btn block" id="lagi" style="margin-top:10px">▾ Tambah bulan berikutnya</button>
      <div class="hr"></div>
      <label class="field"><span>Jumlah dibayar (Rp)</span><input class="in" id="jml" inputmode="numeric" style="font-size:20px;font-weight:800"></label>
      <div class="chips" id="mt"><button class="chip on" data-m="tunai">Tunai</button><button class="chip" data-m="transfer">Transfer</button><button class="chip" data-m="lainnya">Lainnya</button></div>
      <label class="field"><span>Catatan (opsional)</span><input class="in" id="cat" placeholder="Misal: dibayar ibunya"></label>
      <button class="btn pri block" id="go">Catat pembayaran</button></div>`);
    stagger(formEl);
    $('#ganti', root).addEventListener('click', () => { pilih = null; formEl.innerHTML = ''; $('#q', root).value = ''; cari(''); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    const jml = $('#jml', root); fmtInput(jml);
    const total = () => $$('.ck', root).filter((c) => c.checked).reduce((a, c) => a + Number(c.dataset.sisa), 0);
    const reset = () => { const t = total(); jml.value = t ? t.toLocaleString('id-ID') : ''; };
    reset();
    on(formEl, 'change', '.ck', reset);
    $('#lagi', root).addEventListener('click', () => {
      if (tambah >= 12) { toast('Maksimal 12 bulan ke depan', 'err'); return; }
      const per = addMonths(awal, ++tambah);
      if (sudah.has(per)) { return; }
      $('#bln', root).insertAdjacentHTML('beforeend', barisBln({ virtual: true, periode: per, sisa: nominalDasar, terbayar: 0 }).s);
      reset();
      $('#bln', root).lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    on(formEl, 'click', '[data-m]', (e, b) => { metode = b.dataset.m; $$('#mt .chip', root).forEach((c) => c.classList.toggle('on', c === b)); });
    $('#go', root).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
      const dipilih = $$('.ck', root).filter((c) => c.checked).map((c) => c.value);
      const j = digits(jml.value);
      if (!dipilih.length) throw new Error('Pilih minimal satu bulan.');
      if (j <= 0) throw new Error('Isi jumlah pembayaran.');
      if (j > total()) throw new Error(`Jumlah melebihi sisa tagihan terpilih (${rp(total())}).`);
      const ids = [];
      for (const v of dipilih) ids.push(v.startsWith('v:') ? await db.tambahTagihan(pilih.id, v.slice(2), nominalDasar) : Number(v));
      const res = await db.bayar({ santriId: pilih.id, jumlah: j, metode, catatan: $('#cat', root).value.trim(), tagihanIds: ids });
      const sh = sheet(html`<div style="text-align:center">${tickSvg()}<h2 style="margin:0">Pembayaran tercatat</h2>
        <p class="muted" style="margin:6px 0 16px">${pilih.nama} · ${rp(j)}<br>Kuitansi ${res.nomor}</p>
        <button class="btn pri block" id="lihat">Lihat kuitansi</button><button class="btn block" id="ok" style="margin-top:10px">Selesai</button></div>`);
      $('#lihat', sh.el).addEventListener('click', () => { sh.close(); bukaKuitansi(ctx, res.kuitansi_id); });
      $('#ok', sh.el).addEventListener('click', sh.close);
      pilih = null; formEl.innerHTML = ''; $('#q', root).value = ''; riwayat();
    }));
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function riwayat() {
    try {
      const k = await db.listKuitansi(8);
      mount($('#riwayat', root), k.length ? html`${k.map((x) => itemKuitansi(x))}` : html`<div class="empty">Belum ada pembayaran</div>`);
    } catch (e) { toast(e.message, 'err'); }
  }
  on(root, 'click', '[data-s]', (e, b) => pilihSantri(b.dataset.s));
  on(root, 'click', '[data-kw]', (e, b) => bukaKuitansi(ctx, Number(b.dataset.kw)));
  $('#q', root).addEventListener('input', debounce((e) => { if (pilih && e.target.value !== pilih.nama) { pilih = null; formEl.innerHTML = ''; } cari(e.target.value.trim()); }, 120));
  try { santri = await db.listSantri(); cari(''); } catch (e) { toast(e.message, 'err'); }
  riwayat();
  if (ctx.params.santri) pilihSantri(ctx.params.santri);
}

function itemKuitansi(x) {
  return html`<button class="item" data-kw="${x.id}"><div class="av" style="${x.dibatalkan ? 'background:var(--red)' : ''}">${inisial(x.santri?.nama)}</div>
    <div class="tx"><b>${x.santri?.nama || '-'}</b><small>${x.nomor} · ${ago(x.tanggal)}</small></div>
    <div class="end"><b ${x.dibatalkan ? raw('style="text-decoration:line-through;color:var(--red)"') : ''}>${rp(x.total)}</b>${x.dibatalkan ? html`<span class="badge bad">Batal</span>` : ''}</div></button>`;
}

/* ========================= TUNGGAKAN ========================= */
export async function tunggakan(root, ctx) {
  const { db, admin } = ctx;
  let list = [], q = '';
  mount(root, html`<div class="tile hl rise" style="padding:16px;margin-bottom:14px"><small>Total tunggakan seluruh santri</small><b style="font-size:30px" id="tot">0</b><small id="tj" style="margin-top:6px"></small></div>
    <div class="search rise">${SEARCH_SVG}<input class="in" id="q" placeholder="Cari nama santri…" autocomplete="off"></div>
    <div class="list" id="ls"><div class="empty">Memuat…</div></div>`);
  stagger(root);
  const tampil = () => {
    const kw = q.toLowerCase();
    const ls = list.filter((s) => !kw || s.nama.toLowerCase().includes(kw));
    mount($('#ls', root), ls.length ? html`${ls.map((s, i) => html`<button class="item rise" style="--i:${Math.min(i, 10) * .5}" data-id="${s.id}"><div class="av" style="background:linear-gradient(145deg,#EE8A82,var(--red))">${inisial(s.nama)}</div>
      <div class="tx"><b>${s.nama}</b><small>${s.kelas || 'Tanpa kelas'} · ${s.bulan.length} bulan</small></div><div class="end"><b style="color:var(--red)">${rp(s.total)}</b></div></button>`)}` : html`<div class="empty">${iconKosong}<div>${list.length ? 'Tidak ada yang cocok' : 'Tidak ada tunggakan. Alhamdulillah!'}</div></div>`);
  };
  try {
    const [rows, sant] = await Promise.all([db.listTunggakan(periodeOf()), db.listSantri()]);
    const mp = new Map();
    rows.forEach((r) => {
      if (!mp.has(r.santri_id)) { const s = sant.find((x) => x.id === r.santri_id) || {}; mp.set(r.santri_id, { id: r.santri_id, nama: r.nama, kelas: r.kelas, wa: s.no_wa, wali: s.nama_wali, total: 0, bulan: [] }); }
      const m = mp.get(r.santri_id); m.total += r.sisa; m.bulan.push(r);
    });
    list = [...mp.values()].sort((a, b) => b.total - a.total);
    slot($('#tot', root), list.reduce((a, s) => a + s.total, 0), { prefix: 'Rp' });
    $('#tj', root).textContent = `${list.length} santri menunggak`;
    tampil();
  } catch (e) { toast(e.message, 'err'); }
  $('#q', root).addEventListener('input', debounce((e) => { q = e.target.value.trim(); tampil(); }));
  on(root, 'click', '[data-id]', (e, b) => {
    const s = list.find((x) => String(x.id) === b.dataset.id);
    const bln = s.bulan.map((x) => namaBulan(x.periode)).join(', ');
    const pesan = `Assalamu'alaikum wr. wb. Bapak/Ibu${s.wali ? ' ' + s.wali : ''}, wali dari ananda ${s.nama}. Kami dari ${ctx.st.pengaturan.nama_sekolah} mengingatkan SPP yang belum dibayar: ${bln}. Total ${rp(s.total)}. Mohon dibayarkan, jazakumullahu khairan.`;
    const sh = sheet(html`<div class="row" style="margin-bottom:12px"><div class="tx" style="flex:1"><b style="font-size:17px">${s.nama}</b><div class="muted">${s.kelas || 'Tanpa kelas'}</div></div><b style="color:var(--red);font-size:18px">${rp(s.total)}</b></div>
      <div class="list" style="margin-bottom:14px">${s.bulan.map((x) => html`<div class="item" style="cursor:default"><div class="tx"><b>${namaBulan(x.periode)}</b></div><div class="end"><b>${rp(x.sisa)}</b></div></div>`)}</div>
      <a class="btn block" style="text-decoration:none;margin-bottom:10px" target="_blank" rel="noopener" href="${waLink(s.wa, pesan)}">Tagih lewat WhatsApp</a>
      ${admin ? html`<button class="btn pri block" id="by">Catat pembayaran</button>` : ''}`, { title: 'Rincian tunggakan' });
    $('#by', sh.el)?.addEventListener('click', () => { sh.close(); ctx.go('#/bayar?santri=' + s.id); });
  });
}

/* ========================= KUITANSI ========================= */
export async function kuitansi(root, ctx) {
  const { db } = ctx;
  let list = [], q = '';
  mount(root, html`<div class="search rise">${SEARCH_SVG}<input class="in" id="q" placeholder="Cari nama atau nomor kuitansi…" autocomplete="off"></div><div class="list" id="ls"><div class="empty">Memuat…</div></div>`);
  stagger(root);
  const tampil = () => {
    const kw = q.toLowerCase();
    const ls = list.filter((x) => !kw || (x.santri?.nama || '').toLowerCase().includes(kw) || x.nomor.toLowerCase().includes(kw));
    mount($('#ls', root), ls.length ? html`${ls.map((x) => itemKuitansi(x))}` : html`<div class="empty">${iconKosong}<div>Belum ada kuitansi</div></div>`);
  };
  try { list = await db.listKuitansi(150); tampil(); } catch (e) { toast(e.message, 'err'); }
  $('#q', root).addEventListener('input', debounce((e) => { q = e.target.value.trim(); tampil(); }));
  on(root, 'click', '[data-kw]', (e, b) => bukaKuitansi(ctx, Number(b.dataset.kw), async () => { try { list = await db.listKuitansi(150); tampil(); } catch (e) { toast(e.message, 'err'); } }));
}

export async function bukaKuitansi(ctx, id, done) {
  const { db, admin } = ctx; const P = ctx.st.pengaturan;
  let k;
  try { k = await db.getKuitansi(id); } catch (e) { toast(e.message, 'err'); return; }
  const bln = (k.pembayaran || []).slice().sort((a, b) => a.tagihan.periode.localeCompare(b.tagihan.periode));
  const pesan = `Assalamu'alaikum. Bukti pembayaran SPP ${P.nama_sekolah}\nNo: ${k.nomor}\nSantri: ${k.santri.nama}\nTanggal: ${tgl(k.tanggal)}\nUntuk: ${bln.map((b) => 'SPP ' + namaBulan(b.tagihan.periode)).join(', ')}\nTotal: ${rp(k.total)}\nJazakumullahu khairan.`;
  const sh = sheet(html`
    <div class="kw"><div class="hd"><img src="assets/logo.png" alt=""><div><b>${P.nama_sekolah}</b><small>${[P.alamat, P.no_wa ? 'WA ' + P.no_wa : ''].filter(Boolean).join(' · ')}</small></div></div>
      <h4>KUITANSI PEMBAYARAN</h4>
      <table><tr><td>No. kuitansi</td><td><b>${k.nomor}</b></td></tr><tr><td>Tanggal</td><td>${tgl(k.tanggal)}, pukul ${jam(k.tanggal)}</td></tr>
        <tr><td>Diterima dari</td><td><b>${k.santri.nama}</b>${k.santri.kelas?.nama ? ' (' + k.santri.kelas.nama + ')' : ''}</td></tr>
        <tr><td>Untuk</td><td>${bln.map((b) => html`<div class="kw-l"><span>SPP ${namaBulan(b.tagihan.periode)}</span><b>${rp(b.jumlah)}</b></div>`)}</td></tr>
        <tr><td>Metode</td><td>${k.metode[0].toUpperCase() + k.metode.slice(1)}</td></tr>${k.catatan ? html`<tr><td>Catatan</td><td>${k.catatan}</td></tr>` : ''}</table>
      <div class="tot"><span>Total</span><span>${rp(k.total)}</span></div><div class="tb">${terbilang(k.total)}</div>
      <div class="ttd"><div>Penyetor<br><br><br><br><b>( ${k.santri.nama} )</b></div><div>Bendahara<br><br><br><br><b>( ${P.bendahara || '..............'} )</b></div>
        ${k.dibatalkan ? html`<div class="stamp bad">DIBATALKAN</div>` : html`<div class="stamp">DITERIMA</div>`}</div></div>
    <div class="no-print" style="margin-top:14px"><button class="btn pri block" id="img">Simpan gambar</button>
      <div class="row" style="margin-top:10px"><button class="btn sp" id="cetak">Cetak / PDF</button><a class="btn sp" style="text-decoration:none" target="_blank" rel="noopener" href="${waLink(k.santri.no_wa, pesan)}">Kirim WA</a></div>
      ${admin && !k.dibatalkan ? html`<button class="btn red block" id="batal" style="margin-top:10px">Batalkan kuitansi</button>` : ''}
      ${admin && k.dibatalkan ? html`<button class="btn red block" id="hapus" style="margin-top:10px">Hapus kuitansi ini</button><p class="muted" style="font-size:12.5px;margin:8px 2px 0">Kuitansi sudah dibatalkan, jadi tidak memengaruhi tagihan. Menghapus bersifat permanen.</p>` : ''}</div>`, { title: 'Kuitansi' });
  $('#hapus', sh.el)?.addEventListener('click', async () => {
    if (!(await konfirmasi(`Hapus permanen kuitansi ${k.nomor}? Tindakan ini tidak bisa dibatalkan.`, { ya: 'Hapus', merah: true }))) return;
    try { await db.hapusKuitansi(k.id); toast('Kuitansi dihapus', 'ok'); sh.close(); done?.(); } catch (e) { toast(e.message, 'err'); }
  });
  $('#cetak', sh.el).addEventListener('click', () => {
    document.body.classList.add('ps');
    window.addEventListener('afterprint', () => document.body.classList.remove('ps'), { once: true });
    window.print();
  });
  // Gambar disiapkan sejak awal agar tombol "Simpan gambar" langsung bekerja di iPhone
  const nama = `kuitansi-${k.nomor}.png`;
  const siap = import('./kuitansi-gambar.js').then(async (m) => { const c = await m.gambarKuitansi(k, P); return { c, blob: await m.keBlob(c) }; });
  $('#img', sh.el).addEventListener('click', async () => {
    let g;
    try { g = await siap; } catch (e) { toast('Gagal membuat gambar', 'err'); return; }
    const file = new File([g.blob], nama, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Kuitansi ' + k.nomor }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(g.blob);
    const s2 = sheet(html`<p class="muted" style="margin:0 0 12px;font-weight:600">Tekan lama gambar, lalu pilih <b>Simpan ke Foto</b>.</p>
      <img src="${url}" alt="Kuitansi ${k.nomor}" style="width:100%;border-radius:14px;box-shadow:var(--sh-out-s);display:block">
      <a class="btn block" style="text-decoration:none;margin-top:12px" href="${url}" download="${nama}">Unduh gambar</a>`, { title: 'Gambar kuitansi' });
    s2.ov.addEventListener('transitionend', () => { if (!s2.ov.isConnected) URL.revokeObjectURL(url); });
  });
  $('#batal', sh.el)?.addEventListener('click', async () => {
    if (!(await konfirmasi(`Batalkan kuitansi ${k.nomor}? Pembayaran akan dikembalikan menjadi belum dibayar.`, { ya: 'Batalkan', merah: true }))) return;
    try { await db.batalKuitansi(k.id, 'dibatalkan oleh admin'); toast('Kuitansi dibatalkan', 'ok'); sh.close(); done?.(); } catch (e) { toast(e.message, 'err'); }
  });
}

/* ========================= LAPORAN ========================= */
export async function laporan(root, ctx) {
  const { db } = ctx;
  const now = new Date(); const bm = periodeOf(now).slice(0, 7);
  let dari = bm, sampai = bm, data = null;
  mount(root, html`<div class="card rise no-print"><div class="chips"><button class="chip on" data-pre="bulan">Bulan ini</button><button class="chip" data-pre="lalu">Bulan lalu</button><button class="chip" data-pre="tahun">Tahun ini</button></div>
    <div class="frow"><label class="field" style="margin:0"><span>Dari bulan</span><input class="in" type="month" id="d" value="${dari}"></label><label class="field" style="margin:0"><span>Sampai bulan</span><input class="in" type="month" id="s" value="${sampai}"></label></div></div>
    <div id="isi"><div class="empty">Memuat…</div></div>`);
  stagger(root);
  const lab = (p) => namaBulan(p + '-01');
  async function muat() {
    if (dari > sampai) { toast('Bulan awal harus sebelum bulan akhir', 'err'); return; }
    try {
      const [y2, m2] = sampai.split('-').map(Number);
      const awal = new Date(Number(dari.slice(0, 4)), Number(dari.slice(5)) - 1, 1).toISOString();
      const akhir = new Date(y2, m2, 1).toISOString();
      const [kw, tg, ks, rk] = await Promise.all([db.kuitansiRange(awal, akhir), db.tagihanRange(dari + '-01', sampai + '-01'), db.listKas(dari + '-01', ymd(new Date(y2, m2, 1))), db.ringkasanKas()]);
      data = { kw, tg, ks, rk }; gambar();
    } catch (e) { toast(e.message, 'err'); }
  }
  function gambar() {
    const { kw, tg, ks, rk } = data;
    const kMasuk = ks.filter((x) => x.jenis === 'masuk').reduce((a, x) => a + x.jumlah, 0), kKeluar = ks.filter((x) => x.jenis === 'keluar').reduce((a, x) => a + x.jumlah, 0);
    const tTag = tg.reduce((a, r) => a + r.harus_bayar, 0), tSisa = tg.reduce((a, r) => a + r.sisa, 0), tKas = kw.reduce((a, r) => a + r.total, 0);
    const perBulan = new Map(), perKelas = new Map();
    tg.forEach((r) => { const b = r.periode.slice(0, 7); const x = perBulan.get(b) || { tag: 0, sisa: 0, kas: 0 }; x.tag += r.harus_bayar; x.sisa += r.sisa; perBulan.set(b, x);
      const k = r.kelas || 'Tanpa kelas'; const y = perKelas.get(k) || { tag: 0, bay: 0, sisa: 0 }; y.tag += r.harus_bayar; y.bay += r.terbayar; y.sisa += r.sisa; perKelas.set(k, y); });
    kw.forEach((r) => { const b = ymd(new Date(r.tanggal)).slice(0, 7); const x = perBulan.get(b) || { tag: 0, sisa: 0, kas: 0 }; x.kas += r.total; perBulan.set(b, x); });
    const bulan = [...perBulan.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const judul = dari === sampai ? lab(dari) : `${lab(dari)} – ${lab(sampai)}`;
    mount($('#isi', root), html`
      <div class="card rise"><div style="font-weight:800;font-size:16px">Laporan keuangan SPP</div><div class="muted" style="margin-bottom:14px">${ctx.st.pengaturan.nama_sekolah} · ${judul}</div>
        <div class="grid g2"><div class="tile"><small>Total tagihan</small><b class="sm" style="font-size:17px">${rp(tTag)}</b></div><div class="tile hl"><small>Uang diterima</small><b style="font-size:17px">${rp(tKas)}</b></div>
        <div class="tile"><small>Sisa belum dibayar</small><b style="font-size:17px;color:var(--red)">${rp(tSisa)}</b></div><div class="tile"><small>Jumlah transaksi</small><b style="font-size:17px">${num(kw.length)}</b></div></div></div>
      <div class="card rise"><h3>Kas</h3><div class="grid g2"><div class="tile"><small>Uang masuk lain</small><b style="font-size:15px;color:var(--green)">${rp(kMasuk)}</b></div><div class="tile"><small>Pengeluaran</small><b style="font-size:15px;color:var(--red)">${rp(kKeluar)}</b></div>
        <div class="tile"><small>Selisih periode</small><b style="font-size:15px">${rp(tKas + kMasuk - kKeluar)}</b></div><div class="tile hl"><small>Saldo kas saat ini</small><b style="font-size:15px">${rp(rk.saldo)}</b></div></div>
        ${ks.length ? html`<table class="tbl" style="margin-top:12px"><thead><tr><th>Tgl</th><th>Keterangan</th><th class="r">Jumlah</th></tr></thead><tbody>${ks.map((x) => html`<tr><td>${ymd(new Date(x.tanggal)).slice(8)}/${x.tanggal.slice(5, 7)}</td><td>${x.kategori || '-'}${x.keterangan ? html`<div class="muted" style="font-size:11px">${x.keterangan}</div>` : ''}</td><td class="r" style="color:${x.jenis === 'masuk' ? 'var(--green)' : 'var(--red)'}">${x.jenis === 'masuk' ? '+' : '−'}${num(x.jumlah)}</td></tr>`)}</tbody></table>` : ''}</div>
      <div class="card rise"><h3>Per bulan</h3><table class="tbl"><thead><tr><th>Bulan</th><th class="r">Tagihan</th><th class="r">Diterima</th><th class="r">Sisa</th></tr></thead><tbody>
        ${bulan.map(([b, x]) => html`<tr><td>${namaBulan(b + '-01', true)}</td><td class="r">${num(x.tag)}</td><td class="r">${num(x.kas)}</td><td class="r">${num(x.sisa)}</td></tr>`)}</tbody>
        <tfoot><tr><td>Total</td><td class="r">${num(tTag)}</td><td class="r">${num(tKas)}</td><td class="r">${num(tSisa)}</td></tr></tfoot></table></div>
      <div class="card rise"><h3>Per kelas</h3><table class="tbl"><thead><tr><th>Kelas</th><th class="r">Tagihan</th><th class="r">Terbayar</th><th class="r">Sisa</th></tr></thead><tbody>
        ${[...perKelas.entries()].sort().map(([k, x]) => html`<tr><td>${k}</td><td class="r">${num(x.tag)}</td><td class="r">${num(x.bay)}</td><td class="r">${num(x.sisa)}</td></tr>`)}</tbody></table></div>
      <div class="card rise"><h3>Daftar transaksi</h3>${kw.length ? html`<table class="tbl"><thead><tr><th>Tgl</th><th>Nama</th><th class="r">Jumlah</th></tr></thead><tbody>
        ${kw.map((r) => html`<tr><td>${ymd(new Date(r.tanggal)).slice(8)}/${ymd(new Date(r.tanggal)).slice(5, 7)}</td><td>${r.santri?.nama || '-'}<div class="muted" style="font-size:11px">${r.nomor}</div></td><td class="r">${num(r.total)}</td></tr>`)}</tbody></table>` : html`<div class="empty" style="padding:14px">Tidak ada transaksi</div>`}</div>
      <div class="row no-print"><button class="btn sp" id="csv">Unduh Excel (CSV)</button><button class="btn pri sp" id="prn">Cetak / PDF</button></div>`);
    stagger($('#isi', root));
    $('#prn', root).addEventListener('click', () => window.print());
    $('#csv', root).addEventListener('click', () => {
      const L = [['Laporan SPP', ctx.st.pengaturan.nama_sekolah], ['Periode', judul], [], ['Tanggal', 'No. kuitansi', 'Nama santri', 'Kelas', 'Metode', 'Jumlah']];
      kw.forEach((r) => L.push([ymd(new Date(r.tanggal)), r.nomor, r.santri?.nama || '', r.santri?.kelas?.nama || '', r.metode, r.total]));
      ks.forEach((x) => L.push([x.tanggal, x.jenis === 'masuk' ? 'Uang masuk' : 'Pengeluaran', x.kategori, x.keterangan || '', '', x.jenis === 'masuk' ? x.jumlah : -x.jumlah]));
      L.push([], ['Saldo kas saat ini', '', '', '', '', rk.saldo], ['Total diterima', '', '', '', '', tKas], ['Total tagihan', '', '', '', '', tTag], ['Sisa belum dibayar', '', '', '', '', tSisa]);
      const csv = '﻿' + L.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `laporan-spp-${dari}${dari === sampai ? '' : '_' + sampai}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    });
  }
  const setP = (d, s) => { dari = d; sampai = s; $('#d', root).value = d; $('#s', root).value = s; muat(); };
  on(root, 'click', '[data-pre]', (e, b) => {
    $$('.chips .chip', root).forEach((c) => c.classList.toggle('on', c === b));
    const y = now.getFullYear();
    if (b.dataset.pre === 'bulan') setP(bm, bm);
    else if (b.dataset.pre === 'lalu') { const p = addMonths(periodeOf(now), -1).slice(0, 7); setP(p, p); }
    else setP(`${y}-01`, `${y}-12`);
  });
  $('#d', root).addEventListener('change', (e) => { if (e.target.value) { dari = e.target.value; muat(); } });
  $('#s', root).addEventListener('change', (e) => { if (e.target.value) { sampai = e.target.value; muat(); } });
  await muat();
}

/* ========================= PENGATURAN ========================= */
export async function pengaturan(root, ctx) {
  const { db, admin } = ctx; const P = ctx.st.pengaturan;
  const dis = admin ? '' : raw('disabled');
  mount(root, html`
    <div class="card rise"><h3>Profil sekolah</h3>
      <label class="field"><span>Nama sekolah</span><input class="in" id="p_nama" value="${P.nama_sekolah}" ${dis}></label>
      <label class="field"><span>Alamat</span><input class="in" id="p_alamat" value="${P.alamat || ''}" ${dis}></label>
      <label class="field"><span>No. WhatsApp sekolah</span><input class="in" id="p_wa" inputmode="tel" value="${P.no_wa || ''}" ${dis}></label>
      <div class="frow"><label class="field"><span>Kepala sekolah</span><input class="in" id="p_kep" value="${P.kepala_sekolah || ''}" ${dis}></label><label class="field"><span>Bendahara</span><input class="in" id="p_ben" value="${P.bendahara || ''}" ${dis}></label></div>
      <div class="frow"><label class="field"><span>SPP standar (Rp)</span><input class="in" id="p_spp" inputmode="numeric" value="${num(P.spp_default)}" ${dis}></label><label class="field"><span>Tahun ajaran</span><input class="in" id="p_ta" value="${P.tahun_ajaran || ''}" ${dis}></label></div>
      ${admin ? html`<button class="btn pri block" id="p_save">Simpan pengaturan</button>` : ''}</div>
    <div class="card rise"><div class="row" style="margin-bottom:12px"><h3 style="margin:0" class="sp">Kelas</h3>${admin ? html`<button class="btn sm" id="k_add">+ Tambah</button>` : ''}</div><div class="list" id="kls"></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">SPP kelas dipakai bila santri tidak punya SPP khusus. Bila kosong, dipakai SPP standar.</p></div>
    ${admin ? html`<div class="card rise"><h3>Pengguna aplikasi</h3><div class="list" id="usr"></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Admin boleh mengubah semua data. Kepala sekolah hanya melihat. Untuk menambah pengguna baru: Supabase → Authentication → Users → Add user, lalu atur perannya di sini.</p></div>` : ''}
    <div class="card rise"><h3>Keamanan</h3><label class="field"><span>Password baru (min. 8 karakter)</span><input class="in" type="password" id="pw" autocomplete="new-password"></label><button class="btn block" id="pw_go">Ganti password</button></div>
    <div class="muted rise" style="text-align:center;font-size:12px;padding:6px 0 10px">SPP TPQ Nurul Hidayah Batung · v1.0</div>`);
  stagger(root);
  fmtInput($('#p_spp', root));
  if (admin) {
    $('#p_save', root).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
      const nama = $('#p_nama', root).value.trim(); if (!nama) throw new Error('Nama sekolah wajib diisi.');
      const baru = { nama_sekolah: nama, alamat: $('#p_alamat', root).value.trim(), no_wa: $('#p_wa', root).value.trim(), kepala_sekolah: $('#p_kep', root).value.trim(), bendahara: $('#p_ben', root).value.trim(), spp_default: digits($('#p_spp', root).value), tahun_ajaran: $('#p_ta', root).value.trim() };
      await db.savePengaturan(baru); Object.assign(ctx.st.pengaturan, baru); ctx.refreshHeader(); toast('Pengaturan disimpan', 'ok');
    }));
  }
  const kelasLs = async () => {
    try {
      ctx.st.kelas = await db.listKelas();
      mount($('#kls', root), ctx.st.kelas.length ? html`${ctx.st.kelas.map((k) => html`<button class="item" data-k="${k.id}"><div class="tx"><b>${k.nama}</b><small>${k.nominal_spp != null ? 'SPP ' + rp(k.nominal_spp) : 'SPP standar'}</small></div><div class="end muted">${admin ? '✎' : ''}</div></button>`)}` : html`<div class="empty" style="padding:14px">Belum ada kelas. Tekan "+ Tambah".</div>`);
    } catch (e) { toast(e.message, 'err'); }
  };
  const formKelas = (k) => {
    const sh = sheet(html`<label class="field"><span>Nama kelas</span><input class="in" id="kn" value="${k?.nama || ''}" placeholder="Misal: Jilid 1"></label>
      <div class="frow"><label class="field"><span>SPP kelas (Rp)</span><input class="in" id="ks" inputmode="numeric" placeholder="Ikut standar" value="${k?.nominal_spp != null ? num(k.nominal_spp) : ''}"></label><label class="field"><span>Urutan</span><input class="in" id="ku" inputmode="numeric" value="${k?.urutan ?? ctx.st.kelas.length + 1}"></label></div>
      <button class="btn pri block" id="kgo">Simpan</button>${k ? html`<button class="btn red block" id="kdel" style="margin-top:10px">Hapus kelas</button>` : ''}`, { title: k ? 'Ubah kelas' : 'Tambah kelas' });
    fmtInput($('#ks', sh.el));
    $('#kgo', sh.el).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
      const nama = $('#kn', sh.el).value.trim(); if (!nama) throw new Error('Nama kelas wajib diisi.');
      const s = $('#ks', sh.el).value; await db.saveKelas({ id: k?.id, nama, nominal_spp: s === '' ? null : digits(s), urutan: digits($('#ku', sh.el).value) });
      toast('Kelas disimpan', 'ok'); sh.close(); kelasLs();
    }));
    $('#kdel', sh.el)?.addEventListener('click', async () => {
      if (!(await konfirmasi(`Hapus kelas "${k.nama}"? Santri di kelas ini jadi tanpa kelas.`, { ya: 'Hapus', merah: true }))) return;
      try { await db.delKelas(k.id); toast('Kelas dihapus', 'ok'); sh.close(); kelasLs(); } catch (e) { toast(e.message, 'err'); }
    });
  };
  if (admin) $('#k_add', root).addEventListener('click', () => formKelas(null));
  on(root, 'click', '[data-k]', (e, b) => { if (admin) formKelas(ctx.st.kelas.find((k) => String(k.id) === b.dataset.k)); });
  kelasLs();
  if (admin) {
    try {
      const us = await db.listProfil();
      mount($('#usr', root), html`${us.map((u) => html`<div class="item" style="cursor:default"><div class="av">${inisial(u.nama)}</div><div class="tx"><b>${u.nama}</b><small>${u.email}</small></div>
        <select class="in" data-u="${u.id}" style="width:auto;padding:8px 30px 8px 12px;font-size:13px"><option value="admin" ${u.peran === 'admin' ? raw('selected') : ''}>Admin</option><option value="kepsek" ${u.peran === 'kepsek' ? raw('selected') : ''}>Kepsek</option><option value="menunggu" ${u.peran === 'menunggu' ? raw('selected') : ''}>Nonaktif</option></select></div>`)}`);
      on(root, 'change', '[data-u]', async (e, sel) => {
        try {
          if (sel.dataset.u === ctx.me.id && sel.value !== 'admin' && !(await konfirmasi('Anda akan menurunkan peran akun Anda sendiri. Lanjutkan?', { ya: 'Lanjut', merah: true }))) { sel.value = 'admin'; return; }
          await db.setPeran(sel.dataset.u, sel.value); toast('Peran diperbarui', 'ok');
        } catch (er) { toast(er.message, 'err'); }
      });
    } catch (e) { toast(e.message, 'err'); }
  }
  $('#pw_go', root).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
    const pw = $('#pw', root).value; if (pw.length < 8) throw new Error('Password minimal 8 karakter.');
    await db.changePassword(pw); $('#pw', root).value = ''; toast('Password diganti', 'ok');
  }));
}
