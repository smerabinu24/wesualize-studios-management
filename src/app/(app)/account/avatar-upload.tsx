"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar, Button } from "@/components/ui/primitives";

/** Center-crops + resizes an image file to a square JPEG data URL, client-side. */
function resizeToSquare(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unsupported"));
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({ name, initialSrc }: { name: string; initialSrc: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file."); return; }
    setBusy(true);
    try {
      const dataUrl = await resizeToSquare(file);
      const res = await fetch("/api/account/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (res.ok) { setSrc(dataUrl); router.refresh(); }
      else setErr(data.error ?? "Upload failed.");
    } catch {
      setErr("Could not process that image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true); setErr("");
    const res = await fetch("/api/account/avatar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: null }),
    });
    setBusy(false);
    if (res.ok) { setSrc(null); router.refresh(); }
    else setErr("Could not remove photo.");
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={src} size={64} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Upload profile photo" />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {src ? "Change photo" : "Upload photo"}
          </Button>
          {src && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
              <Trash2 className="h-4 w-4 text-destructive" /> Remove
            </Button>
          )}
        </div>
        {err ? (
          <p className="text-xs text-destructive">{err}</p>
        ) : (
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Auto-cropped to a square.</p>
        )}
      </div>
    </div>
  );
}
