"use client";

import { useUploadChannelBranding } from "@/app/[channelSlug]/page.hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";

type Kind = "avatar" | "banner";

const COPY: Record<
  Kind,
  { title: string; description: string; maxSize: number }
> = {
  avatar: {
    title: "Upload avatar",
    description: "Square image, ideally 400×400. JPG, PNG, or WebP up to 2 MB.",
    maxSize: 2 * 1024 * 1024,
  },
  banner: {
    title: "Upload banner",
    description: "Wide image, ideally 2560×512. JPG, PNG, or WebP up to 5 MB.",
    maxSize: 5 * 1024 * 1024,
  },
};

const ACCEPT = {
  "image/jpeg": [],
  "image/png": [],
  "image/webp": [],
};

function DropzoneContents({
  channelId,
  channelSlug,
  kind,
  onSuccess,
}: {
  channelId: string;
  channelSlug: string;
  kind: Kind;
  onSuccess: () => void;
}) {
  const { maxSize } = COPY[kind];
  const upload = useUploadChannelBranding(channelSlug);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      accept: ACCEPT,
      maxFiles: 1,
      maxSize,
      multiple: false,
      disabled: upload.isPending,
      onDrop: (acceptedFiles, fileRejections) => {
        if (fileRejections.length > 0) {
          const code = fileRejections[0].errors[0]?.code;
          if (code === "file-too-large") {
            setRejectionMessage(
              `File is too large — max ${maxSize / (1024 * 1024)} MB.`
            );
          } else if (code === "file-invalid-type") {
            setRejectionMessage("Use a JPG, PNG, or WebP image.");
          } else {
            setRejectionMessage("That file can't be uploaded.");
          }
          return;
        }
        const file = acceptedFiles[0];
        if (!file) {
          return;
        }
        setRejectionMessage(null);
        upload.mutate(
          { channelId, kind, file },
          {
            onSuccess,
          }
        );
      },
    });

  return (
    <>
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 p-8 text-center transition-colors",
          isDragActive && !isDragReject && "border-primary bg-primary/5",
          isDragReject && "border-destructive bg-destructive/5",
          upload.isPending && "cursor-not-allowed opacity-60"
        )}
      >
        <input {...getInputProps()} />
        {upload.isPending ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </>
        ) : (
          <>
            {isDragReject ? (
              <ImageIcon className="h-8 w-8 text-destructive" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {isDragActive
                  ? isDragReject
                    ? "That file can't be uploaded"
                    : "Drop to upload"
                  : "Drop an image here, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, or WebP up to {maxSize / (1024 * 1024)} MB
              </p>
            </div>
          </>
        )}
      </div>
      {rejectionMessage && (
        <p className="text-sm text-destructive">{rejectionMessage}</p>
      )}
    </>
  );
}

export function BrandingUploadDialog({
  open,
  onOpenChange,
  channelId,
  channelSlug,
  kind,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  channelId: string;
  channelSlug: string;
  kind: Kind;
}) {
  const { title, description } = COPY[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && (
          <DropzoneContents
            channelId={channelId}
            channelSlug={channelSlug}
            kind={kind}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
