-- =====================================================================
--  APLIKASI SPP — TPQ NURUL HIDAYAH BATUNG
--  Migrasi 001: struktur database awal
--  Aman dijalankan ulang (pakai IF NOT EXISTS / OR REPLACE).
--  Jalankan di: Supabase → SQL Editor → New query → tempel → Run
-- =====================================================================

-- ---------- 1. PENGATURAN SEKOLAH (satu baris saja) -------------------
create table if not exists public.pengaturan (
  id            int primary key default 1 check (id = 1),
  nama_sekolah  text not null default 'TPQ Nurul Hidayah Batung',
  alamat        text default '',
  no_wa         text default '',
  kepala_sekolah text default '',
  bendahara     text default '',
  spp_default   int  not null default 50000 check (spp_default >= 0),
  tahun_ajaran  text default '2026/2027',
  diubah_pada   timestamptz not null default now()
);
insert into public.pengaturan (id) values (1) on conflict (id) do nothing;

-- ---------- 2. PROFIL PENGGUNA & PERAN ---------------------------------
--  admin   = bendahara/admin: boleh ubah semua
--  kepsek  = kepala sekolah: hanya lihat
--  menunggu = akun baru, belum diberi akses oleh admin
create table if not exists public.profil (
  id     uuid primary key references auth.users(id) on delete cascade,
  nama   text not null default '',
  email  text,
  peran  text not null default 'menunggu' check (peran in ('admin','kepsek','menunggu')),
  dibuat timestamptz not null default now()
);

create or replace function public.peran_saya() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select peran from public.profil where id = auth.uid()), 'tamu');
$$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.peran_saya() = 'admin' $$;
create or replace function public.is_staf() returns boolean
language sql stable as $$ select public.peran_saya() in ('admin','kepsek') $$;

-- Akun pertama yang mendaftar otomatis jadi admin; berikutnya "menunggu".
create or replace function public.buat_profil_baru() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profil (id, nama, email, peran)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(new.email,'@',1)),
    new.email,
    case when exists (select 1 from public.profil where peran = 'admin')
         then 'menunggu' else 'admin' end
  ) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists trg_profil_baru on auth.users;
create trigger trg_profil_baru after insert on auth.users
  for each row execute function public.buat_profil_baru();

-- ---------- 3. KELAS ----------------------------------------------------
create table if not exists public.kelas (
  id          bigint generated always as identity primary key,
  nama        text not null unique,
  nominal_spp int check (nominal_spp is null or nominal_spp >= 0), -- kosong = pakai default
  urutan      int not null default 0,
  dibuat      timestamptz not null default now()
);

-- ---------- 4. SANTRI ---------------------------------------------------
create table if not exists public.santri (
  id            bigint generated always as identity primary key,
  nis           text unique,
  nama          text not null check (length(trim(nama)) > 0),
  kelas_id      bigint references public.kelas(id) on delete set null,
  jenis_kelamin text check (jenis_kelamin in ('L','P')),
  nama_wali     text default '',
  no_wa         text default '',
  alamat        text default '',
  tanggal_masuk date not null default current_date,
  status        text not null default 'aktif'
                check (status in ('aktif','baru','pindahan','lulus','nonaktif')),
  nominal_spp   int check (nominal_spp is null or nominal_spp >= 0), -- kosong = ikut kelas
  catatan       text default '',
  dibuat        timestamptz not null default now(),
  diubah        timestamptz not null default now()
);
create index if not exists idx_santri_kelas  on public.santri(kelas_id);
create index if not exists idx_santri_status on public.santri(status);

-- ---------- 5. TAGIHAN (satu baris per santri per bulan) ----------------
create table if not exists public.tagihan (
  id        bigint generated always as identity primary key,
  santri_id bigint not null references public.santri(id) on delete cascade,
  periode   date   not null check (extract(day from periode) = 1), -- selalu tgl 1
  nominal   int    not null check (nominal >= 0),
  potongan  int    not null default 0 check (potongan >= 0),
  catatan   text default '',
  dibuat    timestamptz not null default now(),
  unique (santri_id, periode)
);
create index if not exists idx_tagihan_periode on public.tagihan(periode);

