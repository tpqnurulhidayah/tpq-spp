// Halaman Kas: saldo kas, uang masuk lain, pengeluaran
import { html, raw, mount, $, $$, on, rp, num, slot, namaBulan, periodeOf, addMonths, tgl, sheet, konfirmasi, toast, tombolKerja, stagger, iconKosong, ymd } from './ui.js';

const digits = (s) => Number(String(s).replace(/\D/g, '')) || 0;
const fmtInput = (el) => el.addEventListener('input', () => { const n = digits(el.value); el.value = n ? n.toLocaleString('id-ID') : ''; });
export const KATEGORI = {
  masuk: ['Donasi', 'Infaq', 'Hibah', 'Lainnya'],
  keluar: ['Gaji guru', 'Listrik & air', 'Alat tulis', 'Kebersihan', 'Kegiatan', 'Perawatan', 'Lainnya'],
};
const bulanKe = (p) => ({ dari: p, sampai: addMonths(p, 1) });

export async function kas(root, ctx) {
  const { db, admin } = ctx;
  let periode = periodeOf(), cat = [];
  mount(root, html`
    <div class="tile hl rise" style="padding:18px;margin-bottom:12px"><small>Saldo kas saat ini</small><b style="font-size:34px" id="saldo">0</b><small id="saldoT" style="margin-top:6px">Memuat…</small></div>
    <div class="grid g2 rise" style="margin-bottom:12px">
      <div class="tile"><small>Saldo awal</small><b style="font-size:16px" id="k_awal">0</b></div>
      <div class="tile"><small>SPP masuk</small><b style="font-size:16px;color:var(--green)" id="k_spp">0</b></div>
      <div class="tile"><small>Uang masuk lain</small><b style="font-size:16px;color:var(--green)" id="k_lain">0</b></div>
      <div class="tile"><small>Pengeluaran</small><b style="font-size:16px;color:var(--red)" id="k_keluar">0</b></div></div>
    ${admin ? html`<div class="row rise" style="margin-bottom:8px"><button class="btn pri sp" id="b_masuk">+ Uang masuk</button><button class="btn red sp" id="b_keluar">− Pengeluaran</button></div>
      <button class="btn block rise" id="b_awal" style="margin-bottom:14px">Atur saldo awal</button>` : ''}
    <div class="sec-t">Catatan kas</div>
    <div class="row rise" style="margin-bottom:6px"><button class="btn sm" data-p="-1">‹</button><div class="sp" style="text-align:center"><b id="pl" style="font-size:16px">${namaBulan(periode)}</b></div><button class="btn sm" data-p="1">›</button></div>
    <div class="muted rise" id="sub" style="text-align:center;font-size:12.5px;margin-bottom:10px"></div>
    <div class="list" id="ls"></div>`);
  stagger(root);
  const fill = (id, v) => { const e = $(id, root); if (e) slot(e, v, { prefix: 'Rp' }); };

  async function ringkas() {
    try {
      const r = await db.ringkasanKas();
      if (!$('#saldo', root)) return;
      fill('#saldo', r.saldo); fill('#k_awal', r.saldo_awal); fill('#k_spp', r.spp_masuk); fill('#k_lain', r.masuk_lain); fill('#k_keluar', r.keluar);
      $('#saldoT', root).textContent = 'Saldo awal + SPP + uang masuk − pengeluaran';
    } catch (e) { toast(e.message, 'err'); }
  }
  async function daftar() {
    try {
      const { dari, sampai } = bulanKe(periode);
      cat = await db.listKas(dari, sampai);
      if (!$('#ls', root)) return;
      const m = cat.filter((x) => x.jenis === 'masuk').reduce((a, x) => a + x.jumlah, 0), k = cat.filter((x) => x.jenis === 'keluar').reduce((a, x) => a + x.jumlah, 0);
      $('#sub', root).textContent = cat.length ? `Masuk ${rp(m)} · Keluar ${rp(k)}` : '';
      mount($('#ls', root), cat.length ? html`${cat.map((x, i) => html`
        <button class="item rise" style="--i:${Math.min(i, 10) * .5}" data-id="${x.id}">
          <div class="av" style="background:${x.jenis === 'masuk' ? 'linear-gradient(145deg,var(--green-l),var(--green-d))' : 'linear-gradient(145deg,#EE8A82,var(--red))'}">${x.jenis === 'masuk' ? '+' : '−'}</div>
          <div class="tx"><b>${x.kategori || (x.jenis === 'masuk' ? 'Uang masuk' : 'Pengeluaran')}</b><small>${tgl(x.tanggal)}${x.keterangan ? ' · ' + x.keterangan : ''}</small></div>
          <div class="end"><b style="color:${x.jenis === 'masuk' ? 'var(--green)' : 'var(--red)'}">${x.jenis === 'masuk' ? '+' : '−'}${rp(x.jumlah)}</b></div></button>`)}`
        : html`<div class="empty">${iconKosong}<div>Belum ada catatan di ${namaBulan(periode)}</div></div>`);
    } catch (e) { toast(e.message, 'err'); }
  }

  function formKas(jenis, x) {
    const baru = !x, j = x?.jenis || jenis;
    const sh = sheet(html`
      <div class="chips" id="kat">${KATEGORI[j].map((c) => html`<button type="button" class="chip ${x?.kategori === c ? 'on' : ''}" data-c="${c}">${c}</button>`)}</div>
      <label class="field"><span>Kategori</span><input class="in" id="k_kat" value="${x?.kategori || ''}" placeholder="${j === 'masuk' ? 'Misal: Infaq Jumat' : 'Misal: Gaji guru'}"></label>
      <div class="frow"><label class="field"><span>Jumlah (Rp)</span><input class="in" id="k_jml" inputmode="numeric" value="${x ? num(x.jumlah) : ''}" style="font-weight:800"></label>
        <label class="field"><span>Tanggal</span><input class="in" type="date" id="k_tgl" value="${x?.tanggal || ymd(new Date())}"></label></div>
      <label class="field"><span>Keterangan (opsional)</span><input class="in" id="k_ket" value="${x?.keterangan || ''}"></label>
      <button class="btn ${j === 'masuk' ? 'pri' : 'red'} block" id="k_go">${baru ? 'Simpan' : 'Simpan perubahan'}</button>
      ${baru ? '' : html`<button class="btn red block" id="k_del" style="margin-top:10px">Hapus catatan</button>`}`,
      { title: baru ? (j === 'masuk' ? 'Uang masuk' : 'Pengeluaran') : 'Ubah catatan' });
    fmtInput($('#k_jml', sh.el));
    on(sh.el, 'click', '[data-c]', (e, b) => { $('#k_kat', sh.el).value = b.dataset.c; $$('#kat .chip', sh.el).forEach((c) => c.classList.toggle('on', c === b)); });
    $('#k_go', sh.el).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
      const jml = digits($('#k_jml', sh.el).value);
      if (jml <= 0) throw new Error('Isi jumlahnya.');
      const tanggal = $('#k_tgl', sh.el).value; if (!tanggal) throw new Error('Isi tanggalnya.');
      await db.saveKas({ id: x?.id, jenis: j, jumlah: jml, tanggal, kategori: $('#k_kat', sh.el).value.trim(), keterangan: $('#k_ket', sh.el).value.trim() });
      toast('Tersimpan', 'ok'); sh.close();
      periode = tanggal.slice(0, 7) + '-01'; $('#pl', root).textContent = namaBulan(periode);
      daftar(); ringkas();
    }));
    $('#k_del', sh.el)?.addEventListener('click', async () => {
      if (!(await konfirmasi('Hapus catatan kas ini?', { ya: 'Hapus', merah: true }))) return;
      try { await db.delKas(x.id); toast('Dihapus', 'ok'); sh.close(); daftar(); ringkas(); } catch (er) { toast(er.message, 'err'); }
    });
  }

  on(root, 'click', '[data-p]', (e, b) => { periode = addMonths(periode, Number(b.dataset.p)); $('#pl', root).textContent = namaBulan(periode); daftar(); });
  on(root, 'click', '[data-id]', (e, b) => { if (admin) formKas(null, cat.find((x) => String(x.id) === b.dataset.id)); });
  if (admin) {
    $('#b_masuk', root).addEventListener('click', () => formKas('masuk'));
    $('#b_keluar', root).addEventListener('click', () => formKas('keluar'));
    $('#b_awal', root).addEventListener('click', () => {
      const sh = sheet(html`<p class="muted" style="margin:0 0 12px">Isi uang kas TPQ sebelum memakai aplikasi ini. Cukup diisi sekali.</p>
        <label class="field"><span>Saldo awal (Rp)</span><input class="in" id="sa" inputmode="numeric" style="font-weight:800" value="${num(ctx.st.pengaturan.saldo_awal || 0)}"></label>
        <button class="btn pri block" id="sa_go">Simpan</button>`, { title: 'Saldo awal' });
      fmtInput($('#sa', sh.el));
      $('#sa_go', sh.el).addEventListener('click', (e) => tombolKerja(e.currentTarget, async () => {
        const v = digits($('#sa', sh.el).value);
        await db.savePengaturan({ saldo_awal: v }); ctx.st.pengaturan.saldo_awal = v;
        toast('Saldo awal disimpan', 'ok'); sh.close(); ringkas();
      }));
    });
  }
  ringkas(); daftar();
}
