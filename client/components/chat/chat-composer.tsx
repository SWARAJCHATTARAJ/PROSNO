"use client";

import { useState } from "react";
import { SendHorizontal, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";

export function ChatComposer({
 disabled,
 streaming,
 onSend,
 onStop,
}: {
 disabled?: boolean;
 streaming?: boolean;
 onSend: (content: string) => void | Promise<void>;
 onStop?: () => void;
}) {
 const [value, setValue] = useState("");

 async function submit() {
 const content = value.trim();
 if (!content || disabled || streaming) return;
 setValue("");
 await onSend(content);
 }

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="mx-auto max-w-3xl space-y-2">
        <div className="flex items-end gap-2 rounded border border-border bg-background p-1.5 focus-within:border-primary/50 transition-colors">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask anything about this repository..."
            disabled={disabled}
            className="min-h-[44px] flex-1 border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 font-sans text-foreground placeholder:text-muted-foreground resize-none text-sm leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {streaming ? (
            <Button
              size="icon"
              onClick={onStop}
              aria-label="Stop generating"
              className="rounded bg-muted text-foreground hover:bg-muted/80 size-9 shrink-0 mb-1 mr-1"
            >
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              disabled={disabled || !value.trim()}
              onClick={() => void submit()}
              aria-label="Send message"
              className="rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground size-9 shrink-0 mb-1 mr-1 transition-colors"
            >
              {disabled ? <Spinner className="text-muted-foreground size-4" /> : <SendHorizontal className="size-4" />}
            </Button>
          )}
        </div>
        <p className="px-1 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>Prosno AI uses advanced code intelligence</span>
          <span className="flex items-center gap-1 opacity-60">
            <Kbd className="bg-muted border-border text-muted-foreground rounded-sm">↵</Kbd> Send
            <Kbd className="bg-muted border-border text-muted-foreground rounded-sm ml-2">⇧ ↵</Kbd> New line
          </span>
        </p>
      </div>
    </div>
  );
}