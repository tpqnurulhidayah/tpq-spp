// Helper tampilan: templat aman, format, angka slot, lembar bawah, toast, grafik SVG.

class Raw { constructor(s) { this.s = s; } }
export const raw = (s) => new Raw(s);
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
const one = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(one).join('') : esc(v));
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += one(vals[i]); });
  return new Raw(out);
}
export const mount = (el, r) => { el.innerHTML = r.s; return el; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function on(root, type, sel, fn) {
  root.addEventListener(type, (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
}

/* ---------- Format ---------- */
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
export const num = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID');
export function rpShort(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.', ',') + 'jt';
  if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
  return String(n);
}
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const periodeOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
export function addMonths(periode, n) {
  const [y, m] = periode.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return periodeOf(d);
}
export const namaBulan = (periode, pendek = false) => {
  const [y, m] = periode.split('-').map(Number);
  return (pendek ? BULAN[m - 1].slice(0, 3) : BULAN[m - 1]) + ' ' + y;
};
export const tgl = (v) => {
  const d = new Date(v);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
export const jam = (v) => { const d = new Date(v); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; };
export function ago(v) {
  const d = new Date(v), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d >= today) return 'hari ini ' + jam(d);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d >= yest) return 'kemarin ' + jam(d);
  return tgl(d) + ' ' + jam(d);
}
export const inisial = (s) => (String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
export const debounce = (fn, ms = 160) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const SAT = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function tb(n) {
  if (n < 12) return SAT[n];
  if (n < 20) return tb(n - 10) + ' belas';
  if (n < 100) return tb(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + tb(n % 10) : '');
  if (n < 200) return 'seratus' + (n > 100 ? ' ' + tb(n - 100) : '');
  if (n < 1000) return tb(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + tb(n % 100) : '');
  if (n < 2000) return 'seribu' + (n > 1000 ? ' ' + tb(n - 1000) : '');
  if (n < 1e6) return tb(Math.floor(n / 1e3)) + ' ribu' + (n % 1e3 ? ' ' + tb(n % 1e3) : '');
  if (n < 1e9) return tb(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + tb(n % 1e6) : '');
  return tb(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + tb(n % 1e9) : '');
}
export const terbilang = (n) => { const t = tb(Math.floor(Number(n) || 0)) + ' rupiah'; return t[0].toUpperCase() + t.slice(1); };
export const waNomor = (s) => { let n = String(s || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); return n; };
export const waLink = (no, teks) => `https://wa.me/${waNomor(no)}?text=${encodeURIComponent(teks)}`;

/* ---------- Angka slot (gulungan angka) ---------- */
// Kecilkan huruf angka bila tidak muat di kotaknya
export function fit(el) {
  el.style.fontSize = '';
  const p = el.parentElement; if (!p) return;
  const cs = getComputedStyle(p);
  const avail = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  let fs = parseFloat(getComputedStyle(el).fontSize), n = 0;
  while (el.scrollWidth > avail + 0.5 && fs > 11 && n++ < 30) { fs -= 1; el.style.fontSize = fs + 'px'; }
}
export function slot(el, value, { prefix = '', dur = 1 } = {}) {
  const text = Math.round(Number(value) || 0).toLocaleString('id-ID');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const key = prefix + '|' + text.replace(/\d/g, '0');
  if (el._key !== key) {
    el._key = key;
    let h = prefix ? `<span class="st">${esc(prefix)}</span>` : '';
    let k = 0;
    for (const ch of text) {
      if (/\d/.test(ch)) h += `<span class="reel"><span class="col" style="--d:${k++}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<i>${d}</i>`).join('')}</span></span>`;
      else h += `<span class="st">${esc(ch)}</span>`;
    }
    el.className = (el.className.replace(/\bslot\b/g, '') + ' slot num').trim();
    el.innerHTML = h;
    el.getBoundingClientRect();
  }
  fit(el);
  const cols = el.querySelectorAll('.col');
  let i = 0;
  for (const ch of text) {
    if (/\d/.test(ch)) {
      const c = cols[i++];
      if (reduce) c.style.transition = 'none';
      else c.style.transitionDuration = dur + 's';
      c.style.transform = `translateY(${-Number(ch) * 1.15}em)`;
    }
  }
}

/* ---------- Toast, lembar bawah, dialog ---------- */
export function toast(msg, tipe = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + tipe;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 600); }, tipe === 'err' ? 4200 : 2400);
}
export function sheet(content, { title = '' } = {}) {
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<div class="sheet"><div class="grab"></div><div class="sh-hd"><h2>${esc(title)}</h2><button class="sh-x" type="button" aria-label="Tutup"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="sb"></div></div>`;
  const sb = ov.querySelector('.sb');
  if (content instanceof Raw) sb.innerHTML = content.s; else if (content) sb.appendChild(content);
  document.body.appendChild(ov);
  requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('in')));
  const close = () => { ov.classList.remove('in'); document.body.classList.remove('ps'); setTimeout(() => ov.remove(), 600); };
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('.sh-x')) close(); });
  return { el: sb, close, ov };
}
export function konfirmasi(teks, { ya = 'Ya', merah = false } = {}) {
  return new Promise((res) => {
    const ov = document.createElement('div');
    ov.className = 'ov c';
    ov.innerHTML = `<div class="dlg"><p style="font-weight:700;margin-bottom:18px">${esc(teks)}</p><div class="row"><button class="btn sp" data-x="0">Batal</button><button class="btn sp ${merah ? 'red' : 'pri'}" data-x="1">${esc(ya)}</button></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('in')));
    const end = (v) => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 500); res(v); };
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) end(b.dataset.x === '1'); else if (e.target === ov) end(false); });
  });
}
export const tickSvg = () => raw('<svg class="tick" viewBox="0 0 92 92"><circle cx="46" cy="46" r="40"/><path pathLength="1" d="M28 48 L41 61 L66 34"/></svg>');
export const iconKosong = raw('<svg viewBox="0 0 48 48"><rect x="8" y="10" width="32" height="28" rx="6"/><path d="M16 20h16M16 27h10"/></svg>');
export async function tombolKerja(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true; btn.classList.add('load');
  try { return await fn(); } catch (e) { toast(e.message || String(e), 'err'); } finally { btn.disabled = false; btn.classList.remove('load'); }
}
export const stagger = (root) => $$('.rise', root).forEach((e, i) => e.style.setProperty('--i', i));

/* ---------- Grafik SVG ---------- */
function nice(max) {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
export function barChart(data, { warna = 'var(--green)', fmt = rpShort, grad = 'gbar' } = {}) {
  const W = 340, H = 190, L = 6, R = 6, T = 14, B = 24;
  const max = nice(Math.max(...data.map((d) => d.v), 1));
  const n = data.length, step = (W - L - R) / n, bw = Math.min(26, step * 0.62);
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const y = T + ((H - T - B) * i) / 3;
    g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>`;
    if (i < 3) g += `<text x="${L + 2}" y="${y - 3}" style="text-anchor:start">${fmt(max - (max * i) / 3)}</text>`;
  }
  let bars = '';
  data.forEach((d, i) => {
    const h = Math.max(d.v > 0 ? 3 : 0, ((H - T - B) * d.v) / max);
    const x = L + step * i + (step - bw) / 2, y = H - B - h;
    bars += `<rect class="bar" data-tip="${esc(d.t || d.l)}: ${esc(d.f ?? rp(d.v))}" style="--i:${i}" x="${x}" y="${y}" width="${bw}" height="${h}" rx="${Math.min(7, bw / 2)}" fill="url(#${grad})"/>`;
    bars += `<text x="${x + bw / 2}" y="${H - 8}">${esc(d.l)}</text>`;
  });
  return raw(`<svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3DBB6D"/><stop offset="1" stop-color="#0B6E36"/></linearGradient></defs>${g}${bars}</svg>`);
}
export function lineChart(labels, series) {
  const W = 340, H = 190, L = 6, R = 10, T = 14, B = 24;
  const max = nice(Math.max(...series.flatMap((s) => s.v), 1));
  const n = labels.length, step = (W - L - R) / Math.max(n - 1, 1);
  const px = (i) => L + step * i, py = (v) => H - B - ((H - T - B) * v) / max;
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const y = T + ((H - T - B) * i) / 3;
    g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L + 2}" y="${y - 3}" style="text-anchor:start">${rpShort(max - (max * i) / 3)}</text>`;
  }
  const xl = labels.map((l, i) => `<text x="${px(i)}" y="${H - 8}">${esc(l)}</text>`).join('');
  const path = (vals) => {
    const pts = vals.map((v, i) => [px(i), py(v)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return d;
  };
  const lines = series.map((s) => `<path class="lineP" pathLength="1" d="${path(s.v)}" stroke="${s.c}"/>`).join('');
  const dots = series.map((s) => s.v.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="3" fill="${s.c}"/>`).join('')).join('');
  return raw(`<svg viewBox="0 0 ${W} ${H}">${g}${xl}${lines}${dots}</svg>`);
}
