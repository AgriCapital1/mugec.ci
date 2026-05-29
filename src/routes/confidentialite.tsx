import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/confidentialite")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Politique de confidentialité & mentions légales — MUGEC-CI" },
      {
        name: "description",
        content:
          "Politique de confidentialité, traitement des données personnelles (RGPD) et mentions légales de la Mutuelle Générale du Personnel des Collectivités Territoriales de Côte d'Ivoire (MUGEC-CI).",
      },
    ],
  }),
});

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">
          Politique de confidentialité & mentions légales
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
        </p>

        <section className="prose prose-slate mt-8 max-w-none text-sm leading-relaxed">
          <h2>1. Éditeur</h2>
          <p>
            Le présent site est édité par la <strong>Mutuelle Générale du Personnel des
            Collectivités Territoriales de Côte d'Ivoire</strong> (MUGEC-CI), mutuelle régie
            par les textes en vigueur en République de Côte d'Ivoire.
          </p>
          <ul>
            <li>Siège : Abidjan, Côte d'Ivoire</li>
            <li>Email : contact@mugec-ci.org</li>
            <li>Téléphone : 07 58 89 43 63 / 07 08 27 67 51</li>
          </ul>

          <h2>2. Données collectées</h2>
          <p>
            Dans le cadre de l'adhésion et de la gestion des prestations, la MUGEC-CI
            collecte les données suivantes :
          </p>
          <ul>
            <li>Identité (nom, prénoms, date et lieu de naissance, sexe, CNI / passeport) ;</li>
            <li>Coordonnées (email, téléphone WhatsApp, adresse postale) ;</li>
            <li>Situation professionnelle (collectivité, direction, matricule solde, fonction) ;</li>
            <li>Photo d'identité et pièces justificatives ;</li>
            <li>Ayants-droit déclarés et pièces associées ;</li>
            <li>Historique de cotisations, paiements et prestations ;</li>
            <li>Données techniques de connexion strictement nécessaires (logs sécurité).</li>
          </ul>

          <h2>3. Finalités</h2>
          <ul>
            <li>Instruction et validation des adhésions ;</li>
            <li>Gestion des cotisations, prélèvements et reçus ;</li>
            <li>Traitement des demandes de prestations sociales ;</li>
            <li>Communication mutualiste (notifications, relances cotisations) ;</li>
            <li>Respect des obligations légales et comptables.</li>
          </ul>

          <h2>4. Base légale</h2>
          <p>
            Les traitements reposent sur (i) l'exécution du contrat mutualiste, (ii) le
            respect d'obligations légales et (iii) le consentement explicite recueilli au
            moment de l'inscription pour les communications non strictement contractuelles.
          </p>

          <h2>5. Destinataires</h2>
          <p>
            Les données sont accessibles uniquement aux services internes habilités de la
            MUGEC-CI, à son partenaire de paiement <strong>MIPROJET</strong> pour les flux
            financiers, et à ses sous-traitants techniques (hébergement sécurisé,
            messagerie transactionnelle). Aucune donnée n'est cédée à des tiers à des fins
            commerciales.
          </p>

          <h2>6. Durée de conservation</h2>
          <ul>
            <li>Données d'adhésion actives : pendant toute la durée d'affiliation ;</li>
            <li>Archives comptables : 10 ans à compter de la clôture de l'exercice ;</li>
            <li>Données techniques (logs) : 12 mois maximum.</li>
          </ul>

          <h2>7. Vos droits</h2>
          <p>
            Conformément aux dispositions de la loi n°2013-450 du 19 juin 2013 relative à
            la protection des données à caractère personnel en Côte d'Ivoire et aux
            principes du RGPD, vous disposez d'un droit d'accès, de rectification,
            d'opposition, de portabilité, de limitation et d'effacement. Vous pouvez
            exercer ces droits à tout moment en écrivant à&nbsp;:
            <a href="mailto:contact@mugec-ci.org"> contact@mugec-ci.org</a>.
          </p>

          <h2>8. Sécurité</h2>
          <p>
            Les données sont stockées sur une infrastructure chiffrée, avec contrôle
            d'accès par rôle (RBAC) et journalisation des opérations sensibles. Les mots
            de passe sont hachés (bcrypt) et ne sont jamais accessibles en clair.
          </p>

          <h2>9. Cookies</h2>
          <p>
            Le site n'utilise que des cookies techniques nécessaires à l'authentification
            et à la sécurité de votre session. Aucun cookie publicitaire ou de pistage
            tiers n'est déposé.
          </p>

          <h2>10. Contact & réclamation</h2>
          <p>
            Pour toute question relative au traitement de vos données ou pour formuler
            une réclamation, contactez le délégué à la protection des données :
            <a href="mailto:contact@mugec-ci.org"> contact@mugec-ci.org</a>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
