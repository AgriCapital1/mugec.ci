# SQL manuel — restauration Supabase MUGEC-CI

> Aucune migration automatique n’a été lancée. Copiez ce SQL dans Supabase SQL Editor et remplacez les deux marqueurs de mot de passe juste avant exécution.

## État code validé

- Build local vérifié : `bun run build:dev` passe.
- MCP protégé par OAuth Supabase/RLS : `list_news`, `list_opportunities`, `create_news`.
- Manifest MCP régénéré avec 3 outils.

## SQL à exécuter manuellement

```sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('membre');
  END IF;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_national';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_regional';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_local';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent_saisie';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'president';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaire_general';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tresorier_national';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commissaire_comptes';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'directeur_executif';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'comite_controle';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'conseil_sages';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaire_regional';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tresorier_regional';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delegue_section';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'miprojet_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'miprojet_viewer';

CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  region text,
  collectivite text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin');
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('super_admin','admin_national','admin_regional','admin_local','agent_saisie','president','secretaire_general','tresorier_national','commissaire_comptes','directeur_executif','comite_controle','conseil_sages','secretaire_regional','tresorier_regional','delegue_section')
  );
$$;

DROP POLICY IF EXISTS "roles self or admin read" ON public.user_roles;
CREATE POLICY "roles self or admin read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "roles super admin write" ON public.user_roles;
CREATE POLICY "roles super admin write" ON public.user_roles FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE SEQUENCE IF NOT EXISTS public.matricule_seq START 1;
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  matricule text UNIQUE,
  nom text NOT NULL DEFAULT '',
  prenoms text NOT NULL DEFAULT '',
  date_naissance date,
  lieu_naissance text,
  sexe text,
  nationalite text DEFAULT 'Ivoirienne',
  email text,
  telephone text,
  cni text,
  adresse text,
  photo_url text,
  collectivite text,
  region text,
  direction text,
  fonction text,
  ecole text,
  matricule_pro text,
  date_embauche date,
  ayants_droit text,
  type_membre text NOT NULL DEFAULT 'office',
  statut text NOT NULL DEFAULT 'en_attente',
  paiement_methode text,
  frais_paye boolean NOT NULL DEFAULT false,
  payment_reference text,
  payment_confirmed_at timestamptz,
  date_inscription timestamptz DEFAULT now(),
  qr_code text,
  droits_ouverts_le timestamptz,
  step_completed integer NOT NULL DEFAULT 1,
  suspended_reason text,
  last_cotisation_at timestamptz,
  source text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_matricule()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.matricule IS NULL OR btrim(NEW.matricule) = '' THEN
    NEW.matricule := 'MUGEC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.matricule_seq')::text, 5, '0');
  END IF;
  NEW.date_inscription := COALESCE(NEW.date_inscription, now());
  NEW.qr_code := COALESCE(NEW.qr_code, 'https://mugecci.lovable.app/verifier/' || COALESCE(NEW.matricule, NEW.id::text));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS members_matricule ON public.members;
CREATE TRIGGER members_matricule BEFORE INSERT ON public.members FOR EACH ROW EXECUTE FUNCTION public.generate_matricule();
DROP TRIGGER IF EXISTS members_updated ON public.members;
CREATE TRIGGER members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

DROP POLICY IF EXISTS "members select self or admin" ON public.members;
CREATE POLICY "members select self or admin" ON public.members FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "members insert self or admin" ON public.members;
CREATE POLICY "members insert self or admin" ON public.members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "members update self or admin" ON public.members;
CREATE POLICY "members update self or admin" ON public.members FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid())) WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "members delete super admin" ON public.members;
CREATE POLICY "members delete super admin" ON public.members FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text UNIQUE, summary text, body text NOT NULL DEFAULT '', cover_url text, image_url text,
  illustrations text[] NOT NULL DEFAULT '{}', category text, tags text[] NOT NULL DEFAULT '{}', meta_title text, meta_description text, author_id uuid,
  published boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'draft', published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news public published" ON public.news;
CREATE POLICY "news public published" ON public.news FOR SELECT TO anon, authenticated USING (published = true OR status = 'published' OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "news admin crud" ON public.news;
CREATE POLICY "news admin crud" ON public.news FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.opportunites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text UNIQUE, summary text, description text NOT NULL DEFAULT '', body text, cover_url text,
  illustrations text[] NOT NULL DEFAULT '{}', type text, category text, tags text[] NOT NULL DEFAULT '{}', lieu text, date_limite date, meta_title text, meta_description text,
  published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunites TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.opportunites TO authenticated;
GRANT ALL ON public.opportunites TO service_role;
ALTER TABLE public.opportunites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "opportunites public published" ON public.opportunites;
CREATE POLICY "opportunites public published" ON public.opportunites FOR SELECT TO anon, authenticated USING (published = true OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "opportunites admin crud" ON public.opportunites;
CREATE POLICY "opportunites admin crud" ON public.opportunites FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid REFERENCES public.members(id) ON DELETE CASCADE, type text NOT NULL, title text, file_name text, url text NOT NULL,
  mime_type text, uploaded_by uuid, offline_available boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents owner admin read" ON public.documents;
CREATE POLICY "documents owner admin read" ON public.documents FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid()));
DROP POLICY IF EXISTS "documents owner admin create" ON public.documents;
CREATE POLICY "documents owner admin create" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.cotisations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid REFERENCES public.members(id) ON DELETE CASCADE, periode text NOT NULL, montant integer NOT NULL DEFAULT 0, statut text NOT NULL DEFAULT 'en_attente', methode text, reference text, paye_le timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotisations TO authenticated; GRANT ALL ON public.cotisations TO service_role; ALTER TABLE public.cotisations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotisations owner admin crud" ON public.cotisations;
CREATE POLICY "cotisations owner admin crud" ON public.cotisations FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())) WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid REFERENCES public.members(id) ON DELETE CASCADE, type text NOT NULL, periode text, montant_total integer NOT NULL DEFAULT 0, part_mutuelle integer NOT NULL DEFAULT 0, part_miprojet integer NOT NULL DEFAULT 0, statut_paiement text NOT NULL DEFAULT 'en_attente', source text NOT NULL DEFAULT 'solde', operateur text, reference_transaction text UNIQUE, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated; GRANT ALL ON public.subscriptions TO service_role; ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions owner admin crud" ON public.subscriptions;
CREATE POLICY "subscriptions owner admin crud" ON public.subscriptions FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())) WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.app_config (config_key text PRIMARY KEY, config_value jsonb NOT NULL, description text, updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated; GRANT ALL ON public.app_config TO service_role; ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config authenticated read" ON public.app_config;
CREATE POLICY "app_config authenticated read" ON public.app_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "app_config admin crud" ON public.app_config;
CREATE POLICY "app_config admin crud" ON public.app_config FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.app_config(config_key, config_value, description) VALUES
('member_card', '{"organizationName":"MUGEC-CI","organizationSubtitle":"Mutuelle Générale du Personnel des Collectivités Territoriales","cardTitle":"Carte de membre","countryLabel":"République de Côte d’Ivoire","primaryPhone":"07 58 89 43 63","secondaryPhone":"07 08 27 67 51","website":"mugecci.lovable.app","ownershipNotice":"Cette carte demeure la propriété exclusive de la MUGEC-CI.","lostNotice":"Carte non cessible. En cas de perte, la retrouver et la déposer à la mairie ou au conseil régional le plus proche.","returnNotice":"Toute utilisation frauduleuse expose son auteur à des poursuites."}'::jsonb, 'Configuration CRUD carte membre')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, description = EXCLUDED.description, updated_at = now();

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v text := lower(btrim(coalesce(p_identifier,''))); v_digits text := regexp_replace(v, '[^0-9]', '', 'g'); out_email text;
BEGIN
  IF v IN ('mugecadmin','adminmgec') THEN RETURN 'adminmgec@mugec-ci.local'; END IF;
  IF v IN ('admin','admininoce','inoceadmin','miprojet') THEN RETURN 'admininoce@miprojet.local'; END IF;
  IF position('@' in v) > 1 THEN SELECT email INTO out_email FROM auth.users WHERE lower(email) = v LIMIT 1; RETURN out_email; END IF;
  SELECT email INTO out_email FROM public.members WHERE regexp_replace(coalesce(telephone,''), '[^0-9]', '', 'g') IN (v_digits, right(v_digits, 10), right(v_digits, 8)) AND email IS NOT NULL ORDER BY created_at DESC LIMIT 1;
  RETURN out_email;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_path_for(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.has_role(_user_id,'super_admin') THEN '/admin/miprojet' WHEN public.is_admin(_user_id) THEN '/admin' ELSE '/membre' END;
$$;
CREATE OR REPLACE FUNCTION public.current_user_dashboard_path()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.dashboard_path_for(auth.uid()); $$;
GRANT EXECUTE ON FUNCTION public.dashboard_path_for(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_dashboard_path() TO authenticated, service_role;

DO $$
DECLARE v_mugec_id uuid; v_miprojet_id uuid;
BEGIN
  SELECT id INTO v_mugec_id FROM auth.users WHERE email = 'adminmgec@mugec-ci.local';
  IF v_mugec_id IS NULL THEN v_mugec_id := gen_random_uuid(); END IF;
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_mugec_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adminmgec@mugec-ci.local', crypt('__MOT_DE_PASSE_MUGEC__', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"login":"mugecadmin","display_name":"Admin MUGEC-CI"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = crypt('__MOT_DE_PASSE_MUGEC__', gen_salt('bf')), email_confirmed_at = now(), updated_at = now(), raw_user_meta_data = EXCLUDED.raw_user_meta_data;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_mugec_id, 'admin_national') ON CONFLICT DO NOTHING;

  SELECT id INTO v_miprojet_id FROM auth.users WHERE email = 'admininoce@miprojet.local';
  IF v_miprojet_id IS NULL THEN v_miprojet_id := gen_random_uuid(); END IF;
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_miprojet_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admininoce@miprojet.local', crypt('__MOT_DE_PASSE_MIPROJET__', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"login":"admin","display_name":"Super Admin MIPROJET"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = crypt('__MOT_DE_PASSE_MIPROJET__', gen_salt('bf')), email_confirmed_at = now(), updated_at = now(), raw_user_meta_data = EXCLUDED.raw_user_meta_data;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_miprojet_id, 'super_admin') ON CONFLICT DO NOTHING;
END $$;

COMMIT;
```

Remplacez `__MOT_DE_PASSE_MUGEC__` par le mot de passe admin MUGEC-CI et `__MOT_DE_PASSE_MIPROJET__` par le mot de passe super admin MiPROJET juste avant l’exécution.