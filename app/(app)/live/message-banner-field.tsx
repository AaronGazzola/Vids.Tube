"use client";

import { parseOverlayMessage, type OverlayRun } from "@/lib/overlay-markup";
import { serializeOverlayMessage } from "@/lib/overlay-markup-serialize";
import { runsToPlainText } from "@/lib/overlay-runs";
import { useEffect, useRef } from "react";

export type Selection = { start: number; end: number };

// The message is typed as styled text rather than as markup. The model is the
// run list; the DOM is a rendering of it, one span per run, and is read back
// only for what the browser owns: where the caret is and what was typed.
//
// Marks are applied through the pure helpers rather than execCommand, so the
// browser never invents markup of its own and there is nothing to sanitise.

function styleOf(run: OverlayRun): React.CSSProperties {
  return {
    fontWeight: run.bold ? 700 : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: run.underline ? "underline" : undefined,
    color: run.color ?? undefined,
  };
}

// Plain-text offset of a DOM position, counted the same way the run list counts.
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walk = (current: Node): boolean => {
    if (current === node && current.nodeType === Node.TEXT_NODE) {
      total += offset;
      return true;
    }
    if (current.nodeType === Node.TEXT_NODE) {
      total += current.textContent?.length ?? 0;
      return false;
    }
    const children = Array.from(current.childNodes);
    for (let i = 0; i < children.length; i += 1) {
      if (current === node && i === offset) return true;
      if (walk(children[i])) return true;
    }
    return current === node && offset >= children.length;
  };
  walk(root);
  return total;
}

function positionAt(root: HTMLElement, target: number): [Node, number] {
  let remaining = target;
  const stack: Node[] = [root];
  const texts: Text[] = [];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.nodeType === Node.TEXT_NODE) texts.push(node as Text);
    else {
      const children = Array.from(node.childNodes);
      for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
    }
  }
  for (const text of texts) {
    const length = text.textContent?.length ?? 0;
    if (remaining <= length) return [text, remaining];
    remaining -= length;
  }
  const last = texts[texts.length - 1];
  return last ? [last, last.textContent?.length ?? 0] : [root, 0];
}

export function MessageBannerField({
  value,
  onChange,
  onSelectionChange,
  ariaLabel,
  className,
  style,
}: {
  value: string;
  onChange: (markup: string) => void;
  onSelectionChange: (selection: Selection) => void;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const caretRef = useRef<number | null>(null);
  const writtenRef = useRef<string | null>(null);
  const runs = parseOverlayMessage(value);

  // React does not render the spans. A contenteditable is edited by the browser
  // too, and letting both write the same nodes ends in React trying to remove
  // children the browser already replaced. The spans are built here instead, and
  // only when what is on screen no longer matches the value — so ordinary typing
  // rebuilds nothing and the caret is never disturbed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const plain = runs.map((run) => run.text).join("");
    const matches = value === writtenRef.current && el.textContent === plain;
    if (!matches) {
      el.replaceChildren(
        ...runs.map((run, i) => {
          // Built as nodes, never parsed from a string, so there is no markup
          // path into the document and nothing to sanitise.
          const span = document.createElement("span");
          span.dataset.run = String(i);
          span.textContent = run.text;
          Object.assign(span.style, styleOf(run));
          return span;
        })
      );
      writtenRef.current = value;
    }

    const caret = caretRef.current;
    if (caret === null) return;
    caretRef.current = null;
    const selection = window.getSelection();
    if (!selection) return;
    const [node, offset] = positionAt(el, caret);
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  });

  const readSelection = (): Selection | null => {
    const el = ref.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const start = offsetOf(el, range.startContainer, range.startOffset);
    const end = offsetOf(el, range.endContainer, range.endOffset);
    return { start: Math.min(start, end), end: Math.max(start, end) };
  };

  const report = () => {
    const selection = readSelection();
    if (selection) onSelectionChange(selection);
  };

  // Reads the DOM back into runs. Each span carries its own marks, so what the
  // browser did to the text is taken and what it might have done to the styling
  // is ignored.
  const readBack = () => {
    const el = ref.current;
    if (!el) return;
    const next: OverlayRun[] = [];
    for (const node of Array.from(el.childNodes)) {
      const text = node.textContent ?? "";
      if (!text) continue;
      const index =
        node instanceof HTMLElement ? Number(node.dataset.run ?? "-1") : -1;
      const source = runs[index];
      next.push(
        source
          ? { ...source, text }
          : { text, bold: false, italic: false, underline: false, color: null }
      );
    }
    const selection = readSelection();
    caretRef.current = selection ? selection.start : null;
    onChange(serializeOverlayMessage(next));
  };

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline="false"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={className}
      style={style}
      onInput={readBack}
      onKeyUp={report}
      onMouseUp={report}
      onFocus={report}
      onKeyDown={(e) => {
        // One line: the banner is a single strip, so a newline has nowhere to go.
        if (e.key === "Enter") e.preventDefault();
      }}
      onPaste={(e) => {
        // Anything unsupported arrives as its words, never as foreign markup.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        if (!text) return;
        document.execCommand("insertText", false, text);
      }}
    />
  );
}

export { runsToPlainText };
