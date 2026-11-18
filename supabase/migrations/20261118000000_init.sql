-- NIGORA — schéma initial
-- Voyageurs, trajets, alertes, profil médical (avec consentements), organisations (B2B) et partenaires.

create extension if not exists pgcrypto;

-- ============ Profils ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ Organisations (clients B2B) ============
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'transport' check (kind in ('transport', 'entreprise', 'ong')),
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  plan text not null default 'pilote',
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid references public.organizations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'traveler' check (role in ('admin', 'dispatcher', 'traveler')),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  plate text not null,
  label text,
  capacity int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, plate)
);

-- ============ Partenaires (autorités, secours, hôpitaux) ============
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('autorite', 'secours', 'hopital')),
  region text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.partner_members (
  partner_id uuid references public.partners on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key (partner_id, user_id)
);

-- ============ Données voyageur ============
create table public.trusted_contacts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  phone text not null,
  relation text,
  notify_on_trip boolean not null default true,
  notify_on_sos boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.medical_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text,
  birth_year text,
  blood_group text,
  allergies text,
  conditions text,
  treatments text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  consent_share_in_sos boolean not null default false,
  consent_show_on_card boolean not null default false,
  consent_share_with_partners boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  org_id uuid references public.organizations on delete set null,
  from_place text not null,
  to_place text not null,
  departure_at timestamptz not null,
  eta_at timestamptz not null,
  transport text,
  company text,
  vehicle_plate text,
  notes text,
  status text not null default 'planned' check (status in ('planned', 'active', 'arrived', 'overdue', 'cancelled')),
  tracking boolean not null default false,
  share_token text unique,
  last_lat double precision,
  last_lng double precision,
  last_position_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_org_idx on public.trips (org_id, status);

create table public.positions (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy int,
  recorded_at timestamptz not null,
  unique (trip_id, recorded_at)
);

create table public.alerts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  org_id uuid references public.organizations on delete set null,
  trip_id uuid references public.trips on delete set null,
  kind text not null check (kind in ('accident', 'panne', 'malaise', 'agression', 'autre')),
  message text,
  lat double precision,
  lng double precision,
  accuracy int,
  position_at timestamptz,
  position_is_last_known boolean not null default false,
  include_medical boolean not null default false,
  channels text[] not null default '{}',
  status text not null default 'sent' check (status in ('pending', 'sent', 'received', 'in_progress', 'closed', 'cancelled')),
  handled_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index alerts_org_idx on public.alerts (org_id, status);
create index alerts_status_idx on public.alerts (status, created_at desc);

