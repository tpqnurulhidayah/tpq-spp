// Pintu masuk aplikasi: splash, login, shell, navigasi
import { db } from './db.js';
import { html, raw, mount, $, $$, on, sheet, toast, tombolKerja, inisial, esc } from './ui.js';
import { beranda, santri } from './pages1.js';
import { tagihan, bayar, tunggakan, kuitansi, laporan, pengaturan } from './pages2.js';

const app = document.getElementById('app');
const splash = document.getElementById('splash');
const t0 = performance.now();
const st = { pengaturan: { nama_sekolah: 'TPQ Nurul Hidayah Batung' }, kelas: [] };
let me = null, cleanup = null, unAuth = null;

const IC = {
  beranda: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  santri: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.4 3.4 0 010 6.4M18 14.8c1.9.7 3.2 2.4 3.5 5.2"/>',
  bayar: '<rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 12h.01M17.5 12h.01"/>',
  tagihan: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  laporan: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
const NAMA = { beranda: 'Beranda', santri: 'Data Santri', bayar: 'Catat Pembayaran', tagihan: 'Tagihan SPP', tunggakan: 'Tunggakan', kuitansi: 'Kuitansi', laporan: 'Laporan Keuangan', pengaturan: 'Pengaturan' };
const HALAMAN = { beranda, santri, bayar, tagihan, tunggakan, kuitansi, laporan, pengaturan };

const admin = () => me?.peran === 'admin';
const navItems = () => admin()
  ? ['beranda', 'santri', 'bayar', 'tagihan', 'menu']
  : ['beranda', 'santri', 'laporan', 'tagihan', 'menu'];

function tutupSplash() {
  const sisa = Math.max(0, 1900 - (performance.now() - t0));
  setTimeout(() => { splash.classList.add('done'); setTimeout(() => splash.remove(), 700); }, sisa);
}

const parse = () => {
  const [path, q = ''] = (location.hash || '#/beranda').slice(2).split('?');
  return { nama: HALAMAN[path] ? path : 'beranda', params: Object.fromEntries(new URLSearchParams(q)) };
};
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

/* ---------- Login ---------- */
function tampilLogin(pesan = '') {
  cleanup?.(); cleanup = null;
  const email = (() => { try { return localStorage.getItem('spp_email') || ''; } catch { return ''; } })();
  mount(app, html`<form class="login" id="f" autocomplete="on">
    <div class="logo-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="1"/></svg><img src="assets/logo.png" alt="Logo TPQ"></div>
    <h1>SPP TPQ Nurul Hidayah</h1><p class="sub">Masuk untuk mengelola SPP</p>
    ${pesan ? html`<div class="err-box" id="er">${pesan}</div>` : html`<div id="er"></div>`}
    <label class="field"><span>Email</span><input class="in" id="em" type="email" autocomplete="username" inputmode="email" value="${email}" required></label>
    <label class="field"><span>Password</span><input class="in" id="pw" type="password" autocomplete="current-password" required></label>
    <button class="btn pri block" type="submit" id="go">Masuk</button></form>`);
  const f = $('#f', app);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const em = $('#em', app).value.trim(), pw = $('#pw', app).value;
    const box = $('#er', app);
    try {
      await tombolKerja($('#go', app), async () => { await db.signIn(em, pw); });
      try { localStorage.setItem('spp_email', em); } catch {}
      await mulai();
    } catch (er) {
      box.className = 'err-box'; box.textContent = er.message || 'Gagal masuk.';
    }
  });
}

function tampilMenunggu() {
  cleanup?.(); cleanup = null;
  mount(app, html`<div class="login"><div class="logo-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="1"/></svg><img src="assets/logo.png" alt=""></div>
    <h1>Akun belum diaktifkan</h1><p class="sub">${me.email}<br>Minta admin mengaktifkan akun Anda, lalu coba lagi.</p>
    <button class="btn pri block" id="cb">Cek lagi</button><button class="btn block" id="lo" style="margin-top:10px">Keluar</button></div>`);
  $('#cb', app).addEventListener('click', () => mulai());
  $('#lo', app).addEventListener('click', keluar);
}

async function keluar() {
  await db.signOut(); me = null; location.hash = '#/beranda'; tampilLogin();
}

