DROP POLICY IF EXISTS "Authenticated read app_config" ON public.app_config;
CREATE POLICY "Admins read app_config"
  ON public.app_config FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));