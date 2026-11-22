// Lapisan data: semua bicara ke Supabase lewat sini.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

function gagal(error) {
  let m = error.message || String(error);
  if (/santri_nis_key/.test(m)) m = 'NIS itu sudah dipakai santri lain.';
  else if (/kelas_nama_key/.test(m)) m = 'Nama kelas itu sudah ada.';
  else if (/kuitansi_santri_id_fkey/.test(m)) m = 'Santri ini punya riwayat pembayaran, jadi tidak bisa dihapus. Ubah statusnya menjadi nonaktif saja.';
  else if (/pembayaran_tagihan_id_fkey/.test(m)) m = 'Tagihan ini sudah ada pembayarannya. Batalkan kuitansinya dulu.';
  else if (/row-level security/.test(m)) m = 'Akun Anda tidak punya izin untuk tindakan ini.';
  else if (/Invalid login credentials/.test(m)) m = 'Email atau password salah.';
  else if (/Failed to fetch|NetworkError|Load failed/.test(m)) m = 'Tidak ada koneksi internet.';
  throw new Error(m);
}
const ok = (r) => { if (r.error) gagal(r.error); return r.data; };
const bersih = (o) => {
  const x = { ...o };
  for (const k of Object.keys(x)) if (x[k] === '' || x[k] === undefined) x[k] = null;
  return x;
};

export const db = {
  /* --- akun --- */
  async signIn(email, password) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) gagal(r.error); return r.data; },
  async signOut() { await sb.auth.signOut(); },
  async session() { const { data } = await sb.auth.getSession(); return data.session; },
  onAuth(cb) { return sb.auth.onAuthStateChange((ev, s) => cb(ev, s)); },
  async changePassword(password) { const r = await sb.auth.updateUser({ password }); if (r.error) gagal(r.error); },
  async me() {
    const s = await this.session();
    if (!s) return null;
    const r = await sb.from('profil').select('*').eq('id', s.user.id).maybeSingle();
    if (r.error) gagal(r.error);
    return r.data ? r.data : { id: s.user.id, nama: s.user.email, email: s.user.email, peran: 'tamu' };
  },
  async listProfil() { return ok(await sb.from('profil').select('*').order('dibuat')); },
  async setPeran(id, peran) { ok(await sb.from('profil').update({ peran }).eq('id', id)); },
  async setNamaProfil(id, nama) { ok(await sb.from('profil').update({ nama }).eq('id', id)); },

  /* --- pengaturan & kelas --- */
  async getPengaturan() { return ok(await sb.from('pengaturan').select('*').eq('id', 1).single()); },
  async savePengaturan(p) { ok(await sb.from('pengaturan').update({ ...bersih(p), diubah_pada: new Date().toISOString() }).eq('id', 1)); },
  async listKelas() { return ok(await sb.from('kelas').select('*').order('urutan').order('nama')); },
  async saveKelas(k) {
    const row = bersih({ nama: k.nama, nominal_spp: k.nominal_spp, urutan: Number(k.urutan) || 0 });
    if (k.id) ok(await sb.from('kelas').update(row).eq('id', k.id)); else ok(await sb.from('kelas').insert(row));
  },
  async delKelas(id) { ok(await sb.from('kelas').delete().eq('id', id)); },

  /* --- santri --- */
  async listSantri() { return ok(await sb.from('santri').select('*, kelas(nama)').order('nama')); },
  async saveSantri(s) {
    const { id, kelas, ...rest } = s;
    const row = bersih(rest);
    if (row.nama) row.nama = String(row.nama).trim();
    if (id) ok(await sb.from('santri').update(row).eq('id', id)); else ok(await sb.from('santri').insert(row));
  },
  async insertSantriBanyak(rows) { ok(await sb.from('santri').insert(rows.map(bersih))); },
  async delSantri(id) { ok(await sb.from('santri').delete().eq('id', id)); },

  /* --- tagihan --- */
  async listTagihan(periode) { return ok(await sb.from('v_tagihan').select('*').eq('periode', periode).order('nama')); },
  async tagihanSantri(santriId) { return ok(await sb.from('v_tagihan').select('id,periode,nominal').eq('santri_id', santriId).order('periode')); },
  async tambahTagihan(santriId, periode, nominal) { const r = ok(await sb.from('tagihan').insert({ santri_id: santriId, periode, nominal }).select('id').single()); return r.id; },
  async buatTagihan(periode) { return ok(await sb.rpc('buat_tagihan_bulan', { p_periode: periode })); },
  async saveTagihan(id, patch) { ok(await sb.from('tagihan').update(bersih(patch)).eq('id', id)); },
  async delTagihan(id) { ok(await sb.from('tagihan').delete().eq('id', id)); },
  async listTagihanBuka(santriId) { return ok(await sb.from('v_tagihan').select('*').eq('santri_id', santriId).gt('sisa', 0).order('periode')); },
  async listTunggakan(sampai) { return ok(await sb.from('v_tagihan').select('*').gt('sisa', 0).lte('periode', sampai).order('periode')); },
  async tagihanRange(dari, sampai) { return ok(await sb.from('v_tagihan').select('*').gte('periode', dari).lte('periode', sampai)); },

  /* --- pembayaran & kuitansi --- */
  async bayar({ santriId, jumlah, metode, catatan, tagihanIds }) {
    return ok(await sb.rpc('catat_bayar', { p_santri_id: santriId, p_jumlah: jumlah, p_metode: metode, p_catatan: catatan || '', p_tagihan_ids: tagihanIds && tagihanIds.length ? tagihanIds : null }));
  },
  async listKuitansi(limit = 60) { return ok(await sb.from('kuitansi').select('*, santri(nama,no_wa,kelas(nama))').order('tanggal', { ascending: false }).limit(limit)); },
  async getKuitansi(id) { return ok(await sb.from('kuitansi').select('*, santri(nama,no_wa,nis,kelas(nama)), pembayaran(jumlah, tagihan(periode))').eq('id', id).single()); },
  async batalKuitansi(id, alasan) { ok(await sb.rpc('batal_kuitansi', { p_kuitansi_id: id, p_alasan: alasan || '' })); },
  async hapusKuitansi(id) { ok(await sb.from('kuitansi').delete().eq('id', id).eq('dibatalkan', true)); },
  async bayarSemua() { return ok(await sb.from('kuitansi').select('tanggal,total').eq('dibatalkan', false)); },
  async kuitansiRange(dari, sampai) {
    return ok(await sb.from('kuitansi').select('*, santri(nama,kelas(nama))').gte('tanggal', dari).lt('tanggal', sampai).eq('dibatalkan', false).order('tanggal'));
  },

  /* --- dashboard --- */
  async ringkasan(periode) { return ok(await sb.rpc('ringkasan_dashboard', { p_periode: periode })); },
  async hapusAktivitas() { ok(await sb.from('aktivitas').delete().gt('id', 0)); },
  async listAktivitas(n = 20) { return ok(await sb.from('aktivitas').select('*').order('waktu', { ascending: false }).limit(n)); },
  subscribe(cb) {
    const ch = sb.channel('tpq-live');
    for (const t of ['kuitansi', 'aktivitas', 'santri']) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t));
    ch.subscribe();
    return () => sb.removeChannel(ch);
  },
};
