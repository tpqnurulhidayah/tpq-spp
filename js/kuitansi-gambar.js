// Menggambar kuitansi ke kanvas (PNG tajam) agar bisa disimpan sebagai gambar
import { rp, tgl, jam, namaBulan, terbilang } from './ui.js';

const F = '"Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
const HIJAU = '#169B4B', HIJAU_TUA = '#0B6E36', MERAH = '#D2453A', ABU = '#5B6B62', HITAM = '#14201A';

const muatGambar = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// Pecah teks menjadi beberapa baris sesuai lebar
function bungkus(ctx, teks, lebar) {
  const kata = String(teks).split(/\s+/); const baris = []; let b = '';
  for (const k of kata) {
    const coba = b ? b + ' ' + k : k;
    if (ctx.measureText(coba).width <= lebar || !b) b = coba; else { baris.push(b); b = k; }
  }
  if (b) baris.push(b);
  return baris;
}

export async function gambarKuitansi(k, P) {
  try { await Promise.all([document.fonts.load(`800 40px ${F}`), document.fonts.load(`600 30px ${F}`), document.fonts.load(`italic 500 28px ${F}`)]); } catch { /* pakai huruf cadangan */ }
  const logo = await muatGambar('assets/logo.png');
  const W = 1080, M = 72, IN = W - M * 2;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const bln = (k.pembayaran || []).slice().sort((a, b) => a.tagihan.periode.localeCompare(b.tagihan.periode));

  // Ukur dulu tinggi seluruh isi, lalu gambar
  const LBL = 290, VX = M + LBL, VW = IN - LBL;
  const baris = [
    ['No. kuitansi', [{ t: k.nomor, b: true }]],
    ['Tanggal', [{ t: `${tgl(k.tanggal)}, pukul ${jam(k.tanggal)}` }]],
    ['Diterima dari', [{ t: k.santri.nama + (k.santri.kelas?.nama ? ` (${k.santri.kelas.nama})` : ''), b: true }]],
    ['Untuk', bln.map((x) => ({ t: 'SPP ' + namaBulan(x.tagihan.periode), r: rp(x.jumlah) }))],
    ['Metode', [{ t: k.metode[0].toUpperCase() + k.metode.slice(1) }]],
  ];
  if (k.catatan) baris.push(['Catatan', [{ t: k.catatan }]]);

  const draw = (gambar) => {
    let y = M;
    const teks = (t, x, yy, f, warna = HITAM, al = 'left') => { if (gambar) { ctx.font = f; ctx.fillStyle = warna; ctx.textAlign = al; ctx.fillText(t, x, yy); } };
    // kepala
    const LG = 150;
    if (gambar && logo) ctx.drawImage(logo, M, y, LG, LG);
    const tx = M + LG + 32, tw = W - M - tx;
    ctx.font = `800 44px ${F}`;
    const nm = bungkus(ctx, P.nama_sekolah, tw);
    ctx.font = `500 27px ${F}`;
    const al = bungkus(ctx, [P.alamat, P.no_wa ? 'WA ' + P.no_wa : ''].filter(Boolean).join(' · '), tw);
    const tinggiTeks = 44 + (nm.length - 1) * 54 + 8 + al.length * 38;
    let ty = y + Math.max(0, (LG - tinggiTeks) / 2) + 40;
    nm.forEach((s, i) => { if (i) ty += 54; teks(s, tx, ty, `800 44px ${F}`, HIJAU_TUA); });
    ty += 8;
    al.forEach((s) => { ty += 38; teks(s, tx, ty, `500 27px ${F}`, ABU); });
    y += Math.max(LG, tinggiTeks + 10) + 30;
    if (gambar) { ctx.fillStyle = HIJAU; ctx.fillRect(M, y, IN, 6); }
    y += 6 + 62;
    // judul
    if (gambar) {
      ctx.font = `800 38px ${F}`; ctx.fillStyle = HITAM; ctx.textAlign = 'left';
      const judul = 'KUITANSI PEMBAYARAN', sp = 7;
      const lebar = [...judul].reduce((a, ch) => a + ctx.measureText(ch).width + sp, -sp);
      let x = (W - lebar) / 2;
      for (const ch of judul) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + sp; }
    }
    y += 56;
    // baris isi
    for (const [lbl, isi] of baris) {
      const y0 = y;
      let yy = y + 34;
      for (const it of isi) {
        ctx.font = `${it.b ? 700 : 500} 31px ${F}`;
        const lebarNilai = it.r ? VW - ctx.measureText(it.r).width - 24 : VW;
        const pecah = bungkus(ctx, it.t, lebarNilai);
        pecah.forEach((s, i) => { teks(s, VX, yy, `${it.b ? 700 : 500} 31px ${F}`); if (it.r && i === 0) teks(it.r, W - M, yy, `700 31px ${F}`, HITAM, 'right'); yy += 44; });
      }
      teks(lbl, M, y0 + 34, `500 29px ${F}`, ABU);
      y = yy + 8;
    }
    // total
    y += 10;
    if (gambar) { ctx.strokeStyle = '#9AA69F'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); ctx.setLineDash([]); }
    y += 62;
    teks('Total', M, y, `800 40px ${F}`);
    teks(rp(k.total), W - M, y, `800 44px ${F}`, HIJAU_TUA, 'right');
    y += 20;
    ctx.font = `italic 500 28px ${F}`;
    bungkus(ctx, terbilang(k.total), IN).forEach((s) => { y += 42; teks(s, M, y, `italic 500 28px ${F}`, '#3D4A43'); });
    // tanda tangan + stempel
    y += 80;
    const kiri = M + IN * 0.2, kanan = W - M - IN * 0.2, ttdY = y;
    teks('Penyetor', kiri, y, `600 29px ${F}`, ABU, 'center');
    teks('Bendahara', kanan, y, `600 29px ${F}`, ABU, 'center');
    y += 185;
    ctx.font = `700 29px ${F}`;
    const n1 = bungkus(ctx, `( ${k.santri.nama} )`, IN * 0.4), n2 = bungkus(ctx, `( ${P.bendahara || '..............'} )`, IN * 0.4);
    for (let i = 0; i < Math.max(n1.length, n2.length); i++) {
      if (n1[i]) teks(n1[i], kiri, y, `700 29px ${F}`, HITAM, 'center');
      if (n2[i]) teks(n2[i], kanan, y, `700 29px ${F}`, HITAM, 'center');
      y += 40;
    }
    if (gambar) {
      const warna = k.dibatalkan ? MERAH : HIJAU, label = k.dibatalkan ? 'DIBATALKAN' : 'DITERIMA';
      ctx.save(); ctx.translate(kanan, ttdY + 82); ctx.rotate(-0.2); ctx.globalAlpha = 0.88;
      ctx.font = `800 40px ${F}`; const lw = ctx.measureText(label).width + 56;
      ctx.strokeStyle = warna; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-lw / 2, -38, lw, 76, 14) : ctx.rect(-lw / 2, -38, lw, 76); ctx.stroke();
      ctx.fillStyle = warna; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    }
    // kaki
    y += 40;
    if (gambar) { ctx.fillStyle = '#E4EBE8'; ctx.fillRect(M, y, IN, 2); }
    y += 46;
    teks(`Dibuat dari Aplikasi SPP ${P.nama_sekolah}`, W / 2, y, `500 24px ${F}`, '#8A978F', 'center');
    return y + M - 10;
  };

  const H = Math.ceil(draw(false));
  c.width = W; c.height = H;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = HIJAU; ctx.fillRect(0, 0, W, 14);
  draw(true);
  return c;
}

export const keBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));
