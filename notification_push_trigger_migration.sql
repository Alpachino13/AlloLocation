-- Migration: Notifications push natives (Expo) — Edge Function + pg_net
-- À exécuter dans Supabase SQL Editor
--
-- PRÉREQUIS (à faire AVANT ou APRÈS, l'ordre n'a pas d'importance) :
--
-- 1. Déployer l'Edge Function (fichier supabase/functions/send-push-notification/index.ts) :
--      npx supabase functions deploy send-push-notification \
--        --project-ref fmfpqqmksqasyhizeqiq --no-verify-jwt
--    puis définir la variable d'environnement PUSH_SECRET dans le dashboard
--    (Edge Functions → Secrets) avec un secret aléatoire, par exemple :
--      openssl rand -hex 32
--
-- 2. Insérer le MÊME secret dans la table app_config (créée par cette migration) :
--      INSERT INTO app_config (key, value) VALUES ('push_secret', '<LE_MÊME_SECRET>')
--      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- Comportement : chaque notification in-app insérée dans `notifications`
-- (par les triggers notification_triggers_migration.sql et
-- notification_annulation_triggers_migration.sql) déclenche un appel HTTP
-- asynchrone (pg_net) vers l'Edge Function, qui envoie le push natif.
-- Sans secret configuré, l'appel est simplement ignoré (in-app fonctionne).

-- Extension réseau : appels HTTP asynchrones depuis les triggers
create extension if not exists pg_net;

-- Table de config clé/valeur (le secret n'apparaît jamais dans le code)
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

-- Trigger : envoyer le push pour CHAQUE notification in-app insérée
create or replace function notify_push_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  -- Pas de secret configuré → pas de push (les notifications in-app marchent quand même)
  select value into v_secret
  from public.app_config
  where key = 'push_secret';

  if v_secret is null or v_secret = '' then
    return new;
  end if;

  -- Appel asynchrone fire-and-forget vers l'Edge Function (nom de schéma qualifié :
  -- net.http_post ne dépend pas du search_path)
  perform net.http_post(
    url    := 'https://fmfpqqmksqasyhizeqiq.functions.supabase.co/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body   := jsonb_build_object(
      'targetUserId', new.user_id::text,
      'titre',        new.titre,
      'message',      new.message,
      'type',         new.type
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

-- Supprimer l'ancien trigger s'il existe
drop trigger if exists trg_notify_push_after_insert on notifications;

create trigger trg_notify_push_after_insert
  after insert on notifications
  for each row
  execute function notify_push_after_insert();
