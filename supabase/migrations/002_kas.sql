-- 002: Kas TPQ (uang masuk lain + pengeluaran + saldo awal)
alter table public.pengaturan add column if not exists saldo_awal int not null default 0;

create table if not exists public.kas (
  id         bigint generated always as identity primary key,
  tanggal    date   not null default current_date,
  jenis      text   not null check (jenis in ('masuk','keluar')),
  jumlah     int    not null check (jumlah > 0),
  kategori   text   not null default '',
  keterangan text   default '',
  user_id    uuid   default auth.uid(),
  dibuat     timestamptz not null default now()
);
create index if not exists idx_kas_tanggal on public.kas(tanggal);

alter table public.kas enable row level security;
drop policy if exists "staf_baca" on public.kas;
drop policy if exists "admin_tulis" on public.kas;
create policy "staf_baca" on public.kas for select to authenticated using (public.is_staf());
create policy "admin_tulis" on public.kas for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.kas to authenticated;

-- Catat ke aktivitas
create or replace function public.log_kas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user text := coalesce((select nama from public.profil where id = auth.uid()),'Admin');
        v_rp text;
begin
  if tg_op = 'INSERT' then
    v_rp := 'Rp' || replace(to_char(new.jumlah,'FM999,999,999,999'),',','.');
    insert into public.aktivitas (jenis, pesan, nominal)
    values ('kas', v_user || case when new.jenis = 'masuk' then ' mencatat uang masuk ' else ' mencatat pengeluaran ' end
            || v_rp || case when new.kategori <> '' then ' (' || new.kategori || ')' else '' end, new.jumlah);
  end if;
  return new;
end $$;
drop trigger if exists trg_log_kas on public.kas;
create trigger trg_log_kas after insert on public.kas for each row execute function public.log_kas();

-- Ringkasan saldo kas
create or replace function public.ringkasan_kas()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'saldo_awal', (select saldo_awal from public.pengaturan where id = 1),
    'spp_masuk',  coalesce((select sum(total) from public.kuitansi where not dibatalkan), 0),
    'masuk_lain', coalesce((select sum(jumlah) from public.kas where jenis = 'masuk'), 0),
    'keluar',     coalesce((select sum(jumlah) from public.kas where jenis = 'keluar'), 0),
    'saldo',      (select saldo_awal from public.pengaturan where id = 1)
                  + coalesce((select sum(total) from public.kuitansi where not dibatalkan), 0)
                  + coalesce((select sum(jumlah) from public.kas where jenis = 'masuk'), 0)
                  - coalesce((select sum(jumlah) from public.kas where jenis = 'keluar'), 0)
  );
$$;
grant execute on function public.ringkasan_kas() to authenticated;
revoke execute on function public.ringkasan_kas() from anon;
