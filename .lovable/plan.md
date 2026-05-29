
## Plan d'implémentation

### 1. Export RGPD (côté membre)

**Nouvelle page** `src/routes/membre/confidentialite.tsx` (lien dans `MembreLayout` et `profil.tsx`) :
- Bouton « Exporter mes données (JSON) » + bouton « Exporter (PDF récap) »
- Bouton « Demander la suppression de mon compte » (voir §4)

**Server function** `src/lib/rgpd.functions.ts` (`requireSupabaseAuth`) :
- `exportMyData` : agrège `members`, `dependants`, `subscriptions`, `cotisations`, `prestation_requests`, `documents`, `member_documents`, `notifications`, `notifications_log` filtrés sur l'utilisateur courant → renvoie un JSON structuré (zippé base64 si volumineux). Téléchargement déclenché côté client via Blob.
- Log dans `sensitive_audit_log` (`scope='rgpd'`, `action='export'`).

### 2. Suppression RGPD (demande, pas auto-suppression)

Règle métier : **un membre ne peut PAS supprimer son compte lui-même**. Il dépose une **demande** qu'un super_admin traite.

**Migration** : nouvelle table `account_deletion_requests`
- Colonnes : `id`, `user_id`, `member_id`, `motif`, `statut` (`en_attente`/`approuve`/`rejete`/`traite`), `requested_at`, `processed_at`, `processed_by`, `notes_admin`
- GRANT + RLS : insert/select propriétaire (`auth.uid() = user_id`), update super_admin uniquement
- Trigger d'audit dans `sensitive_audit_log`

**UI membre** (`/membre/confidentialite`) :
- Formulaire « Demander la suppression » avec motif + double confirmation (case à cocher + saisie du mot « SUPPRIMER »)
- Affiche le statut de la dernière demande

**UI super_admin** (`src/routes/admin/rgpd.tsx`, nouveau) :
- Liste des demandes, actions « Approuver » / « Rejeter »
- Approbation = server function qui :
  - anonymise le `members` (nom/prenoms/email/téléphone/CNI/adresse remplacés par « [supprimé] »)
  - supprime `dependants`, `documents` storage liés
  - `supabaseAdmin.auth.admin.deleteUser(user_id)` ou désactivation
  - Log dans `sensitive_audit_log`

### 3. Import Excel/CSV admin (membres)

**Nouvelle page** `src/routes/admin/imports.tsx` (lien dans le menu admin) :
- Étape 1 : upload du fichier (`xlsx` ou `csv`) — parsing client avec `xlsx` (déjà compatible Worker en SSR mais ici on parse côté navigateur)
- Étape 2 : **mapping colonnes** — UI où chaque colonne source est associée à un champ cible (`nom`, `prenoms`, `email`, `telephone`, `cni`, `date_naissance`, `sexe`, `collectivite`, `region`, `fonction`, `direction`, `matricule_pro`)
- Étape 3 : **preview** des 20 premières lignes + détection des erreurs (zod validation par ligne : email valide, téléphone format, doublons sur email/cni)
- Étape 4 : **commit par lot** via server function

**Server function** `src/lib/member-import.functions.ts` (admin only) :
- `commitMemberImport({ rows, importId })` :
  - Crée d'abord un `auth.user` (via `supabaseAdmin.auth.admin.createUser` avec mot de passe temporaire + `email_confirm: true`)
  - Insert dans `members` avec `is_legacy=true`, `validation_mode='manuel'`, `statut='actif'`
  - Met à jour `member_imports` (compteurs OK/erreur, report JSON ligne par ligne)
  - Enfile un email de bienvenue dans `notification_queue` (event `membre.import.bienvenue`)

Dépendance : `xlsx` (à ajouter via `bun add xlsx`).

### 4. Templates email distincts (Brevo)

Le worker `process-notification-queue` lit déjà `notification_templates` (table existante). Il manque les **templates HTML** par événement.

**Migration de seed** dans `notification_templates` (insert idempotent) pour les events :
- `cotisation.relance` (3 stages J+3 / J+7 / J+14)
- `inscription.validee`
- `inscription.paiement.confirme`
- `prestation.recue`
- `prestation.validee`
- `prestation.rejetee`
- `membre.import.bienvenue`
- `compte.suppression.demande`
- `compte.suppression.approuvee`

Chaque template aura un `title` et `body` HTML enrichi (placeholders `{{prenoms}}`, `{{nom}}`, `{{stage}}`, `{{matricule}}`…).

**Modif worker** `process-notification-queue.ts` :
- Si `tpl.body` contient déjà du HTML (`<` détecté), bypasser `buildHtml` et l'envoyer tel quel, sinon garder le wrapping actuel.
- Conserver `textContent` (strip HTML).

Brevo : `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` déjà configurés ✅ → rien à brancher en plus. `EMAIL_FROM` est un secret hérité non utilisé par le worker Brevo (le worker lit `BREVO_SENDER_EMAIL`) ; on ne touche pas.

### 5. Fichiers touchés (récap)

**Créés :**
- `src/routes/membre/confidentialite.tsx`
- `src/routes/admin/rgpd.tsx`
- `src/routes/admin/imports.tsx`
- `src/lib/rgpd.functions.ts`
- `src/lib/member-import.functions.ts`
- Migration `account_deletion_requests` + seed `notification_templates`

**Modifiés :**
- `src/routes/api/public/hooks/process-notification-queue.ts` (HTML passthrough)
- `src/components/membre/MembreLayout.tsx` (lien Confidentialité)
- `src/components/admin/*Layout*.tsx` (liens RGPD + Imports)
- `src/routes/membre/profil.tsx` (lien export/suppression)
- `package.json` (ajout `xlsx`)

### Détails techniques

- L'export RGPD renvoie un Blob JSON téléchargé via `<a download>` côté client — pas de bucket storage nécessaire.
- L'import Excel parse côté navigateur (pas de native binary requis) pour éviter les limites Worker.
- La suppression réelle d'`auth.user` utilise `supabaseAdmin.auth.admin.deleteUser` (clé service_role, déjà côté serveur).
- Toutes les nouvelles actions sensibles passent par `log_sensitive_event`.
