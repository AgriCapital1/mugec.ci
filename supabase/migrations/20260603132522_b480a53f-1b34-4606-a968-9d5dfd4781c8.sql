ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'miprojet_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'miprojet_viewer';

CREATE TABLE IF NOT EXISTS public.admin_user_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  phone text,
  full_name text NOT NULL,
  portal text NOT NULL CHECK (portal IN ('mugec', 'miprojet')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_user_directory TO authenticated;
GRANT ALL ON public.admin_user_directory TO service_role;
ALTER TABLE public.admin_user_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin directory self read" ON public.admin_user_directory;
CREATE POLICY "admin directory self read"
ON public.admin_user_directory
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin directory super admin insert" ON public.admin_user_directory;
CREATE POLICY "admin directory super admin insert"
ON public.admin_user_directory
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin directory super admin update" ON public.admin_user_directory;
CREATE POLICY "admin directory super admin update"
ON public.admin_user_directory
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin directory super admin delete" ON public.admin_user_directory;
CREATE POLICY "admin directory super admin delete"
ON public.admin_user_directory
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS admin_user_directory_updated ON public.admin_user_directory;
CREATE TRIGGER admin_user_directory_updated
BEFORE UPDATE ON public.admin_user_directory
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid,
  target_email text NOT NULL,
  target_phone text,
  portal text NOT NULL CHECK (portal IN ('mugec', 'miprojet')),
  role text NOT NULL,
  invited_by uuid,
  channel text NOT NULL DEFAULT 'manual' CHECK (channel IN ('email', 'whatsapp', 'manual')),
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invitations TO authenticated;
GRANT ALL ON public.admin_invitations TO service_role;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin invitations super admin read" ON public.admin_invitations;
CREATE POLICY "admin invitations super admin read"
ON public.admin_invitations
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin invitations super admin insert" ON public.admin_invitations;
CREATE POLICY "admin invitations super admin insert"
ON public.admin_invitations
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin invitations super admin update" ON public.admin_invitations;
CREATE POLICY "admin invitations super admin update"
ON public.admin_invitations
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin invitations super admin delete" ON public.admin_invitations;
CREATE POLICY "admin invitations super admin delete"
ON public.admin_invitations
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_security super admin read" ON public.user_security;
CREATE POLICY "user_security super admin read"
ON public.user_security
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_security super admin insert" ON public.user_security;
CREATE POLICY "user_security super admin insert"
ON public.user_security
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_security super admin update" ON public.user_security;
CREATE POLICY "user_security super admin update"
ON public.user_security
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));