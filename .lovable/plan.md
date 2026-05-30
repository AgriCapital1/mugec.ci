## Diagnostic confirmé

- Le message entouré en rouge correspond à l’échec du vérificateur de publication : `dist-check failed with exit status 1`.
- Le login échoue sur `/login`, `/admin` et `/miprojet` car la fonction serveur `loginWithIdentifier` importe `supabaseAdmin`, donc elle exige `SUPABASE_SERVICE_ROLE_KEY`. Ce secret n’est pas présent dans les secrets du projet, et les logs serveur montrent : `Missing Supabase environment variable(s): SERVICE_ROLE_KEY`.
- Les fonctions SQL utiles existent bien dans Supabase : `resolve_login_email`, `current_user_dashboard_path`, `dashboard_path_for`.
- Les comptes et rôles existent bien : un membre, un admin MUGEC-CI, un super admin MIPROJET.
- Les permissions actuelles protègent `resolve_login_email` pour `service_role` uniquement, ce qui force le code à utiliser le service-role pour résoudre l’identifiant.

## Plan d’implémentation

### 1. Corriger le login pour fonctionner dans tous les environnements

- Modifier `src/lib/login.functions.ts` pour supprimer la dépendance directe à `supabaseAdmin` dans le flux de connexion.
- Utiliser une fonction SQL RPC dédiée et sécurisée qui résout l’identifiant de connexion avec la clé publishable côté serveur.
- Garder les messages génériques côté UI pour ne pas exposer si un email/téléphone existe.
- Conserver les règles de portail :
  - `/login` accepte uniquement les membres et redirige vers `/membre`.
  - `/admin` accepte les rôles admin MUGEC-CI et redirige vers `/admin`.
  - `/miprojet` accepte uniquement `super_admin` et redirige vers `/miprojet`.

### 2. Migration Supabase de stabilisation login

Créer une migration complète qui :

- Remplace/renforce `resolve_login_email(text)` pour gérer :
  - téléphone avec ou sans espaces/indicatif,
  - email,
  - identifiants admin existants `mugecadmin`, `adminmgec`, `admininoce`, `inoceadmin`.
- Accorde l’exécution strictement nécessaire à `authenticated`/`service_role` ou à un flux RPC public contrôlé selon le choix sécurisé retenu pour permettre la connexion avant session.
- Vérifie/renforce `current_user_dashboard_path()` et `dashboard_path_for(uuid)` pour renvoyer les chemins attendus.
- Corrige les grants nécessaires sur `members` et `user_roles` si la Data API ne peut pas lire après authentification.

### 3. Réaligner les mots de passe admin si nécessaire

- Garder l’endpoint sécurisé `/api/public/hooks/reset-admin-credentials`, mais vérifier qu’il n’empêche pas le déploiement.
- Après migration, si les secrets `ADMIN_MUGEC_PASSWORD`, `ADMIN_MIPROJET_PASSWORD`, `ADMIN_RESET_TOKEN` sont présents, utiliser le flux existant pour réaligner les mots de passe des comptes admin.
- Ne jamais afficher ni journaliser les mots de passe.

### 4. Corriger la publication / production build

- Nettoyer la configuration de déploiement pour correspondre au format attendu par Lovable/TanStack Start.
- Vérifier et corriger `wrangler.jsonc` : le `main` doit pointer vers la sortie de build attendue, pas vers une entrée source incompatible si le vérificateur attend `.output/server/index.mjs`.
- Retirer les dépendances ou réglages Cloudflare/Vercel résiduels seulement s’ils contredisent `@lovable.dev/vite-tanstack-config`.
- Ne pas modifier `index.html`.

### 5. Validation

- Vérifier les logs serveur après correction pour confirmer que l’erreur `SERVICE_ROLE_KEY` ne se produit plus au login.
- Vérifier les fonctions SQL avec des requêtes de lecture ciblées.
- Vérifier que les routes `/login`, `/admin`, `/miprojet` ont chacune une redirection cohérente après session.
- Laisser le contrôle automatique de build/publish valider le `dist-check` après les changements.

## Fichiers prévus

- `src/lib/login.functions.ts`
- `supabase/migrations/<nouvelle_migration_login>.sql`
- `wrangler.jsonc`
- éventuellement `package.json` / `bun.lock` uniquement si un réglage de déploiement résiduel bloque encore le vérificateur

## Résultat attendu

Les utilisateurs pourront se connecter depuis le preview, le domaine Lovable et `mugecci.ivoireprojet.com`, puis être redirigés automatiquement vers le bon portail. La publication ne devra plus échouer sur `dist-check`.