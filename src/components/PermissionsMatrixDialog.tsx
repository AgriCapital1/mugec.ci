import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listPermissionsAndRolesClient,
  setRolePermissionClient,
  type PermissionDef,
} from "@/lib/admin-users-client";

const MUGEC_ROLES: { value: string; label: string }[] = [
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

export function PermissionsMatrixDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [grants, setGrants] = useState<Record<string, Set<string>>>({}); // role -> Set<key>
  const [role, setRole] = useState<string>("admin_national");
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await listPermissionsAndRolesClient();
      setCatalog(res.catalog);
      const map: Record<string, Set<string>> = {};
      for (const g of res.grants) {
        if (!g.allowed) continue;
        (map[g.role] ??= new Set()).add(g.permission_key);
      }
      setGrants(map);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lecture permissions");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (open) load(); }, [open]);

  const hasPerm = (key: string) => grants[role]?.has(key) ?? false;

  async function toggle(key: string, next: boolean) {
    setSaving(key);
    try {
      await setRolePermissionClient(role, key, next);
      setGrants((g) => {
        const copy = { ...g };
        const set = new Set(copy[role] ?? []);
        if (next) set.add(key); else set.delete(key);
        copy[role] = set;
        return copy;
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setSaving(null);
    }
  }

  const byCategory = catalog.reduce<Record<string, PermissionDef[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Permissions par rôle</DialogTitle>
          <DialogDescription>
            Définissez précisément ce que chaque rôle MUGEC-CI / MIPROJET peut faire. Les modifications sont enregistrées immédiatement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="role-select">Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MUGEC_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Chargement…</div>
          ) : (
            <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
              {Object.entries(byCategory).map(([cat, perms]) => (
                <fieldset key={cat} className="rounded-md border p-3">
                  <legend className="px-2 text-sm font-semibold text-primary">{cat}</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {perms.map((p) => {
                      const checked = hasPerm(p.key);
                      return (
                        <label
                          key={p.key}
                          htmlFor={`perm-${p.key}`}
                          className="flex cursor-pointer items-start gap-2 rounded-md border p-2 hover:bg-secondary/50"
                        >
                          <Checkbox
                            id={`perm-${p.key}`}
                            checked={checked}
                            disabled={saving === p.key}
                            onCheckedChange={(v) => toggle(p.key, !!v)}
                            aria-describedby={`perm-${p.key}-desc`}
                          />
                          <span className="flex-1 text-sm">
                            <span className="font-medium">{p.label}</span>
                            {p.description && <span id={`perm-${p.key}-desc`} className="block text-xs text-muted-foreground">{p.description}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              {catalog.length === 0 && <div className="text-center text-sm text-muted-foreground">Aucune permission définie.</div>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