create table public.alert_events (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.alerts on delete cascade,
  actor_id uuid references auth.users,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Annuaire des services d'assistance (validé pendant le pilote)
create table public.service_directory (
  id text primary key,
  name text not null,
  category text not null check (category in ('urgence', 'hopital', 'sang', 'assistance')),
  city text not null,
  phone text,
  description text,
  lat double precision,
  lng double precision,
  verified boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ============ Fonctions utilitaires ============
create or replace function public.is_org_staff(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members where org_id = p_org and user_id = auth.uid() and role in ('admin', 'dispatcher'));
$$;

create or replace function public.is_partner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from partner_members where user_id = auth.uid());
$$;

-- Rattache automatiquement trajets et alertes à l'organisation du voyageur
create or replace function public.set_org_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from org_members where user_id = new.user_id order by joined_at limit 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trips_set_org before insert or update on public.trips for each row execute function public.set_org_id();
create trigger alerts_set_org before insert or update on public.alerts for each row execute function public.set_org_id();

-- Une resynchronisation tardive du téléphone ne doit pas annuler une prise en charge par les secours
create or replace function public.protect_alert_status() returns trigger
language plpgsql as $$
begin
  if old.status in ('received', 'in_progress') and new.status in ('pending', 'sent') then
    new.status := old.status;
  end if;
  return new;
end $$;
create trigger alerts_protect_status before update on public.alerts for each row execute function public.protect_alert_status();

-- Journalise chaque changement de statut d'alerte
create or replace function public.log_alert_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into alert_events (alert_id, actor_id, status) values (new.id, auth.uid(), new.status);
  end if;
  return new;
end $$;
create trigger alerts_log after insert or update on public.alerts for each row execute function public.log_alert_status();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.vehicles enable row level security;
alter table public.partners enable row level security;
alter table public.partner_members enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.medical_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.positions enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.service_directory enable row level security;

create policy "profil : soi-même" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "org : membres" on public.organizations for select using (exists (select 1 from org_members m where m.org_id = id and m.user_id = auth.uid()));
create policy "org_members : soi ou staff" on public.org_members for select using (user_id = auth.uid() or public.is_org_staff(org_id));
create policy "org_members : quitter" on public.org_members for delete using (user_id = auth.uid() or public.is_org_staff(org_id));

create policy "vehicules : membres lisent" on public.vehicles for select using (exists (select 1 from org_members m where m.org_id = vehicles.org_id and m.user_id = auth.uid()));
create policy "vehicules : staff gère" on public.vehicles for all using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

create policy "partenaires : membres" on public.partners for select using (exists (select 1 from partner_members pm where pm.partner_id = id and pm.user_id = auth.uid()));
create policy "partner_members : soi" on public.partner_members for select using (user_id = auth.uid());

create policy "contacts : propriétaire" on public.trusted_contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Le profil médical n'est lisible que par son propriétaire ; les partenaires y accèdent via partner_alerts(), selon le consentement
create policy "médical : propriétaire" on public.medical_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "trajets : propriétaire" on public.trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trajets : staff org lit" on public.trips for select using (org_id is not null and public.is_org_staff(org_id));

create policy "positions : propriétaire" on public.positions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "positions : staff org lit" on public.positions for select using (exists (select 1 from trips t where t.id = trip_id and t.org_id is not null and public.is_org_staff(t.org_id)));

create policy "alertes : propriétaire" on public.alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "alertes : staff org lit" on public.alerts for select using (org_id is not null and public.is_org_staff(org_id));
create policy "alertes : partenaires lisent" on public.alerts for select using (public.is_partner());

create policy "événements : lecture liée" on public.alert_events for select using (
  exists (select 1 from alerts a where a.id = alert_id and (a.user_id = auth.uid() or public.is_partner() or (a.org_id is not null and public.is_org_staff(a.org_id))))
);

create policy "annuaire : lecture publique" on public.service_directory for select using (true);

-- ============ RPC ============
create or replace function public.create_organization(p_name text, p_kind text default 'transport') returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o organizations;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into organizations (name, kind) values (p_name, p_kind) returning * into o;
  insert into org_members (org_id, user_id, role) values (o.id, auth.uid(), 'admin');
  return o;
end $$;

create or replace function public.join_organization(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select id into v_org from organizations where join_code = upper(trim(p_code));
  if v_org is null then raise exception 'Code d’organisation inconnu'; end if;
  insert into org_members (org_id, user_id, role) values (v_org, auth.uid(), 'traveler') on conflict do nothing;
  return v_org;
end $$;

create or replace function public.org_trips(p_org uuid) returns table (
  id uuid, traveler text, from_place text, to_place text, departure_at timestamptz, eta_at timestamptz, status text,
  vehicle_plate text, last_lat double precision, last_lng double precision, last_position_at timestamptz
) language sql stable security definer set search_path = public as $$
  select t.id, coalesce(p.full_name, 'Voyageur'), t.from_place, t.to_place, t.departure_at, t.eta_at, t.status,
         t.vehicle_plate, t.last_lat, t.last_lng, t.last_position_at
  from trips t left join profiles p on p.id = t.user_id
  where t.org_id = p_org and public.is_org_staff(p_org)
    and (t.status in ('planned', 'active', 'overdue') or t.updated_at > now() - interval '48 hours')
  order by (t.status = 'overdue') desc, t.departure_at desc
  limit 200;
$$;

-- Les entreprises ne voient pas les données médicales : seulement l'alerte et la position
create or replace function public.org_alerts(p_org uuid) returns table (
  id uuid, traveler text, phone text, kind text, message text, status text, lat double precision, lng double precision, created_at timestamptz, trip text
) language sql stable security definer set search_path = public as $$
  select a.id, coalesce(p.full_name, 'Voyageur'), p.phone, a.kind, a.message, a.status, a.lat, a.lng, a.created_at,
         case when t.id is null then null else t.from_place || ' → ' || t.to_place end
  from alerts a left join profiles p on p.id = a.user_id left join trips t on t.id = a.trip_id
  where a.org_id = p_org and public.is_org_staff(p_org) and a.created_at > now() - interval '30 days'
  order by (a.status in ('sent', 'received', 'in_progress')) desc, a.created_at desc
  limit 200;
$$;

create or replace function public.org_members_list(p_org uuid) returns table (user_id uuid, role text, full_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, p.full_name from org_members m left join profiles p on p.id = m.user_id
  where m.org_id = p_org and public.is_org_staff(p_org) order by m.role, p.full_name;
$$;

-- Partenaires : données médicales uniquement si le voyageur y a consenti ET les a jointes à l'alerte
create or replace function public.partner_alerts() returns table (
  id uuid, traveler text, phone text, kind text, message text, status text, lat double precision, lng double precision, created_at timestamptz, trip text,
  blood_group text, allergies text, conditions text, treatments text
) language sql stable security definer set search_path = public as $$
  select a.id, coalesce(mp.full_name, p.full_name, 'Voyageur'), p.phone, a.kind, a.message, a.status, a.lat, a.lng, a.created_at,
         case when t.id is null then null else t.from_place || ' → ' || t.to_place end,
         case when mp.consent_share_with_partners then mp.blood_group end,
         case when mp.consent_share_with_partners then mp.allergies end,
         case when mp.consent_share_with_partners then mp.conditions end,
         case when mp.consent_share_with_partners then mp.treatments end
  from alerts a
  left join profiles p on p.id = a.user_id
  left join medical_profiles mp on mp.user_id = a.user_id
  left join trips t on t.id = a.trip_id
  where public.is_partner() and a.created_at > now() - interval '7 days'
  order by (a.status in ('sent', 'received', 'in_progress')) desc, a.created_at desc
  limit 300;
$$;

create or replace function public.update_alert_status(p_alert uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a alerts;
begin
  select * into a from alerts where id = p_alert;
  if a.id is null then raise exception 'Alerte introuvable'; end if;
  if not (a.user_id = auth.uid() or public.is_partner() or (a.org_id is not null and public.is_org_staff(a.org_id))) then
    raise exception 'Accès refusé';
  end if;
  update alerts set status = p_status, handled_by = auth.uid() where id = p_alert;
  if p_note is not null then
    insert into alert_events (alert_id, actor_id, status, note) values (p_alert, auth.uid(), p_status, p_note);
  end if;
end $$;

-- Lien de suivi partagé avec les proches (aucun compte requis)
create or replace function public.get_shared_trip(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'traveler', split_part(coalesce(p.full_name, 'Voyageur'), ' ', 1),
    'from_place', t.from_place, 'to_place', t.to_place, 'departure_at', t.departure_at, 'eta_at', t.eta_at,
    'status', t.status, 'company', t.company, 'vehicle_plate', t.vehicle_plate,
    'positions', coalesce((select json_agg(json_build_object('lat', x.lat, 'lng', x.lng, 'recorded_at', x.recorded_at) order by x.recorded_at desc)
                            from (select * from positions where trip_id = t.id order by recorded_at desc limit 20) x), '[]'::json)
  )
  from trips t left join profiles p on p.id = t.user_id
  where t.share_token = p_token and t.tracking
    and (t.status in ('planned', 'active', 'overdue') or t.updated_at > now() - interval '24 hours');
$$;

grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- Temps réel pour les consoles entreprise et partenaires
alter publication supabase_realtime add table public.alerts, public.trips;

-- ============ Annuaire de base ============
insert into public.service_directory (id, name, category, city, phone, description, verified) values
  ('samu', 'SAMU — urgence médicale', 'urgence', 'National', '15', 'Malaise, blessé grave, accouchement difficile', true),
  ('police', 'Police secours', 'urgence', 'National', '17', 'Agression, vol, accident avec trouble à l’ordre public', true),
  ('pompiers', 'Sapeurs-pompiers', 'urgence', 'National', '18', 'Accident de la route, incendie, désincarcération', true)
on conflict (id) do nothing;
