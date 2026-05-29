
-- 1) Journal d'audit pour les actions sensibles (app_config + rôles)
CREATE TABLE IF NOT EXISTS public.sensitive_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  actor_email TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('app_config', 'user_roles', 'admin_credentials')),
  action TEXT NOT NULL,
  target_id UUID,
  target_label TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sensitive_audit_log_occurred_at
  ON public.sensitive_audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensitive_audit_log_scope
  ON public.sensitive_audit_log (scope, occurred_at DESC);

GRANT SELECT ON public.sensitive_audit_log TO authenticated;
GRANT ALL  ON public.sensitive_audit_log TO service_role;

ALTER TABLE public.sensitive_audit_log ENABLE ROW LEVEL SECURITY;

-- Lecture : super_admin uniquement (le journal contient parfois des emails)
DROP POLICY IF EXISTS "audit super_admin read" ON public.sensitive_audit_log;
CREATE POLICY "audit super_admin read"
  ON public.sensitive_audit_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Aucune policy INSERT/UPDATE/DELETE pour authenticated : seul service_role
-- (utilisé par les server fns + triggers SECURITY DEFINER) peut écrire.

-- 2) Trigger d'audit sur app_config
CREATE OR REPLACE FUNCTION public.audit_app_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sensitive_audit_log
    (actor_id, scope, action, target_label, details)
  VALUES (
    auth.uid(),
    'app_config',
    TG_OP,
    COALESCE(NEW.config_key, OLD.config_key),
    jsonb_build_object(
      'old_description', OLD.description,
      'new_description', NEW.description,
      'changed_keys',
        CASE WHEN OLD.config_value IS DISTINCT FROM NEW.config_value
             THEN jsonb_build_array('config_value')
             ELSE '[]'::jsonb END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_app_config ON public.app_config;
CREATE TRIGGER trg_audit_app_config
  AFTER INSERT OR UPDATE OR DELETE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_app_config_change();

-- 3) Trigger d'audit sur user_roles
CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sensitive_audit_log
    (actor_id, scope, action, target_id, target_label, details)
  VALUES (
    auth.uid(),
    'user_roles',
    TG_OP,
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.role::text, OLD.role::text),
    jsonb_build_object(
      'old_role', OLD.role::text,
      'new_role', NEW.role::text
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();

-- 4) Helper : journalisation d'événements applicatifs (server fns)
CREATE OR REPLACE FUNCTION public.log_sensitive_event(
  _scope TEXT,
  _action TEXT,
  _target_id UUID,
  _target_label TEXT,
  _details JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sensitive_audit_log
    (actor_id, scope, action, target_id, target_label, details)
  VALUES (auth.uid(), _scope, _action, _target_id, _target_label, COALESCE(_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_sensitive_event(text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_sensitive_event(text, text, uuid, text, jsonb) TO service_role;
