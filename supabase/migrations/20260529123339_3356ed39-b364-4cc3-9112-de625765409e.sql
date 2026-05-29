DROP TRIGGER IF EXISTS trg_art71_on_activation ON public.members;
DROP FUNCTION IF EXISTS public.apply_art71_on_member_activation() CASCADE;

DELETE FROM public.app_config
WHERE config_key IN ('art71_droit_adhesion', 'art71_cotisation_mensuelle');