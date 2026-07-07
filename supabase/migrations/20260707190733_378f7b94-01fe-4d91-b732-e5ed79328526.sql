CREATE TABLE IF NOT EXISTS public.member_card_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  config_key text NOT NULL DEFAULT 'member_card',
  config_version timestamptz NOT NULL DEFAULT now(),
  member_version timestamptz NOT NULL DEFAULT now(),
  render_status text NOT NULL DEFAULT 'pending' CHECK (render_status IN ('pending','ready','failed')),
  render_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  rendered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, config_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_card_renders TO authenticated;
GRANT ALL ON public.member_card_renders TO service_role;
ALTER TABLE public.member_card_renders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read own card renders" ON public.member_card_renders;
CREATE POLICY "Members can read own card renders" ON public.member_card_renders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_card_renders.member_id
        AND m.user_id = auth.uid()
    ) OR public.is_admin(auth.uid())
  );
DROP POLICY IF EXISTS "Admins manage card renders" ON public.member_card_renders;
CREATE POLICY "Admins manage card renders" ON public.member_card_renders
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.member_card_regeneration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all','member')),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  total_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_card_regeneration_jobs TO authenticated;
GRANT ALL ON public.member_card_regeneration_jobs TO service_role;
ALTER TABLE public.member_card_regeneration_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage card regeneration jobs" ON public.member_card_regeneration_jobs;
CREATE POLICY "Admins manage card regeneration jobs" ON public.member_card_regeneration_jobs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_member_card_render(_member_id uuid, _reason text DEFAULT 'member_updated')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config_version timestamptz;
  v_member_version timestamptz;
BEGIN
  SELECT updated_at INTO v_config_version FROM public.app_config WHERE config_key = 'member_card';
  SELECT updated_at INTO v_member_version FROM public.members WHERE id = _member_id;
  IF _member_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.member_card_renders(member_id, config_version, member_version, render_status, render_payload, rendered_at, updated_at)
  VALUES (_member_id, COALESCE(v_config_version, now()), COALESCE(v_member_version, now()), 'pending', jsonb_build_object('reason', _reason), NULL, now())
  ON CONFLICT(member_id, config_key) DO UPDATE
    SET config_version = EXCLUDED.config_version,
        member_version = EXCLUDED.member_version,
        render_status = 'pending',
        render_payload = COALESCE(public.member_card_renders.render_payload, '{}'::jsonb) || jsonb_build_object('reason', _reason),
        rendered_at = NULL,
        error_message = NULL,
        updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.touch_member_card_render(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_member_card_regeneration(_reason text DEFAULT 'manual')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job uuid;
  v_total integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT count(*) INTO v_total FROM public.members;
  INSERT INTO public.member_card_regeneration_jobs(scope, reason, status, total_count, created_by)
  VALUES ('all', COALESCE(NULLIF(_reason, ''), 'manual'), 'queued', COALESCE(v_total, 0), auth.uid())
  RETURNING id INTO v_job;
  INSERT INTO public.member_card_renders(member_id, config_version, member_version, render_status, render_payload, rendered_at, updated_at)
  SELECT
    m.id,
    COALESCE(c.updated_at, now()),
    COALESCE(m.updated_at, now()),
    'pending',
    jsonb_build_object('reason', _reason, 'job_id', v_job),
    NULL,
    now()
  FROM public.members m
  LEFT JOIN public.app_config c ON c.config_key = 'member_card'
  ON CONFLICT(member_id, config_key) DO UPDATE
    SET config_version = EXCLUDED.config_version,
        member_version = EXCLUDED.member_version,
        render_status = 'pending',
        render_payload = EXCLUDED.render_payload,
        rendered_at = NULL,
        error_message = NULL,
        updated_at = now();
  UPDATE public.member_card_regeneration_jobs
     SET status = 'done', processed_count = total_count, started_at = COALESCE(started_at, now()), finished_at = now(), updated_at = now()
   WHERE id = v_job;
  RETURN v_job;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_member_card_regeneration(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_member_card_member_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.touch_member_card_render(NEW.id, 'member_updated');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_card_member_changed ON public.members;
CREATE TRIGGER member_card_member_changed
AFTER INSERT OR UPDATE OF matricule, nom, prenoms, photo_url, collectivite, region, fonction, sexe, nationalite, date_inscription, qr_code, updated_at
ON public.members
FOR EACH ROW EXECUTE FUNCTION public.tg_member_card_member_changed();

CREATE OR REPLACE FUNCTION public.tg_member_card_config_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.config_key = 'member_card' THEN
    INSERT INTO public.member_card_regeneration_jobs(scope, reason, status, total_count, processed_count, created_by, started_at, finished_at)
    SELECT 'all', 'card_config_updated', 'done', count(*), count(*), NEW.updated_by, now(), now()
    FROM public.members;

    INSERT INTO public.member_card_renders(member_id, config_version, member_version, render_status, render_payload, rendered_at, updated_at)
    SELECT
      m.id,
      NEW.updated_at,
      COALESCE(m.updated_at, now()),
      'pending',
      jsonb_build_object('reason', 'card_config_updated'),
      NULL,
      now()
    FROM public.members m
    ON CONFLICT(member_id, config_key) DO UPDATE
      SET config_version = EXCLUDED.config_version,
          member_version = EXCLUDED.member_version,
          render_status = 'pending',
          render_payload = EXCLUDED.render_payload,
          rendered_at = NULL,
          error_message = NULL,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_card_config_changed ON public.app_config;
CREATE TRIGGER member_card_config_changed
AFTER INSERT OR UPDATE OF config_value, updated_at
ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.tg_member_card_config_changed();

INSERT INTO public.app_config(config_key, config_value, description)
VALUES (
  'member_card',
  '{"organizationName":"MUGEC-CI","organizationSubtitle":"Association des Instituteurs d’Abidjan","cardTitle":"Carte de membre","countryLabel":"République de Côte d’Ivoire","primaryPhone":"07 58 89 43 63","secondaryPhone":"07 08 27 67 51","website":"mugecci.lovable.app","verificationBaseUrl":"https://mugecci.lovable.app/verifier","coordinatorTitle":"Coordonnateur Général","coordinatorName":"Mme N’GUESSAN Clarisse","signatureLabel":"Mme N’Guessan Clarisse","ownershipNotice":"Cette carte demeure la propriété exclusive de la MUGEC-CI.","lostNotice":"Carte strictement personnelle et non cessible. En cas de perte, prière de la déposer à la mairie ou au conseil régional le plus proche.","returnNotice":"Toute utilisation frauduleuse expose son auteur à des poursuites judiciaires.","primaryColor":"#0e2f6b","secondaryColor":"#1e5ba8","accentColor":"#2baa8a","frontGradientFrom":"#eaf2ff","frontGradientTo":"#c5dbf5","backGradientFrom":"#ffffff","backGradientTo":"#e4f0ff"}'::jsonb,
  'Configuration CRUD carte membre'
)
ON CONFLICT (config_key) DO UPDATE
SET config_value = public.app_config.config_value || EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = now();