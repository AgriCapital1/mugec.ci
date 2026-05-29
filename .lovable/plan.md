# Plan — Lots 1 & 2 (exécution parallèle)

Périmètre extrait de votre brief précédent. Avant de coder, je veux verrouiller le scope car certains points nécessitent des arbitrages produit et de l'infra côté Supabase.

## Lot 1 — Workflow & UX

1. **Application automatique de l'Art. 71**
   - Quand un nouvel adhérent est validé, calcul automatique du droit d'adhésion + 1ère cotisation selon barème Art. 71.
   - Génération automatique d'une ligne `cotisations` "droit d'adhésion" + ligne "cotisation M+0".
   - Trigger DB côté `members` (après passage à `actif`).

2. **Workflow cascade visuel dans `/admin/prestations`**
   - Stepper visuel (Secrétariat → Trésorier → Président → Paiement).
   - Boutons Valider / Rejeter conditionnés au rôle (`has_role`).
   - Table `prestation_validations` déjà présente — j'ajoute la logique UI + serverFn `validate_prestation_step`.

3. **PWA install prompt intelligent**
   - Composant déjà présent (`PWAInstallPrompt.tsx`) à enrichir :
     - Détection iOS vs Android/Desktop (instructions adaptées).
     - Déclenchement post-login uniquement, 1 fois / 14 jours (localStorage).
     - Bouton "Installer maintenant" qui appelle `deferredPrompt.prompt()` réellement.

4. **Base UI Brevo dans `/admin/notifications`**
   - Champs : clé API Brevo, sender name, sender email, template IDs (signup, password reset, prestation validée, cotisation rappel).
   - Stockage dans `notification_provider_settings` (table existante).
   - **Pas d'envoi réel dans ce lot** — juste la config + test "envoyer un mail test".
   - Secret `BREVO_API_KEY` à ajouter via secrets tool (je vous le demanderai au moment voulu).

## Lot 2 — Industrialisation

5. **Import masse Excel/CSV des membres**
   - Page `/admin/membres` → bouton "Importer".
   - Parse côté client (xlsx), preview, mapping colonnes → serverFn `bulk_import_members` avec validation Zod par ligne.
   - Table `member_imports` (existante) pour traçabilité.

6. **Reçus PDF par transaction**
   - À la création/validation d'une transaction (`cotisations` ou `transactions_miprojet`), bouton "Télécharger reçu PDF" + génération à la demande (jspdf, déjà installé), cachet + QR vérif.

7. **Cron retards J+3 / J+7 / J+14**
   - Route publique `/api/public/cron/cotisation-reminders` (signature HMAC).
   - Détecte cotisations en retard et enqueue dans `notification_queue`.
   - Cron à configurer côté Supabase (pg_cron) — je fournirai le SQL.

8. **Queue notifications + worker**
   - Route publique `/api/public/cron/process-notifications` qui drain `notification_queue` via Brevo.
   - Retry x3, statuts `pending/sent/failed/dlq`, log dans `notifications_log`.

9. **Rate limiting**
   - serverFn middleware utilisant `rate_limit_counters` (table existante) — fenêtre glissante par IP+endpoint pour `/login`, `/inscription`, `/contact`.

10. **Mode offline carte membre**
    - Service worker (`public/sw.js`) → cache la route `/membre/carte` + assets.
    - Stockage IndexedDB de la dernière carte rendue (PNG) pour affichage offline.

11. **README technique + RGPD**
    - `README.md` : stack, env, déploiement, cron, secrets.
    - Checkbox consentement RGPD sur `/inscription` + page `/confidentialite` (politique).

## Détails techniques

- **Migrations DB requises** :
  - Trigger `apply_art71_on_member_activation()`.
  - Fonction `enqueue_cotisation_reminders()` (utilisée par cron J+3/7/14).
  - Index sur `notification_queue(status, scheduled_at)`.
  - Index sur `cotisations(member_id, due_date, status)`.
- **Secrets à créer** : `BREVO_API_KEY`, `CRON_WEBHOOK_SECRET`.
- **Dépendances npm** : `xlsx` (import Excel), `@react-email/components` (pas requis ici, on reste sur Brevo direct).
- **Parallélisation réelle** : Lot 1 et Lot 2 sont indépendants côté code, mais 5/6/8 dépendent de la migration Art.71 (#1) pour les tests bout-en-bout. Je les exécute dans l'ordre : migrations DB → serverFns → UI → cron.

## Questions de blocage avant de lancer

1. **Brevo** : avez-vous déjà un compte Brevo + clé API prête, ou je crée juste l'UI vide pour que vous la collez plus tard ? (Lot 1 #4)
2. **Cron J+3/7/14** : devra être déclenché par un planificateur externe (pg_cron Supabase, ou cron-job.org). OK pour pg_cron ?
3. **Barème Art. 71** : confirmez les montants exacts (droit d'adhésion, cotisation mensuelle de base) — sinon je mets des constantes paramétrables dans une table `config`.
4. **Import CSV** : format attendu (colonnes obligatoires) — ou je propose un template basé sur la structure `members` actuelle ?

Approuvez le plan (avec réponses aux 4 questions) et je démarre la mise en œuvre dans l'ordre indiqué.
