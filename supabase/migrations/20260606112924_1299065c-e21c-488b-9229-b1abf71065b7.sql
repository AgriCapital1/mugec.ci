
-- 1. Extend admin_user_directory with profile fields
ALTER TABLE public.admin_user_directory
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Allow super_admin to update directory entries (in addition to existing policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='admin_user_directory'
      AND policyname='super_admin manages directory'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "super_admin manages directory"
        ON public.admin_user_directory
        FOR ALL
        TO authenticated
        USING (public.is_super_admin(auth.uid()))
        WITH CHECK (public.is_super_admin(auth.uid()))
    $p$;
  END IF;
END$$;

-- 2. Permission catalog
CREATE TABLE IF NOT EXISTS public.permission_catalog (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  portal text NOT NULL DEFAULT 'mugec',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.permission_catalog TO authenticated;
GRANT ALL ON public.permission_catalog TO service_role;

ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='permission_catalog' AND policyname='auth read catalog') THEN
    EXECUTE 'CREATE POLICY "auth read catalog" ON public.permission_catalog FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='permission_catalog' AND policyname='super_admin manages catalog') THEN
    EXECUTE 'CREATE POLICY "super_admin manages catalog" ON public.permission_catalog FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()))';
  END IF;
END$$;

-- 3. Role <-> permission grants
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permission_catalog(key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_permissions' AND policyname='auth read role perms') THEN
    EXECUTE 'CREATE POLICY "auth read role perms" ON public.role_permissions FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_permissions' AND policyname='super_admin manages role perms') THEN
    EXECUTE 'CREATE POLICY "super_admin manages role perms" ON public.role_permissions FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()))';
  END IF;
END$$;

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.role_has_permission(_role public.app_role, _key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT allowed FROM public.role_permissions WHERE role = _role AND permission_key = _key),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.user_id = _user_id
        AND rp.permission_key = _key
        AND rp.allowed = true
    );
$$;

-- 5. Seed catalog (idempotent)
INSERT INTO public.permission_catalog (key, label, description, category, portal) VALUES
  ('members.view',          'Voir la liste des membres',         'Accéder à l''annuaire des membres',                'Membres',     'mugec'),
  ('members.create',        'Créer un membre',                   'Inscrire un nouveau membre',                       'Membres',     'mugec'),
  ('members.edit',          'Modifier un membre',                'Mettre à jour la fiche d''un membre',              'Membres',     'mugec'),
  ('members.delete',        'Supprimer / suspendre un membre',   'Suspendre ou supprimer un compte membre',          'Membres',     'mugec'),
  ('members.export',        'Exporter les membres',              'Télécharger la base des membres',                  'Membres',     'mugec'),
  ('cotisations.view',      'Voir les cotisations',              'Consulter l''historique des cotisations',          'Cotisations', 'mugec'),
  ('cotisations.validate',  'Valider une cotisation',            'Confirmer le paiement d''une cotisation',          'Cotisations', 'mugec'),
  ('cotisations.refund',    'Rembourser une cotisation',         'Émettre un remboursement',                         'Cotisations', 'mugec'),
  ('droits.view',           'Voir les droits d''adhésion',       'Consulter les droits d''adhésion',                 'Finances',    'mugec'),
  ('droits.manage',         'Gérer les droits d''adhésion',      'Valider / ajuster les droits d''adhésion',         'Finances',    'mugec'),
  ('prestations.view',      'Voir les prestations',              'Consulter les demandes de prestations',            'Prestations', 'mugec'),
  ('prestations.validate_1','Valider niveau 1 (Délégué section)','Première validation d''une prestation',            'Prestations', 'mugec'),
  ('prestations.validate_2','Valider niveau 2 (Sec. régional)',  'Deuxième validation d''une prestation',            'Prestations', 'mugec'),
  ('prestations.validate_3','Valider niveau 3 (Sec. général)',   'Troisième validation d''une prestation',           'Prestations', 'mugec'),
  ('prestations.validate_4','Valider niveau 4 (Trésorier nat.)', 'Validation finale et paiement',                    'Prestations', 'mugec'),
  ('prestations.reject',    'Rejeter une prestation',            'Refuser une demande de prestation',                'Prestations', 'mugec'),
  ('actualites.publish',    'Publier des actualités',            'Créer et publier des articles',                    'Contenu',     'mugec'),
  ('opportunites.publish',  'Publier des opportunités',          'Créer et publier des opportunités',                'Contenu',     'mugec'),
  ('notifications.send',    'Envoyer des notifications',         'Envoyer email / SMS / WhatsApp aux membres',       'Communication','mugec'),
  ('forum.moderate',        'Modérer le forum',                  'Modérer les messages du forum',                    'Communication','mugec'),
  ('reports.view',          'Consulter les rapports',            'Voir les rapports et tableaux de bord',            'Rapports',    'mugec'),
  ('reports.financial',     'Rapports financiers',               'Accéder aux rapports financiers détaillés',        'Rapports',    'mugec'),
  ('audit.view',            'Voir le journal d''audit',          'Consulter les logs d''audit',                      'Sécurité',    'mugec'),
  ('users.manage',          'Gérer les utilisateurs admin',      'Créer / modifier les comptes administrateurs',     'Sécurité',    'mugec'),
  ('miprojet.view',         'Voir le tableau MIPROJET',          'Lecture seule du portail MIPROJET',                'MIPROJET',    'miprojet'),
  ('miprojet.manage',       'Gérer MIPROJET',                    'Accès complet au portail MIPROJET',                'MIPROJET',    'miprojet')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, category = EXCLUDED.category, portal = EXCLUDED.portal;

