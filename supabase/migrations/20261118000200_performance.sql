create index if not exists alert_events_alert_idx on public.alert_events (alert_id);
create index if not exists alert_events_actor_idx on public.alert_events (actor_id);
create index if not exists alerts_handled_by_idx on public.alerts (handled_by);
create index if not exists alerts_trip_idx on public.alerts (trip_id);
create index if not exists alerts_user_idx on public.alerts (user_id);
create index if not exists org_members_user_idx on public.org_members (user_id);
create index if not exists partner_members_user_idx on public.partner_members (user_id);
create index if not exists positions_user_idx on public.positions (user_id);
create index if not exists trips_user_idx on public.trips (user_id);
create index if not exists trusted_contacts_user_idx on public.trusted_contacts (user_id);

-- auth.uid() évalué une seule fois par requête, politiques limitées aux utilisateurs connectés
drop policy "profil : soi-même" on public.profiles;
create policy "profil : soi-même" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy "org : membres" on public.organizations;
create policy "org : membres" on public.organizations for select to authenticated using (exists (select 1 from org_members m where m.org_id = id and m.user_id = (select auth.uid())));
drop policy "org_members : soi ou staff" on public.org_members;
create policy "org_members : soi ou staff" on public.org_members for select to authenticated using (user_id = (select auth.uid()) or public.is_org_staff(org_id));
drop policy "org_members : quitter" on public.org_members;
create policy "org_members : quitter" on public.org_members for delete to authenticated using (user_id = (select auth.uid()) or public.is_org_staff(org_id));
drop policy "vehicules : membres lisent" on public.vehicles;
drop policy "vehicules : staff gère" on public.vehicles;
create policy "vehicules : membres lisent" on public.vehicles for select to authenticated using (exists (select 1 from org_members m where m.org_id = vehicles.org_id and m.user_id = (select auth.uid())));
create policy "vehicules : staff ajoute" on public.vehicles for insert to authenticated with check (public.is_org_staff(org_id));
create policy "vehicules : staff modifie" on public.vehicles for update to authenticated using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy "vehicules : staff supprime" on public.vehicles for delete to authenticated using (public.is_org_staff(org_id));
drop policy "partenaires : membres" on public.partners;
create policy "partenaires : membres" on public.partners for select to authenticated using (exists (select 1 from partner_members pm where pm.partner_id = id and pm.user_id = (select auth.uid())));
drop policy "partner_members : soi" on public.partner_members;
create policy "partner_members : soi" on public.partner_members for select to authenticated using (user_id = (select auth.uid()));
drop policy "contacts : propriétaire" on public.trusted_contacts;
create policy "contacts : propriétaire" on public.trusted_contacts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy "médical : propriétaire" on public.medical_profiles;
create policy "médical : propriétaire" on public.medical_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "trajets : propriétaire" on public.trips;
drop policy "trajets : staff org lit" on public.trips;
create policy "trajets : lecture" on public.trips for select to authenticated using (user_id = (select auth.uid()) or (org_id is not null and public.is_org_staff(org_id)));
create policy "trajets : ajout" on public.trips for insert to authenticated with check (user_id = (select auth.uid()));
create policy "trajets : modification" on public.trips for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "trajets : suppression" on public.trips for delete to authenticated using (user_id = (select auth.uid()));

drop policy "positions : propriétaire" on public.positions;
drop policy "positions : staff org lit" on public.positions;
create policy "positions : lecture" on public.positions for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from trips t where t.id = trip_id and t.org_id is not null and public.is_org_staff(t.org_id)));
create policy "positions : ajout" on public.positions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "positions : modification" on public.positions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "positions : suppression" on public.positions for delete to authenticated using (user_id = (select auth.uid()));

drop policy "alertes : propriétaire" on public.alerts;
drop policy "alertes : staff org lit" on public.alerts;
drop policy "alertes : partenaires lisent" on public.alerts;
create policy "alertes : lecture" on public.alerts for select to authenticated using (user_id = (select auth.uid()) or public.is_partner() or (org_id is not null and public.is_org_staff(org_id)));
create policy "alertes : ajout" on public.alerts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "alertes : modification" on public.alerts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "alertes : suppression" on public.alerts for delete to authenticated using (user_id = (select auth.uid()));

drop policy "événements : lecture liée" on public.alert_events;
create policy "événements : lecture liée" on public.alert_events for select to authenticated using (
  exists (select 1 from alerts a where a.id = alert_id and (a.user_id = (select auth.uid()) or public.is_partner() or (a.org_id is not null and public.is_org_staff(a.org_id))))
);
