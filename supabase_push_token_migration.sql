-- Migration: Ajouter push_token sur la table profils
-- À exécuter dans Supabase SQL Editor

ALTER TABLE public.profils
  ADD COLUMN IF NOT EXISTS push_token text;

-- Index pour retrouver rapidement un token
CREATE INDEX IF NOT EXISTS idx_profils_push_token 
  ON public.profils(push_token) 
  WHERE push_token IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN public.profils.push_token IS 
  'Expo Push Token pour les notifications push natives (format ExponentPushToken[...])';
