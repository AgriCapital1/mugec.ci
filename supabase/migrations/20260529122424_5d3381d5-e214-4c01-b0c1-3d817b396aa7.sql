
CREATE TABLE IF NOT EXISTS public.app_config (
  config_key TEXT PRIMARY KEY,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read app_config"
  ON public.app_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage app_config"
  ON public.app_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.app_config (config_key, config_value, description) VALUES
  ('art71_droit_adhesion', '{"montant": 10000}'::jsonb, 'Droit d''adhésion Art.71 (FCFA)'),
  ('art71_cotisation_mensuelle', '{"montant": 2000}'::jsonb, 'Cotisation mensuelle de base Art.71 (FCFA)'),
  ('brevo_settings', '{"enabled": false, "sender_name": "MUGEC-CI", "sender_email": "", "template_signup": null, "template_password_reset": null, "template_prestation_validee": null, "template_cotisation_relance": null}'::jsonb, 'Configuration Brevo (clé API stockée en secret)')
ON CONFLICT (config_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_art71_on_member_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  droit_montant INTEGER;
  coti_montant INTEGER;
  current_period TEXT;
BEGIN
  IF NEW.statut <> 'actif' OR (TG_OP = 'UPDATE' AND OLD.statut = 'actif') THEN
    RETURN NEW;
  END IF;

  SELECT (config_value->>'montant')::integer INTO droit_montant
    FROM public.app_config WHERE config_key = 'art71_droit_adhesion';
  SELECT (config_value->>'montant')::integer INTO coti_montant
    FROM public.app_config WHERE config_key = 'art71_cotisation_mensuelle';

  droit_montant := COALESCE(droit_montant, 10000);
  coti_montant := COALESCE(coti_montant, 2000);
  current_period := to_char(now(), 'YYYY-MM');

  INSERT INTO public.cotisations (member_id, periode, montant, statut, reference)
  SELECT NEW.id, 'DROIT-ADHESION', droit_montant, 'en_attente', 'ART71-DROIT-' || NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cotisations
    WHERE member_id = NEW.id AND periode = 'DROIT-ADHESION'
  );

  INSERT INTO public.cotisations (member_id, periode, montant, statut, reference)
  SELECT NEW.id, current_period, coti_montant, 'en_attente', 'ART71-COTI-' || NEW.id || '-' || current_period
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cotisations
    WHERE member_id = NEW.id AND periode = current_period
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_art71_on_activation ON public.members;
CREATE TRIGGER trg_art71_on_activation
  AFTER INSERT OR UPDATE OF statut ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_art71_on_member_activation();

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled
  ON public.notification_queue (status, scheduled_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_cotisations_member_statut_period
  ON public.cotisations (member_id, statut, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cotisations_overdue
  ON public.cotisations (statut, created_at)
  WHERE statut IN ('en_attente', 'en_retard');

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_bucket_window
  ON public.rate_limit_counters (bucket_key, window_start);

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS rgpd_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rgpd_consent_version TEXT;
