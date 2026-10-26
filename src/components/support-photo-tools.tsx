import { useEffect, useId, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "support-attachments";
const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadSupportPhotos(reference: string, files: File[]) {
  if (!/^\d{16}$/.test(reference)) throw new Error("Invalid support reference.");
  if (files.length > MAX_PHOTOS) throw new Error(`Choose up to ${MAX_PHOTOS} photos per reply.`);

  const uploaded: string[] = [];
  try {
    for (const file of files) {
      const extension = TYPES[file.type];
      if (!extension) throw new Error("Photos must be JPG, PNG, or WebP images.");
      if (file.size > MAX_BYTES) throw new Error("Each photo must be 5 MB or smaller.");
      const path = `${reference}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new Error("Could not upload a photo. Check the migration is installed and try again.");
      uploaded.push(path);
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw error;
  }
}

export async function removeSupportPhotos(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error("Could not remove the support photos.");
}

export function SupportPhotoPicker({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return <div className="grid gap-2">
    <input
      id={id}
      name="reply-photos"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      disabled={disabled}
      className="sr-only"
      onChange={(event) => {
        const selected = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        if (!selected.length) return;
        const accepted = selected.filter((file) => {
          if (!TYPES[file.type]) {
            toast.error(`${file.name}: choose a JPG, PNG, or WebP image.`);
            return false;
          }
          if (file.size > MAX_BYTES) {
            toast.error(`${file.name}: each photo must be 5 MB or smaller.`);
            return false;
          }
          return true;
        });
        if (files.length + accepted.length > MAX_PHOTOS) {
          toast.error(`Choose up to ${MAX_PHOTOS} photos per reply.`);
        }
        onChange([...files, ...accepted].slice(0, MAX_PHOTOS));
      }}
    />
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled || files.length >= MAX_PHOTOS} asChild>
        <label htmlFor={id} className="cursor-pointer"><ImagePlus className="size-4" />Add photos</label>
      </Button>
      <span className="text-xs text-muted-foreground">Up to 3 JPG, PNG, or WebP photos · 5 MB each</span>
    </div>
    {files.length > 0 && <ul className="flex flex-wrap gap-2">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}`} className="flex max-w-full items-center gap-2 rounded-md border border-line px-2 py-1 text-xs">
      <span className="max-w-48 truncate">{file.name}</span>
      <button type="button" aria-label={`Remove ${file.name}`} disabled={disabled} onClick={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"><X className="size-3" /></button>
    </li>)}</ul>}
  </div>;
}

export function SupportPhotoGallery({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const pathsKey = paths.join("\n");

  useEffect(() => {
    let active = true;
    if (!paths.length) {
      setUrls([]);
      setFailed(false);
      return () => { active = false; };
    }
    setUrls([]);
    setFailed(false);
    void supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60).then(({ data, error }) => {
      if (!active) return;
      const signed = data?.flatMap((item) => item.signedUrl ? [item.signedUrl] : []) ?? [];
      setUrls(signed);
      setFailed(Boolean(error) || signed.length !== paths.length);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [pathsKey]);

  if (!paths.length) return null;
  if (failed && !urls.length) return <p className="mt-3 text-xs text-muted-foreground">Photo attachments could not be loaded.</p>;
  return <div className="mt-3 flex flex-wrap gap-3">
    {urls.map((url, index) => <a key={`${paths[index]}-${index}`} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line">
      <img src={url} alt={`Support attachment ${index + 1}`} loading="lazy" className="size-32 object-cover sm:size-40" />
    </a>)}
    {failed && <p className="self-center text-xs text-muted-foreground">Some attachments could not be loaded.</p>}
  </div>;
}
