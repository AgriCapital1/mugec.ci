import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MemberCardFace } from "@/components/MemberCardFace";
import { DEFAULT_MEMBER_CARD_CONFIG, MEMBER_CARD_CONFIG_KEY, normalizeMemberCardConfig, cardVerifyUrl, type MemberCardConfig } from "@/lib/member-card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, RefreshCcw, Save, Wand2 } from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/admin/parametres-carte")({ ssr: false, component: CardSettingsPage });

const SAMPLE_MEMBER = {
  nom: "ZERE",
  prenoms: "BERNARD KOUADIO",
  sexe: "M",
  nationalite: "Ivoirienne",
  fonction: "Enseignant titulaire",
  collectivite: "EPP Divo 2, Abidjan",
  matricule: "MUGEC-2026-0001",
  date_inscription: "2026-07-06T00:00:00.000Z",
  photo_url: null,
};

function CardSettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<MemberCardConfig>(DEFAULT_MEMBER_CARD_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batching, setBatching] = useState(false);
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState<{ pending: number; ready: number; failed: number }>({ pending: 0, ready: 0, failed: 0 });

  const fields = useMemo<Array<{ key: keyof MemberCardConfig; label: string; area?: boolean }>>(() => [
    { key: "organizationName", label: "Nom organisation" },
    { key: "organizationSubtitle", label: "Sous-titre" },
    { key: "cardTitle", label: "Titre carte" },
    { key: "countryLabel", label: "Pays / institution" },
    { key: "primaryPhone", label: "Téléphone 1" },
    { key: "secondaryPhone", label: "Téléphone 2" },
    { key: "website", label: "Site web" },
    { key: "verificationBaseUrl", label: "URL vérification" },
    { key: "coordinatorTitle", label: "Titre signataire" },
    { key: "coordinatorName", label: "Nom signataire" },
    { key: "signatureLabel", label: "Signature affichée" },
    { key: "ownershipNotice", label: "Mention propriété", area: true },
    { key: "lostNotice", label: "Mention perte", area: true },
    { key: "returnNotice", label: "Mention fraude", area: true },
    { key: "primaryColor", label: "Couleur primaire" },
    { key: "secondaryColor", label: "Couleur secondaire" },
    { key: "accentColor", label: "Couleur accent" },
    { key: "frontGradientFrom", label: "Recto départ" },
    { key: "frontGradientTo", label: "Recto fin" },
    { key: "backGradientFrom", label: "Verso départ" },
    { key: "backGradientTo", label: "Verso fin" },
  ], []);

  async function load() {
    setLoading(true);
    const [{ data }, counts] = await Promise.all([
      supabase.from("app_config").select("config_value").eq("config_key", MEMBER_CARD_CONFIG_KEY).maybeSingle(),
      loadCounts(),
    ]);
    setConfig(normalizeMemberCardConfig((data as any)?.config_value));
    setStatus(counts);
    setLoading(false);
  }

  async function loadCounts() {
    const { data } = await (supabase as any).from("member_card_renders").select("render_status").limit(10000);
    const rows = (data ?? []) as Array<{ render_status: string }>;
    return {
      pending: rows.filter((r) => r.render_status === "pending").length,
      ready: rows.filter((r) => r.render_status === "ready").length,
      failed: rows.filter((r) => r.render_status === "failed").length,
    };
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    QRCode.toDataURL(cardVerifyUrl(config, SAMPLE_MEMBER.matricule), { width: 420, margin: 2, errorCorrectionLevel: "H" }).then(setQr);
  }, [config]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("app_config").upsert({
      config_key: MEMBER_CARD_CONFIG_KEY,
      config_value: config as any,
      description: "Configuration CRUD carte membre",
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    } as any);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Paramètres enregistrés — propagation lancée.");
      load();
    }
  }

  async function regenerateAll() {
    setBatching(true);
    const { error } = await supabase.rpc("enqueue_member_card_regeneration", { _reason: "manual_admin_batch" } as any);
    setBatching(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Régénération batch terminée : toutes les cartes sont remises en file.");
      load();
    }
  }

  function setValue(key: keyof MemberCardConfig, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Paramètres carte membre" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CRUD paramètres carte</h1>
            <p className="text-sm text-muted-foreground">Chaque modification met automatiquement à jour les cartes existantes et futures.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">En attente : {status.pending}</Badge>
            <Badge variant="outline">Prêtes : {status.ready}</Badge>
            <Badge variant={status.failed ? "destructive" : "outline"}>Échecs : {status.failed}</Badge>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres modifiables</CardTitle>
              <CardDescription>Contenus, coordonnées, mentions légales et charte graphique.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div> : (
                <div className="grid gap-4 md:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.key} className={field.area ? "md:col-span-2" : ""}>
                      <Label htmlFor={field.key}>{field.label}</Label>
                      {field.area ? <Textarea id={field.key} value={config[field.key]} onChange={(e) => setValue(field.key, e.target.value)} rows={3} /> : <Input id={field.key} value={config[field.key]} onChange={(e) => setValue(field.key, e.target.value)} />}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button onClick={save} disabled={saving || loading}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer</Button>
                <Button variant="outline" onClick={regenerateAll} disabled={batching || loading}>{batching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />} Régénérer toutes les cartes</Button>
                <Button variant="ghost" onClick={() => setConfig(DEFAULT_MEMBER_CARD_CONFIG)}><Wand2 className="mr-2 h-4 w-4" /> Réinitialiser aperçu</Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Aperçu officiel</CardTitle>
                <CardDescription>Même composant que le PDF imprimé.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-x-auto">
                <MemberCardFace side="front" member={SAMPLE_MEMBER} config={config} qr={qr} />
                <MemberCardFace side="back" member={SAMPLE_MEMBER} config={config} qr={qr} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
