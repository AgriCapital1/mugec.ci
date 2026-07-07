import { MemberCardFace, type CardMember } from "@/components/MemberCardFace";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import logo from "@/assets/mugec-logo.png";
import { Download, Printer, Loader2, RefreshCcw } from "lucide-react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  cardVerifyUrl,
  DEFAULT_MEMBER_CARD_CONFIG,
  MEMBER_CARD_CONFIG_KEY,
  MEMBER_CARD_HEIGHT_MM,
  MEMBER_CARD_WIDTH_MM,
  normalizeMemberCardConfig,
  type MemberCardConfig,
} from "@/lib/member-card";

export const Route = createFileRoute("/membre/carte")({ ssr: false, component: Page });

type Member = CardMember & {
  id?: string | null;
  email?: string | null;
  telephone?: string | null;
  cni?: string | null;
  date_naissance?: string | null;
  lieu_naissance?: string | null;
  statut?: string | null;
  type_membre?: string | null;
  qr_code?: string | null;
};

async function generateQrWithLogo(text: string, logoSrc: string): Promise<string> {
  const size = 512;
  const qrDataUrl = await QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#0e2f6b", light: "#ffffff" },
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject();
    qrImg.src = qrDataUrl;
  });
  ctx.drawImage(qrImg, 0, 0, size, size);
  try {
    const lg = new Image();
    lg.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      lg.onload = () => resolve();
      lg.onerror = () => reject();
      lg.src = logoSrc;
    });
    const badge = Math.round(size * 0.22);
    const cx = (size - badge) / 2;
    const cy = (size - badge) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 6, cy - 6, badge + 12, badge + 12);
    ctx.drawImage(lg, cx, cy, badge, badge);
  } catch {
    // le QR reste valide même si l'incrustation du logo échoue
  }
  return canvas.toDataURL("image/png");
}

function Page() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const rectoRef = useRef<HTMLDivElement>(null);
  const versoRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Member>({});
  const [config, setConfig] = useState<MemberCardConfig>(DEFAULT_MEMBER_CARD_CONFIG);
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string>("pending");

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) nav({ to: "/login" });
  }, [loading, user, nav]);

  async function loadAll() {
    if (user && isSupabaseConfigured) {
      const [{ data: member }, { data: cfg }] = await Promise.all([
        supabase.from("members").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("app_config").select("config_value").eq("config_key", MEMBER_CARD_CONFIG_KEY).maybeSingle(),
      ]);
      if (member) setM(member as Member);
      setConfig(normalizeMemberCardConfig((cfg as any)?.config_value));
    } else {
      setM({
        id: "demo",
        nom: "DEMO",
        prenoms: "Utilisateur",
        email: "demo@mugec-ci.org",
        telephone: "+225 00 00 00 00",
        collectivite: "Mairie de Cocody",
        fonction: "Agent administratif",
        matricule: "MUGEC-2026-0001",
        cni: "CI00000000",
        date_naissance: "1985-04-12",
        lieu_naissance: "Abidjan",
        sexe: "M",
        nationalite: "Ivoirienne",
        date_inscription: new Date().toISOString(),
      });
    }
  }

  useEffect(() => {
    loadAll();
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("member-card-live-config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_config", filter: `config_key=eq.${MEMBER_CARD_CONFIG_KEY}` },
        () => loadAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const id = m.matricule ?? user?.id ?? "demo";
    const verifyUrl = m.qr_code ?? cardVerifyUrl(config, id);
    generateQrWithLogo(verifyUrl, logo).then(setQr).catch(() => {
      QRCode.toDataURL(verifyUrl, { width: 420, margin: 2, errorCorrectionLevel: "H" }).then(setQr);
    });
  }, [m, user, config]);

  useEffect(() => {
    if (!m.id || !isSupabaseConfigured) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("member_card_renders")
        .select("render_status")
        .eq("member_id", m.id)
        .maybeSingle();
      setRenderStatus(data?.render_status ?? "ready");
    })();
  }, [m.id, qr]);

  async function capture(el: HTMLDivElement) {
    return html2canvas(el, { scale: 4, backgroundColor: null, useCORS: true, logging: false });
  }

  async function markReady() {
    if (!m.id || !isSupabaseConfigured) return;
    await (supabase as any).from("member_card_renders").upsert({
      member_id: m.id,
      config_key: MEMBER_CARD_CONFIG_KEY,
      render_status: "ready",
      render_payload: { source: "client_pdf", matricule: m.matricule ?? null },
      rendered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "member_id,config_key" });
    setRenderStatus("ready");
  }

  async function downloadPDF() {
    if (!rectoRef.current || !versoRef.current) return;
    setBusy(true);
    try {
      const rectoCanvas = await capture(rectoRef.current);
      const versoCanvas = await capture(versoRef.current);
      const pdf = new jsPDF({ unit: "mm", format: [MEMBER_CARD_WIDTH_MM, MEMBER_CARD_HEIGHT_MM], orientation: "landscape" });
      pdf.addImage(rectoCanvas.toDataURL("image/png"), "PNG", 0, 0, MEMBER_CARD_WIDTH_MM, MEMBER_CARD_HEIGHT_MM, undefined, "FAST");
      pdf.addPage([MEMBER_CARD_WIDTH_MM, MEMBER_CARD_HEIGHT_MM], "landscape");
      pdf.addImage(versoCanvas.toDataURL("image/png"), "PNG", 0, 0, MEMBER_CARD_WIDTH_MM, MEMBER_CARD_HEIGHT_MM, undefined, "FAST");
      pdf.save(`carte-mugec-${m.matricule ?? "membre"}.pdf`);
      await markReady();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <MembreLayout title="Carte de membre" subtitle="Format CR80 officiel — preview strictement identique au PDF">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Votre carte membre</h2>
            <p className="text-sm text-muted-foreground">Le PDF est généré depuis les mêmes éléments que l’aperçu écran.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadAll}><RefreshCcw className="mr-2 h-4 w-4" /> Synchroniser</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimer</Button>
            <Button onClick={downloadPDF} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{busy ? "Génération…" : "Télécharger le PDF"}</Button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-2 overflow-x-auto">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground"><span>Recto</span><span>{renderStatus === "pending" ? "À régénérer" : "À jour"}</span></div>
            <div ref={rectoRef} className="inline-block"><MemberCardFace side="front" member={m} config={config} qr={qr} /></div>
          </div>
          <div className="space-y-2 overflow-x-auto">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verso</div>
            <div ref={versoRef} className="inline-block"><MemberCardFace side="back" member={m} config={config} qr={qr} /></div>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted-foreground">
            <span>CR80 · {MEMBER_CARD_WIDTH_MM} × {MEMBER_CARD_HEIGHT_MM} mm</span>
            <span>Configuration centrale : {MEMBER_CARD_CONFIG_KEY}</span>
            <span className="ml-auto">Propagation automatique activée</span>
          </CardContent>
        </Card>
      </section>
    </MembreLayout>
  );
}
