-- Migration: Notifications in-app côté base de données (triggers)
-- À exécuter dans Supabase SQL Editor
-- Source: AlloLocation-web-agency/supabase/migrations/20240801000000_notification_triggers.sql
--
-- Remplace l'envoi client-side (bloqué par RLS : les clients ne peuvent pas
-- insérer une notification pour un autre utilisateur, ni lire push_token).
-- SECURITY DEFINER → les notifications sont créées par la base, fiablement.

-- ============================================================
-- TRIGGER 1 : Notifier l'AGENCE quand un client crée une réservation
-- ============================================================

CREATE OR REPLACE FUNCTION notify_agence_nouvelle_reservation()
RETURNS TRIGGER AS $$
DECLARE
  v_agence_id  uuid;
  v_voiture_nom text;
  v_client_nom  text;
BEGIN
  -- Récupérer l'agence propriétaire du véhicule
  SELECT agence_id, nom
  INTO   v_agence_id, v_voiture_nom
  FROM   voitures
  WHERE  id = NEW.voiture_id;

  IF v_agence_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nom du client (profil inscrit ou manuel)
  IF NEW.user_id IS NOT NULL THEN
    SELECT COALESCE(nom, 'Client inconnu')
    INTO   v_client_nom
    FROM   profils
    WHERE  id = NEW.user_id;
  ELSE
    v_client_nom := COALESCE(NEW.client_nom_manuel, 'Client inconnu');
  END IF;

  -- Insérer la notification pour l'agence
  INSERT INTO notifications (user_id, titre, message, type, lu, created_at)
  VALUES (
    v_agence_id,
    'Nouvelle réservation reçue',
    v_client_nom || ' a réservé ' || COALESCE(v_voiture_nom, 'un véhicule') ||
      ' du ' || TO_CHAR(NEW.date_debut::date, 'DD/MM/YYYY') ||
      ' au '  || TO_CHAR(NEW.date_fin::date,  'DD/MM/YYYY') || '.',
    'reservation',
    false,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trg_notify_agence_nouvelle_reservation ON reservations;

CREATE TRIGGER trg_notify_agence_nouvelle_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_agence_nouvelle_reservation();


-- ============================================================
-- TRIGGER 2 : Notifier le CLIENT quand l'agence change le statut
-- (confirmation ou annulation) — côté DB pour garantir la fiabilité
-- ============================================================

CREATE OR REPLACE FUNCTION notify_client_changement_statut()
RETURNS TRIGGER AS $$
DECLARE
  v_voiture_nom text;
BEGIN
  -- Seulement si le statut a changé vers confirmee ou annulee
  IF NEW.statut = OLD.statut THEN
    RETURN NEW;
  END IF;

  IF NEW.statut NOT IN ('confirmee', 'annulee') THEN
    RETURN NEW;
  END IF;

  -- Pas de client inscrit → pas de notif
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nom du véhicule
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

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trg_notify_client_changement_statut ON reservations;

CREATE TRIGGER trg_notify_client_changement_statut
  AFTER UPDATE OF statut ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_changement_statut();
