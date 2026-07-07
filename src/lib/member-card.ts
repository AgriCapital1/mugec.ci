import type { Json } from "@/integrations/supabase/types";

export const MEMBER_CARD_CONFIG_KEY = "member_card";
export const MEMBER_CARD_WIDTH_MM = 85.6;
export const MEMBER_CARD_HEIGHT_MM = 53.98;

export type MemberCardConfig = {
  organizationName: string;
  organizationSubtitle: string;
  cardTitle: string;
  countryLabel: string;
  primaryPhone: string;
  secondaryPhone: string;
  website: string;
  verificationBaseUrl: string;
  coordinatorTitle: string;
  coordinatorName: string;
  signatureLabel: string;
  ownershipNotice: string;
  lostNotice: string;
  returnNotice: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  frontGradientFrom: string;
  frontGradientTo: string;
  backGradientFrom: string;
  backGradientTo: string;
};

export const DEFAULT_MEMBER_CARD_CONFIG: MemberCardConfig = {
  organizationName: "MUGEC-CI",
  organizationSubtitle: "Association des Instituteurs d’Abidjan",
  cardTitle: "Carte de membre",
  countryLabel: "République de Côte d’Ivoire",
  primaryPhone: "07 58 89 43 63",
  secondaryPhone: "07 08 27 67 51",
  website: "mugecci.lovable.app",
  verificationBaseUrl: "https://mugecci.lovable.app/verifier",
  coordinatorTitle: "Coordonnateur Général",
  coordinatorName: "Mme N’GUESSAN Clarisse",
  signatureLabel: "Mme N’Guessan Clarisse",
  ownershipNotice: "Cette carte demeure la propriété exclusive de la MUGEC-CI.",
  lostNotice: "Carte strictement personnelle et non cessible. En cas de perte, prière de la déposer à la mairie ou au conseil régional le plus proche.",
  returnNotice: "Toute utilisation frauduleuse expose son auteur à des poursuites judiciaires.",
  primaryColor: "#0e2f6b",
  secondaryColor: "#1e5ba8",
  accentColor: "#2baa8a",
  frontGradientFrom: "#eaf2ff",
  frontGradientTo: "#c5dbf5",
  backGradientFrom: "#ffffff",
  backGradientTo: "#e4f0ff",
};

export function normalizeMemberCardConfig(value: Json | unknown): MemberCardConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_MEMBER_CARD_CONFIG;
  const raw = value as Record<string, unknown>;
  const out = { ...DEFAULT_MEMBER_CARD_CONFIG };
  for (const key of Object.keys(out) as Array<keyof MemberCardConfig>) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

export function cardVerifyUrl(config: MemberCardConfig, id: string) {
  const base = config.verificationBaseUrl.replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(id)}`;
}
