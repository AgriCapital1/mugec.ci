
-- 1) Move pg_trgm out of public
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 2) Internal SECURITY DEFINER functions: service_role only
DO $$
DECLARE
  f text;
  internal_fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.open_member_rights_after_90_days()',
    'public.enqueue_overdue_cotisation_reminders()',
    'public.log_sensitive_event(text, text, uuid, text, jsonb)',
    'public.resolve_login_email(text)',
    'public.lookup_member_email_by_phone(text)',
    'public.dashboard_path_for(uuid)',
    'public.audit_app_config_change()',
    'public.audit_user_roles_change()',
    'public.audit_account_deletion_change()',
    'public.sync_paid_payment_session()',
    'public.sync_subscription_financials()'
  ];
BEGIN
  FOREACH f IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip %', f;
    END;
  END LOOP;
END $$;

-- 3) SECURITY DEFINER functions exposed to signed-in users only (revoke anon)
DO $$
DECLARE
  f text;
  auth_fns text[] := ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.is_admin(uuid)',
    'public.is_super_admin(uuid)',
    'public.can_manage_payments(uuid)',
    'public.can_manage_member_financials(uuid)',
    'public.current_user_dashboard_path()',
    'public.admin_dashboard_stats()',
    'public.miprojet_dashboard_stats()',
    'public.dashboard_sync_health()',
    'public.validate_prestation_step(uuid, text, text)',
    'public.member_public_info(text)'
  ];
BEGIN
  FOREACH f IN ARRAY auth_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip %', f;
    END;
  END LOOP;
END $$;