-- ---------- 6. KUITANSI & RINCIAN PEMBAYARAN ----------------------------
create sequence if not exists public.seq_kuitansi;
create table if not exists public.kuitansi (
  id          bigint generated always as identity primary key,
  nomor       text not null unique,
  santri_id   bigint not null references public.santri(id) on delete restrict,
  tanggal     timestamptz not null default now(),
  total       int not null check (total > 0),
  metode      text not null default 'tunai' check (metode in ('tunai','transfer','lainnya')),
  catatan     text default '',
  dicatat_oleh uuid default auth.uid(),
  dibatalkan  boolean not null default false
);
create index if not exists idx_kuitansi_tanggal on public.kuitansi(tanggal);

create table if not exists public.pembayaran (
  id          bigint generated always as identity primary key,
  kuitansi_id bigint not null references public.kuitansi(id) on delete cascade,
  tagihan_id  bigint not null references public.tagihan(id) on delete restrict,
  jumlah      int not null check (jumlah > 0)
);
create index if not exists idx_bayar_tagihan on public.pembayaran(tagihan_id);

-- ---------- 7. AKTIVITAS (log otomatis) ---------------------------------
create table if not exists public.aktivitas (
  id        bigint generated always as identity primary key,
  waktu     timestamptz not null default now(),
  user_id   uuid default auth.uid(),
  jenis     text not null,   -- bayar, lunas, santri_baru, santri_ubah, tagihan, batal
  pesan     text not null,
  santri_id bigint references public.santri(id) on delete set null,
  nominal   int
);
create index if not exists idx_aktivitas_waktu on public.aktivitas(waktu desc);

-- ---------- 8. VIEW STATUS TAGIHAN --------------------------------------
create or replace view public.v_tagihan with (security_invoker = true) as
select t.id, t.santri_id, s.nama, s.kelas_id, k.nama as kelas, s.status as status_santri,
       t.periode, t.nominal, t.potongan,
       (t.nominal - t.potongan)                                   as harus_bayar,
       coalesce(b.terbayar,0)                                     as terbayar,
       greatest(t.nominal - t.potongan - coalesce(b.terbayar,0),0) as sisa,
       case when coalesce(b.terbayar,0) >= t.nominal - t.potongan then 'lunas'
            when coalesce(b.terbayar,0) > 0 then 'sebagian'
            else 'belum' end                                      as status
from public.tagihan t
join public.santri s on s.id = t.santri_id
left join public.kelas k on k.id = s.kelas_id
left join (
  select p.tagihan_id, sum(p.jumlah) terbayar
  from public.pembayaran p join public.kuitansi q on q.id = p.kuitansi_id
  where not q.dibatalkan group by p.tagihan_id
) b on b.tagihan_id = t.id;

-- ---------- 9. FUNGSI: BUAT TAGIHAN BULANAN -----------------------------
-- Membuat tagihan untuk semua santri aktif/baru/pindahan. Aman diulang.
create or replace function public.buat_tagihan_bulan(p_periode date)
returns int language plpgsql security invoker set search_path = public as $$
declare v_periode date := date_trunc('month', p_periode)::date; v_jml int;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh membuat tagihan'; end if;
  insert into public.tagihan (santri_id, periode, nominal)
  select s.id, v_periode,
         coalesce(s.nominal_spp, k.nominal_spp, (select spp_default from public.pengaturan where id=1))
  from public.santri s left join public.kelas k on k.id = s.kelas_id
  where s.status in ('aktif','baru','pindahan')
    and s.tanggal_masuk < (v_periode + interval '1 month')
  on conflict (santri_id, periode) do nothing;
  get diagnostics v_jml = row_count;
  if v_jml > 0 then
    insert into public.aktivitas (jenis, pesan, nominal)
    values ('tagihan', 'Tagihan ' || to_char(v_periode,'MM/YYYY') || ' dibuat untuk ' || v_jml || ' santri', null);
  end if;
  return v_jml;
end $$;

-- ---------- 10. FUNGSI: CATAT PEMBAYARAN --------------------------------
-- Uang dialokasikan otomatis ke tagihan TERTUA yang belum lunas
-- (melunasi tunggakan dulu). Bisa juga dibatasi ke tagihan tertentu.
create or replace function public.catat_bayar(
  p_santri_id bigint, p_jumlah int, p_metode text default 'tunai',
  p_catatan text default '', p_tagihan_ids bigint[] default null)
