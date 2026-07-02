import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageCircle, Copy, ExternalLink } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/admin-users-client";

export function WhatsAppInvitationDialog({
  open, onOpenChange, phone, message,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  phone: string | null | undefined;
  message: string;
}) {
  const link = buildWhatsAppLink(phone, message);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Envoyer l'invitation par WhatsApp
          </DialogTitle>
          <DialogDescription>
            {phone
              ? <>Le message ci-dessous est prêt. Cliquez sur <strong>Ouvrir WhatsApp</strong> pour l'envoyer au {phone} au nom de MIPROJET.</>
              : <>Aucun téléphone n'a été renseigné. Le message ouvrira WhatsApp sans destinataire présélectionné.</>}
          </DialogDescription>
        </DialogHeader>
        <Textarea rows={12} readOnly value={message} className="font-mono text-xs" />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(message); toast.success("Message copié"); }}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Copier le message
          </Button>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" /> Ouvrir WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
