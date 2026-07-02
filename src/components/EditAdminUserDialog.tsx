import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, UserCog } from "lucide-react";
import { toast } from "sonner";
import { updateAdminProfileClient, uploadAdminPhotoClient, updateAdminUserRoleClient } from "@/lib/admin-users-client";

const ALL_ROLES: { value: string; label: string }[] = [
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
  { value: "commissaire_comptes", label: "Commissaire aux comptes" },
  { value: "comite_controle", label: "Comité de contrôle" },
  { value: "conseil_sages", label: "Conseil des sages" },
  { value: "miprojet_admin", label: "Admin MIPROJET" },
  { value: "miprojet_viewer", label: "Lecture MIPROJET" },
];

export type EditUserInitial = {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  address: string | null;
  photo_url: string | null;
  notes: string | null;
  login_identifier?: string | null;
  portal?: string | null;
  roles: string[];
};

export function EditAdminUserDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: EditUserInitial | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", address: "", photo_url: "", notes: "", role: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const primaryRole = user.roles.find((r) => r !== "super_admin") ?? user.roles[0] ?? "";
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      email: user.email && !user.email.endsWith(".local") ? user.email : "",
      phone: user.phone ?? "",
      address: user.address ?? "",
      photo_url: user.photo_url ?? "",
      notes: user.notes ?? "",
      role: primaryRole,
    });
  }, [user?.id]);

  if (!user) return null;

  const isSuper = user.roles.includes("super_admin");

  async function handlePhoto(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadAdminPhotoClient(user.id, file);
      setForm((f) => ({ ...f, photo_url: url }));
      toast.success("Photo téléversée");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await updateAdminProfileClient({
        user_id: user.id,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        full_name: `${form.first_name} ${form.last_name}`.trim() || user.full_name || "Sans nom",
        email: form.email || user.email,
        phone: form.phone || null,
        address: form.address || null,
        photo_url: form.photo_url || null,
        notes: form.notes || null,
      });
      if (!isSuper && form.role && !user.roles.includes(form.role)) {
        await updateAdminUserRoleClient(user.id, form.role);
      }
      toast.success("Profil mis à jour");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const initials = ((form.first_name?.[0] ?? "") + (form.last_name?.[0] ?? "")).toUpperCase() || "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" aria-hidden="true" /> Modifier le profil</DialogTitle>
          <DialogDescription>Mettez à jour les informations, le contact réel et le rôle de l'administrateur.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border">
              <AvatarImage src={form.photo_url || undefined} alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-2 h-4 w-4" aria-hidden="true" />}
                Téléverser une photo
              </Button>
              <span className="text-xs text-muted-foreground">PNG, JPG ou WebP. SVG interdit.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-first">Prénom</Label>
              <Input id="edit-first" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-last">Nom</Label>
              <Input id="edit-last" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-email">Email réel</Label>
              <Input id="edit-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nom@exemple.com" />
              <p className="mt-1 text-xs text-muted-foreground">Remplace l'adresse locale (ex. *.local).</p>
            </div>
            <div>
              <Label htmlFor="edit-phone">Téléphone</Label>
              <Input id="edit-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+225…" />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-address">Adresse</Label>
            <Input id="edit-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {!isSuper && (
            <div>
              <Label htmlFor="edit-role">Rôle principal</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="edit-role"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="edit-notes">Notes internes</Label>
            <Textarea id="edit-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Enregistrement…</> : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
