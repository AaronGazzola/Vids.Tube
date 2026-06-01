"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type CommentFormProps = {
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  pending: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
};

const MAX_LENGTH = 4000;

export function CommentForm({
  initialValue = "",
  placeholder = "Add a comment",
  submitLabel,
  pending,
  autoFocus,
  onSubmit,
  onCancel,
  className,
}: CommentFormProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
      const length = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(length, length);
    }
  }, [autoFocus]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await onSubmit(trimmed);
    if (!initialValue) {
      setValue("");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSubmit(event);
    } else if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2", className)}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={MAX_LENGTH}
        rows={3}
        className="resize-y"
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
