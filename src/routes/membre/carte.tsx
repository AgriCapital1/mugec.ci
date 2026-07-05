import { MemberAvatarImg } from "@/components/MemberAvatar";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import logo from "@/assets/mugec-logo.png";
import { Download, Printer, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/membre/carte")({ component: Page });

type Member = {
  nom?: string; prenoms?: string; email?: string; telephone?: string;
  collectivite?: string; region?: string; fonction?: string; matricule?: string;
  cni?: string; date_naissance?: string; lieu_naissance?: string;
  date_inscription?: string; statut?: string; type_membre?: string;
  photo_url?: string; qr_code?: string; sexe?: string; nationalite?: string;
};

// Génère un QR code haute correction avec le logo MUGEC-CI incrusté au centre.
async function generateQrWithLogo(text: string, logoSrc: string): Promise<string> {
  const size = 512;
  const qrDataUrl = await QRCode.toDataURL(text, {
    width: size, margin: 2, errorCorrectionLevel: "H",
    color: { dark: "#0e2f6b", light: "#ffffff" },
  });
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const qrImg = new Image();
  await new Promise<void>((r, j) => { qrImg.onload = () => r(); qrImg.onerror = () => j(); qrImg.src = qrDataUrl; });
  ctx.drawImage(qrImg, 0, 0, size, size);
  try {
    const lg = new Image(); lg.crossOrigin = "anonymous";
    await new Promise<void>((r, j) => { lg.onload = () => r(); lg.onerror = () => j(); lg.src = logoSrc; });
    const badge = Math.round(size * 0.22);
    const cx = (size - badge) / 2, cy = (size - badge) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 6, cy - 6, badge + 12, badge + 12);
    ctx.drawImage(lg, cx, cy, badge, badge);
  } catch { /* logo optionnel */ }
  return canvas.toDataURL("image/png");
}

