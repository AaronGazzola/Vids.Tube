"use client";

import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { useState } from "react";

type ToastVariant = "success" | "error" | "notification";

interface CustomToastProps {
  variant: ToastVariant;
  title: string;
  message?: string;
}

const variantStyles = {
  success: {
    container:
      "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800",
    title: "text-emerald-900 dark:text-emerald-100",
    message: "text-emerald-700 dark:text-emerald-300",
  },
  error: {
    container: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
    title: "text-red-900 dark:text-red-100",
    message: "text-red-700 dark:text-red-300",
  },
  notification: {
    container:
      "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
    title: "text-blue-900 dark:text-blue-100",
    message: "text-blue-700 dark:text-blue-300",
  },
};

export function CustomToast({ variant, title, message }: CustomToastProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (message) {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "relative flex w-full flex-col gap-1 rounded-md border p-4 shadow font-sans tracking",
        styles.container
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("font-semibold", styles.title)}>{title}</p>
        {variant === "error" && message && (
          <button
            onClick={handleCopy}
            className={cn(
              "shrink-0 rounded p-1 transition-colors hover:bg-red-100 dark:hover:bg-red-900",
              styles.title
            )}
            aria-label="Copy error message"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
      {message && (
        <p className={cn("text-sm", styles.message)}>
          {copied && variant === "error" ? "Copied to clipboard!" : message}
        </p>
      )}
    </div>
  );
}
