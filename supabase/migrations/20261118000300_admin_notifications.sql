-- NIGORA — administration de la plateforme, notifications, push, quotas, notes d'alerte, suppression de compte

-- ============ Profils enrichis ============
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists accepted_terms_at timestamptz;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, accepted_terms_at)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email, new.raw_user_meta_data ->> 'phone',
          case when (new.raw_user_meta_data ->> 'accepted_terms') = 'true' then now() end)
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============ Administrateurs de la plateforme ============
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "admins : soi" on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- Premier administrateur : possible uniquement tant qu'il n'y en a aucun
create or replace function public.claim_first_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if exists (select 1 from platform_admins) then return false; end if;
  insert into platform_admins (user_id) values (auth.uid());
  return true;
end $$;
revoke execute on function public.claim_first_admin() from public, anon;
grant execute on function public.claim_first_admin() to authenticated;

-- ============ Organisations : contrat et quotas ============
alter table public.organizations add column if not exists max_vehicles int;
alter table public.organizations add column if not exists max_travelers int;
alter table public.organizations add column if not exists contract_end date;
alter table public.organizations add column if not exists active boolean not null default true;
alter table public.organizations add column if not exists contact_phone text;

create or replace function public.check_vehicle_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare q int;
begin
  select max_vehicles into q from organizations where id = new.org_id;
  if q is not null and (select count(*) from vehicles where org_id = new.org_id) >= q then
    raise exception 'Quota de véhicules atteint (%). Contactez NIGORA pour étendre votre contrat.', q;
  end if;
  return new;
end $$;
revoke execute on function public.check_vehicle_quota() from public, anon, authenticated;
drop trigger if exists vehicles_quota on public.vehicles;
create trigger vehicles_quota before insert on public.vehicles for each row execute function public.check_vehicle_quota();

create or replace function public.join_organization(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare o organizations;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into o from organizations where join_code = upper(trim(p_code));
  if o.id is null then raise exception 'Code d’organisation inconnu'; end if;
  if not o.active then raise exception 'Cette organisation est suspendue'; end if;
  if o.max_travelers is not null and (select count(*) from org_members where org_id = o.id and role = 'traveler') >= o.max_travelers then
    raise exception 'Nombre maximal de voyageurs atteint pour cette organisation';
  end if;
  insert into org_members (org_id, user_id, role) values (o.id, auth.uid(), 'traveler') on conflict do nothing;
  return o.id;
end $$;

-- Gestion de l'équipe par l'administrateur de l'organisation
create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members where org_id = p_org and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_org_admin(p_org) or public.is_platform_admin()) then raise exception 'Réservé à l’administrateur de l’organisation'; end if;
  if p_role not in ('admin', 'dispatcher', 'traveler') then raise exception 'Rôle invalide'; end if;
  if p_role <> 'admin' and p_user = auth.uid() and (select count(*) from org_members where org_id = p_org and role = 'admin') <= 1 then
    raise exception 'L’organisation doit garder au moins un administrateur';
  end if;
  update org_members set role = p_role where org_id = p_org and user_id = p_user;
end $$;

create or replace function public.remove_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_org_admin(p_org) or public.is_platform_admin() or p_user = auth.uid()) then raise exception 'Accès refusé'; end if;
  if (select role from org_members where org_id = p_org and user_id = p_user) = 'admin'
     and (select count(*) from org_members where org_id = p_org and role = 'admin') <= 1 then
    raise exception 'L’organisation doit garder au moins un administrateur';
  end if;
  delete from org_members where org_id = p_org and user_id = p_user;
end $$;