function Page() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const rectoRef = useRef<HTMLDivElement>(null);
  const versoRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Member>({});
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) nav({ to: "/login" });
  }, [loading, user, nav]);

  useEffect(() => {
    (async () => {
      if (user && isSupabaseConfigured) {
        const { data } = await supabase.from("members").select("*").eq("user_id", user.id).maybeSingle();
        if (data) setM(data as Member);
      } else {
        setM({
          nom: "DEMO", prenoms: "Utilisateur", email: "demo@mugec-ci.org",
          telephone: "+225 00 00 00 00", collectivite: "Mairie de Cocody",
          region: "Abidjan", fonction: "Agent administratif",
          matricule: "MUGEC-2026-0001", cni: "CI00000000",
          date_naissance: "1985-04-12", lieu_naissance: "Abidjan",
          sexe: "M", nationalite: "Ivoirienne",
        });
      }
    })();
  }, [user]);

  useEffect(() => {
    const id = m.matricule ?? user?.id ?? "demo";
    const verifyUrl = m.qr_code ?? `https://mugec-ci.ivoireprojet.com/verifier/${encodeURIComponent(id)}`;
    generateQrWithLogo(verifyUrl, logo).then(setQr).catch(() => {
      QRCode.toDataURL(verifyUrl, { width: 420, margin: 2, errorCorrectionLevel: "H" }).then(setQr);
    });
  }, [m, user]);

  async function downloadPDF() {
    if (!rectoRef.current || !versoRef.current) return;
    setBusy(true);
    try {
      const opts = { scale: 4, backgroundColor: null as unknown as string, useCORS: true, logging: false };
      const rectoCanvas = await html2canvas(rectoRef.current, opts);
      const versoCanvas = await html2canvas(versoRef.current, opts);
      const pdf = new jsPDF({ unit: "mm", format: [85.6, 54], orientation: "landscape" });
      pdf.addImage(rectoCanvas.toDataURL("image/png"), "PNG", 0, 0, 85.6, 54, undefined, "FAST");
      pdf.addPage([85.6, 54], "landscape");
      pdf.addImage(versoCanvas.toDataURL("image/png"), "PNG", 0, 0, 85.6, 54, undefined, "FAST");
      pdf.save(`carte-mugec-${m.matricule ?? "membre"}.pdf`);
    } finally { setBusy(false); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const fullName = `${m.nom ?? ""} ${m.prenoms ?? ""}`.trim() || "—";
  const dateAdhesion = m.date_inscription ? new Date(m.date_inscription).toLocaleDateString("fr-FR") : "—";

  return (
    <MembreLayout title="Carte de membre" subtitle="Format CR80 — recto / verso officiel MUGEC-CI">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Votre carte membre</h2>
            <p className="text-sm text-muted-foreground">
              L'aperçu ci-dessous correspond exactement au rendu imprimé (85,6 × 54 mm).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimer
            </Button>
            <Button onClick={downloadPDF} disabled={busy} className="bg-primary">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {busy ? "Génération…" : "Télécharger le PDF"}
            </Button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* RECTO */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recto</div>
            <div className="mx-auto" style={{ width: "100%", maxWidth: 428 }}>
              <div
                ref={rectoRef}
                className="relative overflow-hidden rounded-xl text-slate-800 shadow-2xl ring-1 ring-black/5"
                style={{
                  aspectRatio: "85.6 / 54",
                  background: "linear-gradient(135deg,#eaf2ff 0%,#d5e6ff 45%,#c5dbf5 100%)",
                }}
              >
                {/* Filigrane logo */}
                <img src={logo} alt="" aria-hidden
                  className="pointer-events-none absolute -right-6 -bottom-6 h-52 w-52 opacity-[0.06]" />

                {/* Header : logo + titre + drapeau CI */}
                <div className="flex items-center gap-2 px-3 pt-2.5">
                  <img src={logo} alt="MUGEC-CI" className="h-9 w-9 object-contain" />
                  <div className="min-w-0 leading-tight">
                    <div className="text-[10px] font-black uppercase tracking-wide text-[#0e2f6b]">Association des</div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-[#0e2f6b]">Instituteurs</div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-[#0e2f6b]">MUGEC-CI</div>
                  </div>
                  <div className="ml-auto flex h-7 w-10 overflow-hidden rounded-sm shadow ring-1 ring-black/10">
                    <div className="h-full w-1/3" style={{ background: "#F77F00" }} />
                    <div className="h-full w-1/3 bg-white" />
                    <div className="h-full w-1/3" style={{ background: "#009E60" }} />
                  </div>
                </div>

                {/* Bandeau CARTE DE MEMBRE */}
                <div className="mx-3 mt-1.5 rounded-md px-2.5 py-1 text-center text-[11px] font-extrabold uppercase tracking-[0.22em] text-white"
                     style={{ background: "linear-gradient(90deg,#0e2f6b,#1e5ba8)" }}>
                  Carte de membre
                </div>

                {/* Corps : infos + photo */}
                <div className="grid grid-cols-[1fr_86px] gap-2 px-3 pt-2">
                  <div className="space-y-[3px] text-[9px] leading-[1.15] text-slate-800">
                    <Line k="NOM" v={m.nom ?? "—"} />
                    <Line k="PRÉNOMS" v={m.prenoms ?? "—"} />
                    <Line k="SEXE" v={m.sexe ?? "—"} />
                    <Line k="NATIONALITÉ" v={m.nationalite ?? "Ivoirienne"} />
                    <Line k="FONCTION" v={m.fonction ?? "—"} />
                    <Line k="COLLECTIVITÉ" v={m.collectivite ?? "—"} />
                    <Line k="MATRICULE" v={m.matricule ?? "—"} mono />
                    <Line k="DATE D'ADHÉSION" v={dateAdhesion} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-[104px] w-[82px] overflow-hidden rounded-md bg-white ring-2 ring-white shadow-md">
                      <MemberAvatarImg src={m.photo_url} alt={fullName} className="h-full w-full object-cover" />
                    </div>
                    {qr ? (
                      <img src={qr} alt="QR" className="h-[46px] w-[46px] rounded-sm bg-white p-[2px] shadow" />
                    ) : <div className="h-[46px] w-[46px] rounded-sm bg-white/60" />}
                  </div>
                </div>

                {/* Bandeau bas coordonnateur */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-white/40 bg-white/70 px-3 py-1 text-[8px] backdrop-blur-sm">
                  <span className="font-semibold uppercase tracking-wider text-[#0e2f6b]">Coordonnateur Général</span>
                  <span className="italic text-slate-700">Mme N'GUESSAN Clarisse</span>
                </div>
              </div>
            </div>
          </div>

          {/* VERSO */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verso</div>
            <div className="mx-auto" style={{ width: "100%", maxWidth: 428 }}>
              <div
                ref={versoRef}
                className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/5"
                style={{
                  aspectRatio: "85.6 / 54",
                  background: "linear-gradient(160deg,#ffffff 0%,#f1f6ff 60%,#e4f0ff 100%)",
                }}
              >
                <div className="absolute inset-y-0 left-0 w-1.5"
                  style={{ background: "linear-gradient(180deg,#0e2f6b,#1e5ba8,#2baa8a)" }} />

                <img src={logo} alt="" aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" />

                <div className="relative flex h-full flex-col px-4 py-2.5 text-slate-800">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                    <img src={logo} alt="" className="h-6 w-6 object-contain" />
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0e2f6b]">MUGEC-CI</div>
                    <div className="ml-auto text-[8px] font-medium uppercase tracking-wider text-slate-500">
                      République de Côte d'Ivoire
                    </div>
                  </div>

                  <div className="mt-1.5 space-y-1 text-[8.5px] leading-snug text-slate-700">
                    <p>
                      Cette carte est <strong>strictement personnelle et non cessible</strong>.
                      Elle demeure la propriété exclusive de la MUGEC-CI.
                    </p>
                    <p>
                      En cas de perte, prière de la déposer à la <strong>mairie</strong> ou au
                      <strong> conseil régional le plus proche</strong>, ou de contacter la MUGEC-CI.
                    </p>
                    <p className="italic text-slate-600">
                      Toute utilisation frauduleuse expose son auteur à des poursuites judiciaires.
                    </p>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-200 pt-1.5">
                    <div className="space-y-0.5 text-[8px] text-slate-700">
                      <div><span className="font-semibold text-[#0e2f6b]">Tél :</span> 07 58 89 43 63 / 07 08 27 67 51</div>
                      <div><span className="font-semibold text-[#0e2f6b]">Web :</span> mugec-ci.ivoireprojet.com</div>
                      <div className="font-mono text-[#0e2f6b]">Mat : {m.matricule ?? "—"}</div>
                    </div>
                    {qr ? (
                      <img src={qr} alt="QR" className="h-[54px] w-[54px] rounded-sm bg-white p-[2px] shadow ring-1 ring-slate-200" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#0e2f6b" }} /> Bleu MUGEC
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#2baa8a" }} /> Teal
            </span>
            <span className="ml-auto">CR80 · 85,6 × 54 mm · QR avec logo incrusté (H)</span>
          </CardContent>
        </Card>
      </section>
    </MembreLayout>
  );
}

function Line({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-1">
      <span className="min-w-[70px] font-bold uppercase tracking-wide text-[#0e2f6b]">{k}</span>
      <span className={`truncate ${mono ? "font-mono" : ""}`}>: {v}</span>
    </div>
  );
}
