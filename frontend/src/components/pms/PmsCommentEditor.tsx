import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "@/lib/utils";
import {
  formatMentionToken,
  parseCommentMentions,
  userMentionAvatarBg,
  userMentionChipClassName,
} from "@/components/pms/pmsCommentMentions";

export type PmsCommentEditorHandle = {
  insertSnippet: (snippet: string) => void;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function createMentionChipElement(name: string, userId: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.mentionToken = formatMentionToken(name, userId);
  chip.className = cn(
    "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 align-middle text-[11px] font-semibold ring-1 ring-inset",
    userMentionChipClassName(userId),
  );
  chip.title = name;

  const avatar = document.createElement("span");
  avatar.className = cn(
    "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white",
    userMentionAvatarBg(userId),
  );
  avatar.textContent = memberInitials(name);

  const label = document.createElement("span");
  label.className = "truncate";
  label.textContent = `@${name}`;

  chip.append(avatar, label);
  return chip;
}

function appendSnippetAtSelection(editor: HTMLElement, snippet: string) {
  editor.focus();
  const selection = window.getSelection();
  if (!selection) return;

  let range: Range;
  if (selection.rangeCount > 0) {
    range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
  } else {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }

  range.deleteContents();

  const segments = parseCommentMentions(snippet);
  const fragment = document.createDocumentFragment();
  const nodes: Node[] = [];

  segments.forEach((segment) => {
    if (segment.type === "mention") {
      const chip = createMentionChipElement(segment.name, segment.userId);
      fragment.appendChild(chip);
      nodes.push(chip);
    } else if (segment.text) {
      const text = document.createTextNode(segment.text);
      fragment.appendChild(text);
      nodes.push(text);
    }
  });

  range.insertNode(fragment);

  const lastNode = nodes[nodes.length - 1];
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function serializeEditor(editor: HTMLElement): string {
  let result = "";

  editor.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
      return;
    }

    if (!(node instanceof HTMLElement)) return;

    const token = node.dataset.mentionToken;
    if (token) {
      result += token;
      return;
    }

    result += node.textContent ?? "";
  });

  return result;
}

function renderValueToEditor(editor: HTMLElement, value: string) {
  editor.innerHTML = "";
  const segments = parseCommentMentions(value);

  segments.forEach((segment) => {
    if (segment.type === "mention") {
      editor.appendChild(createMentionChipElement(segment.name, segment.userId));
      return;
    }
    if (segment.text) {
      editor.appendChild(document.createTextNode(segment.text));
    }
  });
}

export const PmsCommentEditor = forwardRef<PmsCommentEditorHandle, Props>(function PmsCommentEditor(
  { value, onChange, placeholder, disabled = false, className, onKeyDown },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRenderedValue = useRef<string | null>(null);

  const syncFromValue = useCallback(
    (nextValue: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (document.activeElement === editor) return;
      if (lastRenderedValue.current === nextValue) return;
      renderValueToEditor(editor, nextValue);
      lastRenderedValue.current = nextValue;
    },
    [],
  );

  useEffect(() => {
    syncFromValue(value);
  }, [value, syncFromValue]);

  useImperativeHandle(ref, () => ({
    insertSnippet(snippet: string) {
      const editor = editorRef.current;
      if (!editor) return;
      appendSnippetAtSelection(editor, snippet);
      const next = serializeEditor(editor);
      lastRenderedValue.current = next;
      onChange(next);
    },
    focus() {
      editorRef.current?.focus();
    },
  }));

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serializeEditor(editor);
    lastRenderedValue.current = next;
    onChange(next);
  };

  const isEmpty = !value.trim();

  return (
    <div className="relative">
      {isEmpty && placeholder ? (
        <span className="pointer-events-none absolute left-4 top-3 text-sm text-slate-400">
          {placeholder}
        </span>
      ) : null}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "Comment"}
        className={cn(
          "min-h-[72px] whitespace-pre-wrap break-words px-4 pt-3 text-sm leading-relaxed text-slate-800 outline-none",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        onInput={handleInput}
        onKeyDown={onKeyDown}
      />
    </div>
  );
});