create or replace function public.regenerate_join_code(p_org uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not (public.is_org_admin(p_org) or public.is_platform_admin()) then raise exception 'Accès refusé'; end if;
  c := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  update organizations set join_code = c where id = p_org;
  return c;
end $$;

drop function if exists public.org_members_list(uuid);
create function public.org_members_list(p_org uuid) returns table (user_id uuid, role text, full_name text, phone text, email text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, p.full_name, p.phone, p.email, m.joined_at from org_members m left join profiles p on p.id = m.user_id
  where m.org_id = p_org and (public.is_org_staff(p_org) or public.is_platform_admin()) order by m.role, p.full_name;
$$;

-- Les voyageurs d'une organisation voient sa fiche (nom, quotas) ; le code d'adhésion reste visible car déjà partagé
create or replace function public.org_info(p_org uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', o.id, 'name', o.name, 'kind', o.kind, 'plan', o.plan, 'join_code', case when public.is_org_staff(o.id) then o.join_code end,
    'max_vehicles', o.max_vehicles, 'max_travelers', o.max_travelers, 'contract_end', o.contract_end, 'active', o.active,
    'vehicles', (select count(*) from vehicles v where v.org_id = o.id),
    'travelers', (select count(*) from org_members m where m.org_id = o.id and m.role = 'traveler'))
  from organizations o where o.id = p_org and (exists (select 1 from org_members m where m.org_id = o.id and m.user_id = auth.uid()) or public.is_platform_admin());
$$;

-- ============ Notes et chronologie des alertes ============
create or replace function public.can_handle_alert(p_alert uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from alerts a where a.id = p_alert and (a.user_id = auth.uid() or public.is_partner() or public.is_platform_admin() or (a.org_id is not null and public.is_org_staff(a.org_id))));
$$;

create or replace function public.add_alert_note(p_alert uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_handle_alert(p_alert) then raise exception 'Accès refusé'; end if;
  if length(trim(p_note)) = 0 then raise exception 'Note vide'; end if;
  insert into alert_events (alert_id, actor_id, status, note) values (p_alert, auth.uid(), 'note', left(trim(p_note), 1000));
end $$;

create or replace function public.alert_timeline(p_alert uuid) returns table (at timestamptz, status text, note text, actor text)
language sql stable security definer set search_path = public as $$
  select e.created_at, e.status, e.note,
         coalesce((select pa.name from partner_members pm join partners pa on pa.id = pm.partner_id where pm.user_id = e.actor_id limit 1),
                  p.full_name, case when e.actor_id is null then 'Système' else 'Utilisateur' end)
  from alert_events e left join profiles p on p.id = e.actor_id
  where e.alert_id = p_alert and public.can_handle_alert(p_alert)
  order by e.created_at, e.id;
$$;

create or replace function public.update_alert_status(p_alert uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('received', 'in_progress', 'closed', 'cancelled') then raise exception 'Statut invalide'; end if;
  if not public.can_handle_alert(p_alert) then raise exception 'Accès refusé'; end if;
  update alerts set status = p_status, handled_by = auth.uid() where id = p_alert;
  if p_note is not null and length(trim(p_note)) > 0 then
    insert into alert_events (alert_id, actor_id, status, note) values (p_alert, auth.uid(), 'note', left(trim(p_note), 1000));
  end if;
end $$;

-- ============ Notifications ============
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications : lecture" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications : marquer lue" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications : supprimer" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push : propriétaire" on public.push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.notify_users(p_users uuid[], p_kind text, p_title text, p_body text, p_link text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title, body, link, data)
  select distinct u, p_kind, p_title, p_body, p_link, p_data from unnest(p_users) u where u is not null;
$$;
revoke execute on function public.notify_users(uuid[], text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.alert_kind_label(k text) returns text language sql immutable as $$
  select case k when 'accident' then 'Accident' when 'panne' then 'Panne' when 'malaise' then 'Malaise' when 'agression' then 'Agression' else 'Urgence' end;
$$;

create or replace function public.on_alert_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; staff uuid[]; partners uuid[]; admins uuid[];
begin
  select coalesce(full_name, 'Un voyageur') into who from profiles where id = new.user_id;
  if tg_op = 'INSERT' then
    select array_agg(user_id) into staff from org_members where org_id = new.org_id and role in ('admin', 'dispatcher');
    select array_agg(distinct user_id) into partners from partner_members;
    select array_agg(user_id) into admins from platform_admins;
    perform notify_users(staff, 'alerte', '🆘 ' || alert_kind_label(new.kind) || ' — ' || who, coalesce(new.message, 'Nouvelle alerte d’un voyageur de votre organisation.'), '/pro', jsonb_build_object('alert_id', new.id));
    perform notify_users(partners, 'alerte', '🆘 ' || alert_kind_label(new.kind) || ' — ' || who, coalesce(new.message, 'Nouvelle alerte à traiter.'), '/partenaires', jsonb_build_object('alert_id', new.id));
    perform notify_users(admins, 'alerte', '🆘 ' || alert_kind_label(new.kind) || ' — ' || who, 'Nouvelle alerte sur la plateforme.', '/admin', jsonb_build_object('alert_id', new.id));
  elsif new.status is distinct from old.status and new.handled_by is not null and new.handled_by <> new.user_id then
    perform notify_users(array[new.user_id], 'alerte-statut',
      case new.status when 'received' then '✅ Votre alerte a été reçue' when 'in_progress' then '🚑 Votre alerte est prise en charge' when 'closed' then 'Alerte clôturée' else 'Alerte mise à jour' end,
      'Statut mis à jour par les équipes d’assistance.', '/alertes', jsonb_build_object('alert_id', new.id, 'status', new.status));
  end if;
  return new;
end $$;
revoke execute on function public.on_alert_notify() from public, anon, authenticated;
drop trigger if exists alerts_notify on public.alerts;
create trigger alerts_notify after insert or update on public.alerts for each row execute function public.on_alert_notify();

create or replace function public.on_trip_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; staff uuid[];
begin
  if new.org_id is not null and new.status = 'overdue' and old.status is distinct from 'overdue' then
    select coalesce(full_name, 'Un voyageur') into who from profiles where id = new.user_id;
    select array_agg(user_id) into staff from org_members where org_id = new.org_id and role in ('admin', 'dispatcher');
    perform notify_users(staff, 'retard', '⚠️ Arrivée non confirmée — ' || who, new.from_place || ' → ' || new.to_place || coalesce(' (' || new.vehicle_plate || ')', ''), '/pro', jsonb_build_object('trip_id', new.id));
  end if;
  return new;
end $$;
revoke execute on function public.on_trip_notify() from public, anon, authenticated;
drop trigger if exists trips_notify on public.trips;
create trigger trips_notify after update on public.trips for each row execute function public.on_trip_notify();

create or replace function public.on_member_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; org text; admins uuid[];
begin
  select coalesce(full_name, email, 'Un utilisateur') into who from profiles where id = new.user_id;
  select name into org from organizations where id = new.org_id;
  select array_agg(user_id) into admins from org_members where org_id = new.org_id and role = 'admin' and user_id <> new.user_id;
  perform notify_users(admins, 'membre', who || ' a rejoint ' || org, null, '/pro', '{}');
  return new;
end $$;
revoke execute on function public.on_member_notify() from public, anon, authenticated;
drop trigger if exists org_members_notify on public.org_members;
create trigger org_members_notify after insert on public.org_members for each row execute function public.on_member_notify();

-- ============ Annuaire géré par l'administration ============
create policy "annuaire : admin gère" on public.service_directory for insert to authenticated with check (public.is_platform_admin());
create policy "annuaire : admin modifie" on public.service_directory for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "annuaire : admin supprime" on public.service_directory for delete to authenticated using (public.is_platform_admin());

-- ============ Console administrateur (toutes ces fonctions vérifient is_platform_admin) ============
create or replace function public.admin_guard() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Réservé aux administrateurs NIGORA'; end if;
end $$;

create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return json_build_object(
    'users', (select count(*) from profiles),
    'users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'organizations', (select count(*) from organizations),
    'partners', (select count(*) from partners),
    'trips_active', (select count(*) from trips where status in ('active', 'overdue')),
    'trips_30d', (select count(*) from trips where created_at > now() - interval '30 days'),
    'overdue', (select count(*) from trips where status = 'overdue'),
    'alerts_open', (select count(*) from alerts where status in ('pending', 'sent', 'received', 'in_progress')),
    'alerts_30d', (select count(*) from alerts where created_at > now() - interval '30 days'),
    'median_pickup_min', (select round(extract(epoch from percentile_cont(0.5) within group (order by e.created_at - a.created_at)) / 60)
                            from alerts a join lateral (select min(created_at) created_at from alert_events where alert_id = a.id and status in ('received', 'in_progress')) e on e.created_at is not null
                            where a.created_at > now() - interval '30 days'),
    'alerts_by_day', (select coalesce(json_agg(json_build_object('day', d, 'n', n) order by d), '[]') from (
                        select date_trunc('day', created_at)::date d, count(*) n from alerts where created_at > now() - interval '14 days' group by 1) x)
  );
end $$;

create or replace function public.admin_organizations() returns table (
  id uuid, name text, kind text, plan text, join_code text, active boolean, max_vehicles int, max_travelers int, contract_end date,
  contact_phone text, created_at timestamptz, members bigint, travelers bigint, vehicles bigint, alerts_30d bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select o.id, o.name, o.kind, o.plan, o.join_code, o.active, o.max_vehicles, o.max_travelers, o.contract_end, o.contact_phone, o.created_at,
    (select count(*) from org_members m where m.org_id = o.id),
    (select count(*) from org_members m where m.org_id = o.id and m.role = 'traveler'),
    (select count(*) from vehicles v where v.org_id = o.id),
    (select count(*) from alerts a where a.org_id = o.id and a.created_at > now() - interval '30 days')
  from organizations o order by o.created_at desc;
end $$;

create or replace function public.admin_update_organization(p_id uuid, p_name text, p_plan text, p_active boolean, p_max_vehicles int, p_max_travelers int, p_contract_end date, p_contact_phone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update organizations set name = coalesce(nullif(trim(p_name), ''), name), plan = coalesce(p_plan, plan), active = coalesce(p_active, active),
    max_vehicles = p_max_vehicles, max_travelers = p_max_travelers, contract_end = p_contract_end, contact_phone = p_contact_phone
  where id = p_id;
end $$;

create or replace function public.admin_partners() returns table (id uuid, name text, kind text, region text, phone text, members json)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select pa.id, pa.name, pa.kind, pa.region, pa.phone,
    coalesce((select json_agg(json_build_object('user_id', pm.user_id, 'email', p.email, 'full_name', p.full_name)) from partner_members pm left join profiles p on p.id = pm.user_id where pm.partner_id = pa.id), '[]')
  from partners pa order by pa.name;
end $$;

create or replace function public.admin_save_partner(p_id uuid, p_name text, p_kind text, p_region text, p_phone text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform admin_guard();
  if p_id is null then
    insert into partners (name, kind, region, phone) values (p_name, p_kind, p_region, p_phone) returning id into v;
  else
    update partners set name = p_name, kind = p_kind, region = p_region, phone = p_phone where id = p_id returning id into v;
  end if;
  return v;
end $$;

create or replace function public.admin_delete_partner(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  delete from partners where id = p_id;
end $$;

create or replace function public.admin_add_partner_member(p_partner uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  perform admin_guard();
  select id into u from profiles where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'Aucun compte NIGORA avec cet e-mail (la personne doit d’abord s’inscrire)'; end if;
  insert into partner_members (partner_id, user_id) values (p_partner, u) on conflict do nothing;
  perform notify_users(array[u], 'role', 'Accès partenaire activé', 'Vous pouvez traiter les alertes depuis l’espace partenaires.', '/partenaires', '{}');
end $$;

create or replace function public.admin_remove_partner_member(p_partner uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  delete from partner_members where partner_id = p_partner and user_id = p_user;
end $$;

create or replace function public.admin_users(p_search text default null) returns table (
  id uuid, email text, full_name text, phone text, created_at timestamptz, is_admin boolean, orgs text, partner text, trips bigint, alerts bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select p.id, p.email, p.full_name, p.phone, p.created_at,
    exists (select 1 from platform_admins a where a.user_id = p.id),
    (select string_agg(o.name || ' (' || m.role || ')', ', ') from org_members m join organizations o on o.id = m.org_id where m.user_id = p.id),
    (select string_agg(pa.name, ', ') from partner_members pm join partners pa on pa.id = pm.partner_id where pm.user_id = p.id),
    (select count(*) from trips t where t.user_id = p.id),
    (select count(*) from alerts a where a.user_id = p.id)
  from profiles p
  where p_search is null or p.email ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%' or p.phone ilike '%' || p_search || '%'
  order by p.created_at desc limit 500;
end $$;

create or replace function public.admin_set_admin(p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  if not p_admin and p_user = auth.uid() then raise exception 'Vous ne pouvez pas retirer vos propres droits'; end if;
  if p_admin then insert into platform_admins (user_id) values (p_user) on conflict do nothing;
  else delete from platform_admins where user_id = p_user; end if;
end $$;

-- Toutes les alertes, sans données médicales
create or replace function public.admin_alerts(p_days int default 30) returns table (
  id uuid, traveler text, phone text, org text, kind text, message text, status text, lat double precision, lng double precision, created_at timestamptz, trip text
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select a.id, coalesce(p.full_name, 'Voyageur'), p.phone, o.name, a.kind, a.message, a.status, a.lat, a.lng, a.created_at,
    case when t.id is null then null else t.from_place || ' → ' || t.to_place end
  from alerts a left join profiles p on p.id = a.user_id left join organizations o on o.id = a.org_id left join trips t on t.id = a.trip_id
  where a.created_at > now() - make_interval(days => p_days)
  order by (a.status in ('pending', 'sent', 'received', 'in_progress')) desc, a.created_at desc limit 500;
end $$;

-- ============ Suppression de compte (droit à l'effacement) ============
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if exists (select 1 from org_members m where m.user_id = u and m.role = 'admin'
             and (select count(*) from org_members m2 where m2.org_id = m.org_id and m2.role = 'admin') = 1
             and (select count(*) from org_members m3 where m3.org_id = m.org_id) > 1) then
    raise exception 'Vous êtes le seul administrateur d’une organisation : nommez un autre administrateur avant de supprimer votre compte';
  end if;
  delete from auth.users where id = u;
end $$;

-- Les voyageurs voient les partenaires/admin qui traitent leur alerte via alert_timeline ; la fonction partner_alerts inclut maintenant le téléphone
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
  where (public.is_partner() or public.is_platform_admin()) and a.created_at > now() - interval '7 days'
  order by (a.status in ('sent', 'received', 'in_progress')) desc, a.created_at desc
  limit 300;
$$;

-- ============ Droits d'exécution ============
do $$
declare f text;
begin
  foreach f in array array[
    'public.is_org_admin(uuid)', 'public.set_member_role(uuid, uuid, text)', 'public.remove_member(uuid, uuid)', 'public.regenerate_join_code(uuid)',
    'public.org_members_list(uuid)', 'public.org_info(uuid)', 'public.can_handle_alert(uuid)', 'public.add_alert_note(uuid, text)',
    'public.alert_timeline(uuid)', 'public.update_alert_status(uuid, text, text)', 'public.join_organization(text)',
    'public.admin_guard()', 'public.admin_stats()', 'public.admin_organizations()',
    'public.admin_update_organization(uuid, text, text, boolean, integer, integer, date, text)', 'public.admin_partners()',
    'public.admin_save_partner(uuid, text, text, text, text)', 'public.admin_delete_partner(uuid)', 'public.admin_add_partner_member(uuid, text)',
    'public.admin_remove_partner_member(uuid, uuid)', 'public.admin_users(text)', 'public.admin_set_admin(uuid, boolean)', 'public.admin_alerts(integer)',
    'public.delete_my_account()', 'public.partner_alerts()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.alert_kind_label(text) from public, anon, authenticated;

-- Temps réel : notifications
alter publication supabase_realtime add table public.notifications;