-- 6. Seed default role -> permissions (idempotent)
WITH defaults(role_name, perm_key) AS (
  VALUES
    -- Président : lecture large + rapports
    ('president','members.view'),('president','cotisations.view'),('president','droits.view'),
    ('president','prestations.view'),('president','reports.view'),('president','reports.financial'),
    ('president','audit.view'),('president','notifications.send'),
    -- Directeur exécutif : opérationnel large
    ('directeur_executif','members.view'),('directeur_executif','members.edit'),
    ('directeur_executif','cotisations.view'),('directeur_executif','prestations.view'),
    ('directeur_executif','reports.view'),('directeur_executif','reports.financial'),
    ('directeur_executif','notifications.send'),('directeur_executif','actualites.publish'),
    -- Secrétaire général : prestations niveau 3
    ('secretaire_general','members.view'),('secretaire_general','members.edit'),
    ('secretaire_general','prestations.view'),('secretaire_general','prestations.validate_3'),
    ('secretaire_general','prestations.reject'),('secretaire_general','actualites.publish'),
    ('secretaire_general','notifications.send'),('secretaire_general','reports.view'),
    -- Trésorier national : niveau 4 + finances
    ('tresorier_national','members.view'),('tresorier_national','cotisations.view'),
    ('tresorier_national','cotisations.validate'),('tresorier_national','cotisations.refund'),
    ('tresorier_national','droits.view'),('tresorier_national','droits.manage'),
    ('tresorier_national','prestations.view'),('tresorier_national','prestations.validate_4'),
    ('tresorier_national','prestations.reject'),('tresorier_national','reports.view'),
    ('tresorier_national','reports.financial'),
    -- Admin national
    ('admin_national','members.view'),('admin_national','members.create'),('admin_national','members.edit'),
    ('admin_national','members.delete'),('admin_national','members.export'),
    ('admin_national','cotisations.view'),('admin_national','cotisations.validate'),
    ('admin_national','droits.view'),('admin_national','droits.manage'),
    ('admin_national','prestations.view'),('admin_national','prestations.reject'),
    ('admin_national','actualites.publish'),('admin_national','opportunites.publish'),
    ('admin_national','notifications.send'),('admin_national','forum.moderate'),
    ('admin_national','reports.view'),('admin_national','reports.financial'),('admin_national','audit.view'),
    -- Admin régional
    ('admin_regional','members.view'),('admin_regional','members.create'),('admin_regional','members.edit'),
    ('admin_regional','cotisations.view'),('admin_regional','prestations.view'),
    ('admin_regional','notifications.send'),('admin_regional','reports.view'),
    -- Admin local
    ('admin_local','members.view'),('admin_local','members.create'),('admin_local','members.edit'),
    ('admin_local','cotisations.view'),('admin_local','prestations.view'),
    -- Secrétaire régional : niveau 2
    ('secretaire_regional','members.view'),('secretaire_regional','members.edit'),
    ('secretaire_regional','prestations.view'),('secretaire_regional','prestations.validate_2'),
    ('secretaire_regional','prestations.reject'),('secretaire_regional','notifications.send'),
    -- Trésorier régional
    ('tresorier_regional','cotisations.view'),('tresorier_regional','cotisations.validate'),
    ('tresorier_regional','prestations.view'),('tresorier_regional','reports.view'),
    -- Délégué de section : niveau 1
    ('delegue_section','members.view'),('delegue_section','prestations.view'),
    ('delegue_section','prestations.validate_1'),('delegue_section','prestations.reject'),
    -- Agent saisie
    ('agent_saisie','members.view'),('agent_saisie','members.create'),('agent_saisie','members.edit'),
    ('agent_saisie','cotisations.view'),
    -- Commissaire comptes
    ('commissaire_comptes','cotisations.view'),('commissaire_comptes','droits.view'),
    ('commissaire_comptes','reports.view'),('commissaire_comptes','reports.financial'),
    ('commissaire_comptes','audit.view'),
    -- Comité contrôle
    ('comite_controle','members.view'),('comite_controle','cotisations.view'),
    ('comite_controle','reports.view'),('comite_controle','reports.financial'),('comite_controle','audit.view'),
    -- Conseil des sages
    ('conseil_sages','members.view'),('conseil_sages','reports.view'),
    -- MIPROJET viewer / admin
    ('miprojet_viewer','miprojet.view'),
    ('miprojet_admin','miprojet.view'),('miprojet_admin','miprojet.manage')
)
INSERT INTO public.role_permissions (role, permission_key, allowed)
SELECT role_name::public.app_role, perm_key, true
FROM defaults
ON CONFLICT (role, permission_key) DO NOTHING;

-- updated_at trigger for role_permissions
DROP TRIGGER IF EXISTS trg_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
