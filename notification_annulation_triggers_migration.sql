-- Migration: Notifications d'annulation (client → agence) + garde anti auto-notification
-- À exécuter dans Supabase SQL Editor, APRÈS notification_triggers_migration.sql
--
-- 1. TRIGGER 2 (raffiné) : ne pas notifier le client quand c'est lui-même qui annule
--    (auth.uid() = NEW.user_id) — sinon il recevrait « annulée par l'agence ».
-- 2. TRIGGER 3 (nouveau) : notifier l'AGENCE quand un CLIENT annule une réservation,
--    sans notifier l'agence quand c'est elle-même qui refuse (auth.uid() = v_agence_id).

-- ============================================================
-- TRIGGER 2 bis : garde anti auto-notification client
-- ============================================================

CREATE OR REPLACE FUNCTION notify_client_changement_statut()
RETURNS TRIGGER AS $$
DECLARE
  v_voiture_nom text;
BEGIN
  IF NEW.statut = OLD.statut THEN
    RETURN NEW;
  END IF;

  IF NEW.statut NOT IN ('confirmee', 'annulee') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Si c'est le client lui-même qui annule, il n'a pas besoin d'être notifié
  IF NEW.statut = 'annulee' AND auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nom INTO v_voiture_nom FROM voitures WHERE id = NEW.voiture_id;

  INSERT INTO notifications (user_id, titre, message, type, lu, created_at)
  VALUES (
    NEW.user_id,
    CASE NEW.statut
      WHEN 'confirmee' THEN 'Réservation confirmée ✅'
      WHEN 'annulee'   THEN 'Réservation annulée ❌'
    END,
    CASE NEW.statut
      WHEN 'confirmee' THEN
        'Votre réservation pour ' || COALESCE(v_voiture_nom, 'le véhicule') ||
        ' a été confirmée par l''agence.'
      WHEN 'annulee' THEN
        'Votre réservation pour ' || COALESCE(v_voiture_nom, 'le véhicule') ||
        ' a été annulée par l''agence.'
    END,
    CASE NEW.statut
      WHEN 'confirmee' THEN 'confirmation'
      WHEN 'annulee'   THEN 'annulation'
    END,
    false,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Le trigger existant référence la fonction, CREATE OR REPLACE la met à jour
DROP TRIGGER IF EXISTS trg_notify_client_changement_statut ON reservations;

CREATE TRIGGER trg_notify_client_changement_statut
  AFTER UPDATE OF statut ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_changement_statut();


-- ============================================================
-- TRIGGER 3 : Notifier l'AGENCE quand un CLIENT annule
-- ============================================================

CREATE OR REPLACE FUNCTION notify_agence_annulation()
RETURNS TRIGGER AS $$
DECLARE
  v_agence_id   uuid;
  v_voiture_nom text;
  v_client_nom  text;
BEGIN
  IF NEW.statut = OLD.statut OR NEW.statut <> 'annulee' THEN
    RETURN NEW;
  END IF;

  SELECT agence_id, nom
  INTO   v_agence_id, v_voiture_nom
  FROM   voitures
  WHERE  id = NEW.voiture_id;

  IF v_agence_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Si c'est l'agence elle-même qui annule (refus), pas de notification
  IF auth.uid() IS NOT NULL AND auth.uid() = v_agence_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT COALESCE(nom, 'Client inconnu')
    INTO   v_client_nom
    FROM   profils
    WHERE  id = NEW.user_id;
  ELSE
    v_client_nom := COALESCE(NEW.client_nom_manuel, 'Client inconnu');
  END IF;

  INSERT INTO notifications (user_id, titre, message, type, lu, created_at)
  VALUES (
    v_agence_id,
    'Réservation annulée',
    v_client_nom || ' a annulé sa réservation pour ' ||
      COALESCE(v_voiture_nom, 'le véhicule') || '.',
    'annulation',
    false,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_agence_annulation ON reservations;

CREATE TRIGGER trg_notify_agence_annulation
  AFTER UPDATE OF statut ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_agence_annulation();
