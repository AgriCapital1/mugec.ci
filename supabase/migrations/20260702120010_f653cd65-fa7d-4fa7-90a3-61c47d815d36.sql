
DROP VIEW IF EXISTS public.sensitive_audit_log_enriched;
CREATE VIEW public.sensitive_audit_log_enriched
WITH (security_invoker = on) AS
SELECT
  s.id, s.occurred_at, s.actor_id, s.scope, s.action, s.target_id, s.target_label, s.details,
  d.full_name AS actor_name,
  d.email     AS actor_email,
  d.phone     AS actor_phone,
  d.address   AS actor_address,
  d.photo_url AS actor_photo_url,
  d.portal    AS actor_portal
FROM public.sensitive_audit_log s
LEFT JOIN public.admin_user_directory d ON d.user_id = s.actor_id;

GRANT SELECT ON public.sensitive_audit_log_enriched TO authenticated;
