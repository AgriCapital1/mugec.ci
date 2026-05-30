-- Permettre au flux de connexion (anonyme avant session) de résoudre l'email
-- depuis un identifiant (téléphone, login admin, email). La fonction est
-- SECURITY DEFINER, retourne uniquement une chaîne email -> aucune fuite de PII
-- au-delà du flux login. Cela évite la dépendance au service_role côté serveur.
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_member_email_by_phone(text) TO anon, authenticated;