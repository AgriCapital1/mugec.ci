import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DashboardHeader, MIPROJET_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  listAdminUsersClient,
  createAdminUserClient,
  updateAdminUserRoleClient,
  resetAdminPasswordClient,
  deleteAdminUserClient,
  buildWhatsAppInvitationMessage,
} from "@/lib/admin-users-client";
import { UserPlus, Trash2, KeyRound, Users, Loader2, Copy, ShieldCheck, Pencil, Search, MessageCircle } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { PermissionsMatrixDialog } from "@/components/PermissionsMatrixDialog";
import { EditAdminUserDialog, type EditUserInitial } from "@/components/EditAdminUserDialog";
import { WhatsAppInvitationDialog } from "@/components/WhatsAppInvitationDialog";

export const Route = createFileRoute("/miprojet/utilisateurs")({ ssr: false, component: MiprojetUsers });

const MUGEC_ROLES = [
  { value: "admin_national", label: "Admin national" },
  { value: "admin_regional", label: "Admin régional" },
  { value: "admin_local", label: "Admin local" },
  { value: "secretaire_general", label: "Secrétaire général" },
  { value: "tresorier_national", label: "Trésorier national" },
  { value: "president", label: "Président" },
  { value: "directeur_executif", label: "Directeur exécutif" },
  { value: "secretaire_regional", label: "Secrétaire régional" },
  { value: "tresorier_regional", label: "Trésorier régional" },
  { value: "delegue_section", label: "Délégué de section" },
  { value: "agent_saisie", label: "Agent de saisie" },
];
const MIPROJET_ROLES = [
  { value: "miprojet_admin", label: "Admin MIPROJET (accès total)" },
  { value: "miprojet_viewer", label: "Lecture seule MIPROJET" },
];

function readErrorDetails(error: unknown) {
  if (error instanceof Error) return error.message || error.stack || "Erreur inconnue";
  if (typeof error === "string") return error;
  try { return JSON.stringify(error, null, 2); } catch { return "Erreur inconnue"; }
}

