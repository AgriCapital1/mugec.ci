import { MemberAvatarImg } from "@/components/MemberAvatar";
import type { MemberCardConfig } from "@/lib/member-card";
import logo from "@/assets/mugec-logo.png";

export type CardMember = {
  nom?: string | null;
  prenoms?: string | null;
  matricule?: string | null;
  photo_url?: string | null;
  collectivite?: string | null;
  fonction?: string | null;
  sexe?: string | null;
  nationalite?: string | null;
  date_inscription?: string | null;
};

export function MemberCardFace({
  side,
  member,
  config,
  qr,
  className,
}: {
  side: "front" | "back";
  member: CardMember;
  config: MemberCardConfig;
  qr: string;
  className?: string;
}) {
  const name = `${member.nom ?? ""} ${member.prenoms ?? ""}`.trim() || "—";
  const adhesion = member.date_inscription
    ? new Date(member.date_inscription).toLocaleDateString("fr-FR")
    : "—";

  if (side === "back") {
    return (
      <div
        className={`relative overflow-hidden text-slate-800 shadow-2xl ring-1 ring-black/10 ${className ?? ""}`}
        style={{
          width: "428px",
          height: "270px",
          borderRadius: 14,
          background: `linear-gradient(160deg, ${config.backGradientFrom} 0%, ${config.backGradientTo} 100%)`,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div className="absolute inset-y-0 left-0 w-2" style={{ background: `linear-gradient(180deg, ${config.primaryColor}, ${config.secondaryColor}, ${config.accentColor})` }} />
        <img src={logo} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" />
        <div className="relative flex h-full flex-col px-5 py-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <img src={logo} alt="" className="h-7 w-7 object-contain" />
            <div className="text-[13px] font-black uppercase tracking-[0.16em]" style={{ color: config.primaryColor }}>{config.organizationName}</div>
            <div className="ml-auto text-[9px] font-medium uppercase tracking-wide text-slate-500">{config.countryLabel}</div>
          </div>
          <div className="mt-2 space-y-1.5 text-[10px] leading-snug text-slate-700">
            <p><strong>{config.ownershipNotice}</strong></p>
            <p>{config.lostNotice}</p>
            <p className="italic text-slate-600">{config.returnNotice}</p>
          </div>
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-200 pt-2">
            <div className="space-y-0.5 text-[9px] text-slate-700">
              <div><span className="font-semibold" style={{ color: config.primaryColor }}>Tél :</span> {config.primaryPhone} / {config.secondaryPhone}</div>
              <div><span className="font-semibold" style={{ color: config.primaryColor }}>Web :</span> {config.website}</div>
              <div className="font-mono" style={{ color: config.primaryColor }}>Mat : {member.matricule ?? "—"}</div>
            </div>
            {qr ? <img src={qr} alt="QR code de vérification" className="h-[58px] w-[58px] rounded-sm bg-white p-[2px] shadow ring-1 ring-slate-200" /> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden text-slate-800 shadow-2xl ring-1 ring-black/10 ${className ?? ""}`}
      style={{
        width: "428px",
        height: "270px",
        borderRadius: 14,
        background: `linear-gradient(135deg, ${config.frontGradientFrom} 0%, #d5e6ff 48%, ${config.frontGradientTo} 100%)`,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <img src={logo} alt="" aria-hidden className="pointer-events-none absolute -right-8 -bottom-8 h-56 w-56 opacity-[0.06]" />
      <div className="flex items-center gap-2 px-4 pt-3">
        <img src={logo} alt="MUGEC-CI" className="h-10 w-10 object-contain" />
        <div className="min-w-0 leading-tight">
          <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: config.primaryColor }}>{config.organizationSubtitle}</div>
          <div className="text-[12px] font-black uppercase tracking-wide" style={{ color: config.primaryColor }}>{config.organizationName}</div>
        </div>
        <div className="ml-auto flex h-8 w-12 overflow-hidden rounded-sm shadow ring-1 ring-black/10" aria-label="Drapeau Côte d’Ivoire">
          <div className="h-full w-1/3" style={{ background: "#F77F00" }} />
          <div className="h-full w-1/3 bg-white" />
          <div className="h-full w-1/3" style={{ background: "#009E60" }} />
        </div>
      </div>
      <div className="mx-4 mt-2 px-3 py-1 text-center text-[14px] font-black uppercase tracking-[0.14em] text-white" style={{ background: config.primaryColor }}>
        {config.cardTitle}
      </div>
      <div className="grid grid-cols-[1fr_104px] gap-3 px-4 pt-3">
        <div className="space-y-[4px] text-[10px] leading-[1.14] text-slate-800">
          <Line color={config.primaryColor} k="Nom" v={member.nom ?? "—"} />
          <Line color={config.primaryColor} k="Prénoms" v={member.prenoms ?? "—"} />
          <Line color={config.primaryColor} k="Sexe" v={member.sexe ?? "—"} />
          <Line color={config.primaryColor} k="Nationalité" v={member.nationalite ?? "Ivoirienne"} />
          <Line color={config.primaryColor} k="Fonction" v={member.fonction ?? "—"} />
          <Line color={config.primaryColor} k="École" v={member.collectivite ?? "—"} />
          <Line color={config.primaryColor} k="Date d’adhésion" v={adhesion} />
          <Line color={config.primaryColor} k="Matricule" v={member.matricule ?? "—"} mono />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-[112px] w-[92px] overflow-hidden rounded-md bg-white shadow-md ring-2 ring-white">
            <MemberAvatarImg src={member.photo_url} alt={name} className="h-full w-full object-cover" />
          </div>
          <div className="w-full text-center text-[7px] font-bold uppercase leading-tight" style={{ color: config.primaryColor }}>{config.coordinatorTitle}</div>
          {qr ? <img src={qr} alt="QR code de vérification" className="h-[42px] w-[42px] rounded-sm bg-white p-[2px] shadow" /> : null}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-[1fr_118px] items-center border-t border-white/60 bg-white/75 px-4 py-1 text-[8px] backdrop-blur-sm">
        <span className="font-semibold italic text-slate-700">{config.signatureLabel}</span>
        <span className="text-right font-semibold text-slate-700">{config.coordinatorName}</span>
      </div>
    </div>
  );
}

function Line({ color, k, v, mono }: { color: string; k: string; v: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-1">
      <span className="font-black uppercase" style={{ color }}>{k}:</span>
      <span className={`truncate font-semibold ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  );
}
