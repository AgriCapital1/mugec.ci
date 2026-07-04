import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture de l'image impossible"));
    reader.readAsDataURL(file);
  });
}

type ContentImageUploadProps = {
  value: string | null;
  folder: "actualites" | "opportunites";
  disabled?: boolean;
  onChange: (url: string) => void;
  uploadImage: (payload: { dataUrl: string; folder: "actualites" | "opportunites" }) => Promise<{ url: string }>;
};

export function ContentImageUpload({ value, folder, disabled, onChange, uploadImage }: ContentImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      toast.error("Format refusé. Utilisez JPG, PNG, WebP, GIF ou AVIF.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image trop lourde : 20 MB maximum.");
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadImage({ dataUrl, folder });
      onChange(result.url);
      toast.success("Image téléversée");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload impossible";
      toast.error(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Upload en cours…
          </>
        ) : (
          <>
            <UploadCloud className="mr-2 h-4 w-4" />
            Uploader une image
          </>
        )}
      </Button>
      {value ? (
        <div className="relative overflow-hidden rounded-md border bg-muted/30">
          <img src={value} alt="Image de couverture" className="h-36 w-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={() => onChange("")}
            disabled={disabled || uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-md border border-dashed bg-muted/20 text-muted-foreground">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}