function MiprojetUsers() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [permOpen, setPermOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditUserInitial | null>(null);
  const [waState, setWaState] = useState<{ open: boolean; phone: string | null; message: string }>({ open: false, phone: null, message: "" });
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("__all");

  const [form, setForm] = useState({
    portal: "mugec" as "mugec" | "miprojet",
    role: "admin_national",
    full_name: "",
    email: "",
    phone: "",
    login_identifier: "",
    send_via: "email" as "email" | "whatsapp",
    password: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/miprojet" }); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!data) { navigate({ to: "/miprojet" }); return; }
      setAuthorized(true);
    })();
  }, [navigate]);

  async function load() {
    setLoading(true);
    setDebugError(null);
    try {
      const res = await listAdminUsersClient();
      setUsers(res.users ?? []);
    } catch (e: any) {
      const details = readErrorDetails(e);
      setDebugError(details);
      toast.error(`Chargement : ${details.slice(0, 180)}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (authorized) load(); }, [authorized]);

  async function handleCreate() {
    if (!form.email || !form.full_name) { toast.error("Nom et email requis"); return; }
    setSubmitting(true);
    setGeneratedPwd(null);
    setDebugError(null);
    try {
      const res = await createAdminUserClient({
        email: form.email,
        phone: form.phone || undefined,
        full_name: form.full_name,
        portal: form.portal,
        role: form.role,
        password: form.password || undefined,
        send_via: form.send_via,
        login_identifier: form.login_identifier || undefined,
      });
      setGeneratedPwd(res.initial_password);
      if (form.send_via === "email") {
        toast.success(res.password_delivered === "email"
          ? "Compte créé — invitation envoyée par email (Brevo)."
          : "Compte créé. L'email n'a pas pu être envoyé automatiquement : transmettez le mot de passe manuellement.");
      } else {
        const msg = buildWhatsAppInvitationMessage({
          full_name: form.full_name,
          portal: form.portal,
          role: form.role,
          login_identifier: form.login_identifier || form.email,
          password: res.initial_password,
        });
        setWaState({ open: true, phone: form.phone || null, message: msg });
        toast.success("Compte créé — préparez l'envoi WhatsApp.");
      }
      load();
    } catch (e: any) {
      const details = readErrorDetails(e);
      setDebugError(details);
      toast.error(`Création : ${details.slice(0, 200)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPwd(uid: string, email: string | null) {
    if (!email) { toast.error("Email manquant pour l'envoi du lien de réinitialisation."); return; }
    if (!confirm(`Envoyer un lien de réinitialisation à ${email} ?`)) return;
    setDebugError(null);
    try {
      await resetAdminPasswordClient(email);
      toast.success(`Lien de réinitialisation envoyé à ${email}.`);
    } catch (e: any) {
      const details = readErrorDetails(e);
      setDebugError(details);
      toast.error(`Réinitialisation : ${details.slice(0, 200)}`);
    }
  }

  async function handleChangeRole(uid: string, newRole: string) {
    setDebugError(null);
    try {
      await updateAdminUserRoleClient(uid, newRole);
      toast.success("Rôle mis à jour");
      load();
    } catch (e: any) {
      const details = readErrorDetails(e);
      setDebugError(details);
      toast.error(`Rôle : ${details.slice(0, 200)}`);
    }
  }

  async function handleDelete(uid: string) {
    if (!confirm("Retirer les accès administrateurs de cet utilisateur ?")) return;
    setDebugError(null);
    try {
      await deleteAdminUserClient(uid);
      toast.success("Accès révoqués");
      load();
    } catch (e: any) {
      const details = readErrorDetails(e);
      setDebugError(details);
      toast.error(`Suppression : ${details.slice(0, 200)}`);
    }
  }

  const roles = form.portal === "mugec" ? MUGEC_ROLES : MIPROJET_ROLES;

  const allRolesInUse = Array.from(new Set(users.flatMap((u) => u.roles as string[]))).sort();
  const q = query.trim().toLowerCase();
  const visibleUsers = users.filter((u) => {
    if (roleFilter !== "__all" && !(u.roles as string[]).includes(roleFilter)) return false;
    if (!q) return true;
    const hay = [
      u.full_name, u.first_name, u.last_name, u.email, u.phone,
      u.login_identifier, ...(u.roles ?? []),
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  if (authorized === null) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Vérification…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Gestion utilisateurs" nav={MIPROJET_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Administrateurs des deux portails</CardTitle>
              <CardDescription>Créer / révoquer les admins MUGEC-CI et MIPROJET. Réservé au super administrateur.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPermOpen(true)}>
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" /> Permissions par rôle
              </Button>
              <Button onClick={() => { setGeneratedPwd(null); setDebugError(null); setDialogOpen(true); }}>
                <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" /> Nouveau compte
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {debugError && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="font-semibold">Erreur technique détectée</div>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">{debugError}</pre>
              </div>
            )}
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher par nom, email, téléphone, identifiant ou rôle…"
                  className="pl-9"
                  aria-label="Rechercher un utilisateur"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="sm:w-64" aria-label="Filtrer par rôle"><SelectValue placeholder="Tous les rôles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Tous les rôles</SelectItem>
                  {allRolesInUse.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground sm:ml-2">{visibleUsers.length} / {users.length}</span>
            </div>
            {loading ? <div className="py-8 text-center text-muted-foreground">Chargement…</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Rôles</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucun résultat</TableCell></TableRow>
                  ) : visibleUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.full_name || "—"}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{u.phone || "—"}</TableCell>
                      <TableCell className="flex flex-wrap gap-1">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="text-[10px]">{r}</Badge>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fr-FR") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditTarget(u as EditUserInitial)} aria-label={`Modifier ${u.email}`} title="Modifier le profil">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          const msg = buildWhatsAppInvitationMessage({
                            full_name: u.full_name || u.email, portal: (u.portal === "miprojet" ? "miprojet" : "mugec"),
                            role: u.roles.find((r: string) => r !== "membre") || "admin",
                            login_identifier: u.login_identifier || u.email,
                            password: "(mot de passe à réinitialiser)",
                          });
                          setWaState({ open: true, phone: u.phone, message: msg });
                        }} aria-label={`Envoyer un message WhatsApp à ${u.email}`} title="Message WhatsApp">
                          <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResetPwd(u.id, u.email)} aria-label={`Réinitialiser le mot de passe de ${u.email}`} title="Envoyer un lien de réinitialisation">
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {!u.roles.includes("super_admin") && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)} aria-label={`Supprimer ${u.email}`} title="Supprimer">
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setGeneratedPwd(null); setDebugError(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary"/> Créer un compte administrateur</DialogTitle>
            <DialogDescription>Le mot de passe est généré aléatoirement si vous laissez le champ vide.</DialogDescription>
          </DialogHeader>

          {debugError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="font-semibold">Erreur technique détectée</div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">{debugError}</pre>
            </div>
          )}

          {generatedPwd ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                <div className="text-sm font-semibold text-emerald-700">Compte créé avec succès</div>
                <div className="mt-2 text-sm">Mot de passe initial :</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-background px-2 py-1 font-mono">{generatedPwd}</code>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(generatedPwd); toast.success("Copié"); }}><Copy className="h-3 w-3"/></Button>
                </div>
              </div>
              <DialogFooter><Button onClick={() => { setDialogOpen(false); setGeneratedPwd(null); }}>Fermer</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Portail</Label>
                <RadioGroup value={form.portal} onValueChange={(v: any) => setForm({ ...form, portal: v, role: v === "mugec" ? "admin_national" : "miprojet_admin" })} className="mt-2 grid grid-cols-2 gap-2">
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="mugec"/> MUGEC-CI</Label>
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="miprojet"/> MIPROJET</Label>
                </RadioGroup>
              </div>
              <div>
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom complet</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+225…" /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div>
                <Label htmlFor="new-identifier">Identifiant de connexion (optionnel)</Label>
                <Input id="new-identifier" value={form.login_identifier} onChange={(e) => setForm({ ...form, login_identifier: e.target.value })} placeholder="ex : marcelkonan" autoComplete="off" />
                <p className="mt-1 text-xs text-muted-foreground">Court, sans espace. Utilisable à la place de l'email pour se connecter.</p>
              </div>
              <div>
                <Label htmlFor="new-pwd">Mot de passe (vide = aléatoire sécurisé)</Label>
                <PasswordInput id="new-pwd" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Laisser vide pour génération automatique" autoComplete="new-password" />
              </div>

              <div>
                <Label>Envoyer l'invitation par</Label>
                <RadioGroup value={form.send_via} onValueChange={(v: any) => setForm({ ...form, send_via: v })} className="mt-2 grid grid-cols-2 gap-2">
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="email"/> Email</Label>
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="whatsapp"/> WhatsApp</Label>
                </RadioGroup>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Annuler</Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Création…</> : "Créer & envoyer"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PermissionsMatrixDialog open={permOpen} onOpenChange={setPermOpen} />
      <EditAdminUserDialog
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        user={editTarget}
        onSaved={load}
      />
      <WhatsAppInvitationDialog
        open={waState.open}
        onOpenChange={(o) => setWaState((s) => ({ ...s, open: o }))}
        phone={waState.phone}
        message={waState.message}
      />
    </div>
  );
}
