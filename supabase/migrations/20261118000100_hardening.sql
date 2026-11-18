-- Fonctions internes (déclencheurs) : jamais appelables via l'API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_org_id() from public, anon, authenticated;
revoke execute on function public.log_alert_status() from public, anon, authenticated;
revoke execute on function public.protect_alert_status() from public, anon, authenticated;

-- Statuts d'alerte modifiables uniquement vers des valeurs de traitement
create or replace function public.update_alert_status(p_alert uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a alerts;
begin
  if p_status not in ('received', 'in_progress', 'closed', 'cancelled') then raise exception 'Statut invalide'; end if;
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

-- Fonctions réservées aux utilisateurs connectés (chacune vérifie auth.uid() et les rôles)
revoke execute on function public.create_organization(text, text), public.join_organization(text), public.org_trips(uuid),
  public.org_alerts(uuid), public.org_members_list(uuid), public.partner_alerts(), public.update_alert_status(uuid, text, text),
  public.is_org_staff(uuid), public.is_partner() from public, anon;
grant execute on function public.create_organization(text, text), public.join_organization(text), public.org_trips(uuid),
  public.org_alerts(uuid), public.org_members_list(uuid), public.partner_alerts(), public.update_alert_status(uuid, text, text),
  public.is_org_staff(uuid), public.is_partner() to authenticated;

-- Seule fonction publique : le lien de suivi partagé avec les proches (jeton aléatoire de 96 bits)
grant execute on function public.get_shared_trip(text) to anon, authenticated;