/* ---------- Shell ---------- */
function bangunShell() {
  const items = navItems();
  mount(app, html`<div class="shell"><div class="topbar"><div class="lg"><img src="assets/logo.png" alt=""></div>
      <div class="tt"><small id="sk"></small><b id="jd"></b></div><button class="avatar" id="av" aria-label="Akun">${inisial(me.nama)}</button></div>
    <main id="isi"></main></div>
    <nav class="nav"><div class="ind"></div>${items.map((k) => html`<button data-n="${k}"><svg viewBox="0 0 24 24">${raw(IC[k])}</svg><span>${k === 'menu' ? 'Menu' : k[0].toUpperCase() + k.slice(1)}</span></button>`)}</nav>`);
  refreshHeader();
  on(app, 'click', '[data-n]', (e, b) => { if (b.dataset.n === 'menu') menu(); else go('#/' + b.dataset.n); });
  $('#av', app).addEventListener('click', akun);
}

function refreshHeader() {
  const sk = $('#sk', app); if (sk) sk.textContent = st.pengaturan.nama_sekolah;
}

function menu() {
  const k = admin() ? ['tunggakan', 'kuitansi', 'laporan', 'pengaturan'] : ['tunggakan', 'kuitansi', 'pengaturan'];
  const sh = sheet(html`<div class="list">${k.map((x) => html`<button class="item" data-m="${x}"><div class="tx"><b>${NAMA[x]}</b></div><div class="end muted">›</div></button>`)}
    <button class="item" data-m="keluar"><div class="tx"><b style="color:var(--red)">Keluar</b></div></button></div>`, { title: 'Menu' });
  on(sh.el, 'click', '[data-m]', (e, b) => { sh.close(); if (b.dataset.m === 'keluar') keluar(); else go('#/' + b.dataset.m); });
}

function akun() {
  const sh = sheet(html`<div style="text-align:center;margin-bottom:14px"><div class="avatar" style="margin:0 auto 10px;width:64px;height:64px;font-size:22px;cursor:default">${inisial(me.nama)}</div><b style="font-size:17px">${me.nama}</b><div class="muted">${me.email}</div><span class="badge ok" style="margin-top:8px">${admin() ? 'Admin' : 'Kepala sekolah'}</span></div>
    <button class="btn red block" id="lo">Keluar</button>`, { title: 'Akun' });
  $('#lo', sh.el).addEventListener('click', () => { sh.close(); keluar(); });
}

/* ---------- Router ---------- */
let rid = 0;
async function route() {
  if (!me || !$('#isi', app)) return;
  const { nama, params } = parse();
  const my = ++rid;
  try { cleanup?.(); } catch {}
  cleanup = null;
  const items = navItems();
  const idx = items.indexOf(nama);
  const pos = idx >= 0 ? idx : items.indexOf('menu');
  const ind = $('.ind', app); if (ind) ind.style.transform = `translateX(${pos * 100}%)`;
  $$('.nav button', app).forEach((b, i) => b.classList.toggle('on', i === pos));
  $('#jd', app).textContent = NAMA[nama];
  const root = $('#isi', app);
  root.innerHTML = '';
  window.scrollTo(0, 0);
  const ctx = { db, admin: admin(), st, go, params, me, refreshHeader, reloadKelas: async () => { st.kelas = await db.listKelas(); } };
  try {
    const c = await HALAMAN[nama](root, ctx);
    if (my !== rid) { try { c?.(); } catch {} return; }
    cleanup = typeof c === 'function' ? c : null;
  } catch (e) {
    root.innerHTML = '';
    toast(e.message || 'Terjadi kesalahan', 'err');
  }
}

/* ---------- Boot ---------- */
async function mulai() {
  let s;
  try { s = await db.session(); } catch { s = null; }
  if (!s) { tampilLogin(); tutupSplash(); return; }
  try { me = await db.me(); } catch (e) { me = null; tampilLogin(e.message); tutupSplash(); return; }
  if (!['admin', 'kepsek'].includes(me.peran)) { tampilMenunggu(); tutupSplash(); return; }
  try {
    const [p, k] = await Promise.all([db.getPengaturan(), db.listKelas()]);
    st.pengaturan = p; st.kelas = k;
  } catch (e) { toast(e.message, 'err'); }
  bangunShell();
  await route();
  tutupSplash();
}

window.addEventListener('hashchange', route);
unAuth = db.onAuth((ev) => { if (ev === 'SIGNED_OUT' && me) { me = null; tampilLogin(); } });
mulai();
