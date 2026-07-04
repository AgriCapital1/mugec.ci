GRANT SELECT ON public.news TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;

GRANT SELECT ON public.opportunites TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.opportunites TO authenticated;
GRANT ALL ON public.opportunites TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;