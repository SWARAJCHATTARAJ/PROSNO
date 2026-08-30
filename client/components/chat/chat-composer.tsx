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
    <div className="border-t border-white/10 bg-[#0a0a0a] p-4">
      <div className="mx-auto max-w-3xl space-y-2">
        <div className="flex items-end gap-2 rounded-sm border border-white/10 bg-[#0f0f0f] p-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="> type command or question..."
            disabled={disabled}
            className="min-h-12 flex-1 border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0 font-mono text-neutral-300 placeholder:text-neutral-600 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {streaming ? (
            <Button
              size="icon-lg"
              onClick={onStop}
              aria-label="Stop generating"
              className="rounded-sm border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon-lg"
              disabled={disabled || !value.trim()}
              onClick={() => void submit()}
              aria-label="Send message"
              className="rounded-sm bg-amber-500 text-[#0a0a0a] hover:bg-amber-400 disabled:opacity-50 disabled:bg-white/10 disabled:text-neutral-500"
            >
              {disabled ? <Spinner className="text-amber-500" /> : <SendHorizontal className="size-4" />}
            </Button>
          )}
        </div>
        <p className="px-1 text-[10px] uppercase tracking-wider text-neutral-600 font-mono flex items-center gap-1">
          Press <Kbd className="bg-white/5 border border-white/10 text-neutral-400 rounded-sm">Enter</Kbd> to execute — <Kbd className="bg-white/5 border border-white/10 text-neutral-400 rounded-sm">Shift</Kbd> + <Kbd className="bg-white/5 border border-white/10 text-neutral-400 rounded-sm">Enter</Kbd> for new line
        </p>
      </div>
    </div>
  );
}