returns json language plpgsql security invoker set search_path = public as $$
declare
  v_sisa int := p_jumlah; v_kw bigint; v_nomor text; r record; v_ambil int;
  v_nama text; v_lunas int := 0; v_sebagian boolean := false; v_sisa_utang int;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh mencatat pembayaran'; end if;
  if p_jumlah is null or p_jumlah <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  select nama into v_nama from public.santri where id = p_santri_id;
  if v_nama is null then raise exception 'Santri tidak ditemukan'; end if;

  select coalesce(sum(sisa),0) into v_sisa_utang from public.v_tagihan
   where santri_id = p_santri_id and sisa > 0
     and (p_tagihan_ids is null or id = any(p_tagihan_ids));
  if p_jumlah > v_sisa_utang then
    raise exception 'Jumlah (Rp%) melebihi sisa tagihan (Rp%)', p_jumlah, v_sisa_utang;
  end if;

  v_nomor := 'KW-' || to_char(now() at time zone 'Asia/Makassar','YYMM') || '-'
             || lpad(nextval('public.seq_kuitansi')::text, 4, '0');
  insert into public.kuitansi (nomor, santri_id, total, metode, catatan)
  values (v_nomor, p_santri_id, p_jumlah, coalesce(p_metode,'tunai'), coalesce(p_catatan,''))
  returning id into v_kw;

  for r in select id, sisa, periode from public.v_tagihan
           where santri_id = p_santri_id and sisa > 0
             and (p_tagihan_ids is null or id = any(p_tagihan_ids))
           order by periode loop
    exit when v_sisa <= 0;
    v_ambil := least(v_sisa, r.sisa);
    insert into public.pembayaran (kuitansi_id, tagihan_id, jumlah) values (v_kw, r.id, v_ambil);
    v_sisa := v_sisa - v_ambil;
    if v_ambil = r.sisa then v_lunas := v_lunas + 1; else v_sebagian := true; end if;
  end loop;

  insert into public.aktivitas (jenis, pesan, santri_id, nominal)
  values (case when v_lunas > 0 then 'lunas' else 'bayar' end,
          v_nama || ' membayar SPP Rp' || replace(to_char(p_jumlah,'FM999,999,999'),',','.')
          || case when v_lunas > 0 and v_sebagian then ' (lunas ' || v_lunas || ' bulan + sebagian)'
                  when v_lunas > 1 then ' (melunasi ' || v_lunas || ' bulan)'
                  when v_lunas = 1 then ' (lunas)' else ' (sebagian)' end,
          p_santri_id, p_jumlah);

  return json_build_object('kuitansi_id', v_kw, 'nomor', v_nomor, 'bulan_lunas', v_lunas);
end $$;

-- ---------- 11. FUNGSI: BATALKAN KUITANSI (salah input) -----------------
create or replace function public.batal_kuitansi(p_kuitansi_id bigint, p_alasan text default '')
returns void language plpgsql security invoker set search_path = public as $$
declare v record;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  update public.kuitansi set dibatalkan = true,
         catatan = trim(coalesce(catatan,'') || ' [DIBATALKAN: ' || coalesce(p_alasan,'') || ']')
   where id = p_kuitansi_id and not dibatalkan
   returning nomor, santri_id, total into v;
  if v is null then raise exception 'Kuitansi tidak ditemukan atau sudah dibatalkan'; end if;
  insert into public.aktivitas (jenis, pesan, santri_id, nominal)
  values ('batal', 'Kuitansi ' || v.nomor || ' dibatalkan', v.santri_id, v.total);
end $$;

-- ---------- 12. FUNGSI: RINGKASAN DASHBOARD -----------------------------
create or replace function public.ringkasan_dashboard(p_periode date default current_date)
returns json language sql stable security invoker set search_path = public as $$
  with bln as (select date_trunc('month', p_periode)::date b),
  hari as (select (now() at time zone 'Asia/Makassar')::date h),
  tb as (select v.* from public.v_tagihan v, bln where v.periode = bln.b),
  kw as (select * from public.kuitansi where not dibatalkan)
  select json_build_object(
    'siswa', (select json_build_object(
        'total',    count(*),
        'aktif',    count(*) filter (where status in ('aktif','baru','pindahan')),
        'baru',     count(*) filter (where status = 'baru'),
        'pindahan', count(*) filter (where status = 'pindahan'),
        'lulus',    count(*) filter (where status = 'lulus'),
        'nonaktif', count(*) filter (where status = 'nonaktif')) from public.santri),
    'keuangan', json_build_object(
        'tagihan_bulan_ini', (select coalesce(sum(harus_bayar),0) from tb),
        'bayar_bulan_ini',   (select coalesce(sum(total),0) from kw, bln
                               where date_trunc('month', tanggal at time zone 'Asia/Makassar')::date = bln.b),
        'bayar_hari_ini',    (select coalesce(sum(total),0) from kw, hari
                               where (tanggal at time zone 'Asia/Makassar')::date = hari.h),
        'total_tunggakan',   (select coalesce(sum(sisa),0) from public.v_tagihan, bln where periode <= bln.b),
        'sudah_bayar',       (select count(*) from tb where status = 'lunas'),
        'belum_bayar',       (select count(*) from tb where status = 'belum'),
        'sebagian',          (select count(*) from tb where status = 'sebagian')),
    'grafik_bulanan', (select coalesce(json_agg(x order by x.bulan),'[]') from (
        select to_char(m,'YYYY-MM') bulan,
          (select coalesce(sum(total),0) from kw
            where date_trunc('month', tanggal at time zone 'Asia/Makassar') = m) pemasukan,
          (select coalesce(sum(harus_bayar),0) from public.v_tagihan where periode = m::date) tagihan,
          (select coalesce(sum(sisa),0) from public.v_tagihan where periode = m::date) tunggakan
        from generate_series(date_trunc('month',p_periode) - interval '11 month',
                             date_trunc('month',p_periode), interval '1 month') m) x),
    'per_kelas', (select coalesce(json_agg(y order by y.kelas),'[]') from (
        select coalesce(kelas,'Tanpa kelas') kelas, sum(harus_bayar) tagihan,
               sum(terbayar) terbayar, sum(sisa) sisa
        from tb group by kelas) y)
  );
$$;

-- ---------- 13. TRIGGER AKTIVITAS DATA SANTRI ---------------------------
create or replace function public.log_santri() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user text := coalesce((select nama from public.profil where id = auth.uid()),'Admin');
begin
  if tg_op = 'INSERT' then
    insert into public.aktivitas (jenis, pesan, santri_id)
    values ('santri_baru', v_user || ' menambah santri ' || new.nama, new.id);
  elsif tg_op = 'UPDATE' then
    new.diubah := now();
    insert into public.aktivitas (jenis, pesan, santri_id)
    values ('santri_ubah', v_user || ' mengubah data ' || new.nama
            || case when new.status <> old.status then ' (status: ' || new.status || ')' else '' end, new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_log_santri_ins on public.santri;
drop trigger if exists trg_log_santri_upd on public.santri;
create trigger trg_log_santri_ins after insert on public.santri
  for each row execute function public.log_santri();
create trigger trg_log_santri_upd before update on public.santri
  for each row execute function public.log_santri();

-- ---------- 14. KEAMANAN (RLS) ------------------------------------------
-- Admin: baca + tulis. Kepala sekolah: baca saja. Lainnya: tidak bisa apa-apa.
do $$
declare t text;
begin
  foreach t in array array['pengaturan','kelas','santri','tagihan','kuitansi','pembayaran','aktivitas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staf_baca" on public.%I', t);
    execute format('drop policy if exists "admin_tulis" on public.%I', t);
    execute format('create policy "staf_baca" on public.%I for select to authenticated using (public.is_staf())', t);
    execute format('create policy "admin_tulis" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.profil enable row level security;
drop policy if exists "profil_baca"  on public.profil;
drop policy if exists "profil_admin" on public.profil;
create policy "profil_baca"  on public.profil for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profil_admin" on public.profil for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant usage on sequence public.seq_kuitansi to authenticated;
revoke execute on function public.buat_tagihan_bulan(date) from anon;
revoke execute on function public.catat_bayar(bigint,int,text,text,bigint[]) from anon;
revoke execute on function public.batal_kuitansi(bigint,text) from anon;
revoke execute on function public.ringkasan_dashboard(date) from anon;

-- ---------- 15. REALTIME (dashboard langsung berubah) -------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.kuitansi;  exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.aktivitas; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.santri;    exception when duplicate_object then null; end;
  end if;
end $$;

-- Selesai. Cek: Table Editor harus menampilkan 8 tabel.
