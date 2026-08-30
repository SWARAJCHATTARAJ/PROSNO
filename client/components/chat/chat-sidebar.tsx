"use client";

import { formatDistanceToNow } from "date-fns";
import { Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChatSessions,
  useCreateChatSession,
} from "@/hooks/use-chat";
import { useStartIndexing } from "@/hooks/use-repos";
import type { Repository } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ChatSidebar({
  repo,
  sessionId,
  onSelectSession,
}: {
  repo: Repository;
  sessionId: string | null;
  onSelectSession: (id: string) => void;
}) {
  const ready = repo.indexStatus === "READY";
  const sessionsQuery = useChatSessions(repo.id, ready);
  const createSession = useCreateChatSession(repo.id);
  const reindex = useStartIndexing();

  return (
    <aside className="flex w-full max-h-[40vh] flex-col border-b border-border dark:border-white/10 md:w-72 md:max-h-none md:border-r md:border-b-0 shrink-0 bg-background dark:bg-[#0a0a0a]">
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <p className="truncate font-mono text-sm font-medium text-foreground dark:text-neutral-200">
            <span className="text-primary dark:text-amber-500 mr-1">~/</span>
            {repo.fullName.split('/').pop() || repo.fullName}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn("size-2 rounded-full", repo.indexStatus === "READY" ? "bg-green-500" : "bg-primary dark:bg-amber-500 text-primary-foreground dark:text-[#0a0a0a]")} />
            <span className="font-mono text-[10px] text-muted-foreground dark:text-neutral-400 uppercase tracking-wider">{repo.indexStatus}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 rounded-sm font-mono text-xs bg-primary dark:bg-amber-500 text-primary-foreground dark:text-[#0a0a0a]  hover:bg-primary/90 dark:hover:bg-amber-400 disabled:opacity-50 disabled:bg-black/10 dark:disabled:bg-white/10 disabled:text-muted-foreground/80 dark:text-neutral-500"
            disabled={!ready || createSession.isPending}
            onClick={() =>
              createSession.mutate("New chat", {
                onSuccess: (session) => onSelectSession(session.id),
              })
            }
          >
            <Plus className="size-3.5 mr-2" />
            touch session
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-sm border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] text-muted-foreground dark:text-neutral-400 hover:bg-black/5 dark:bg-white/5 hover:text-foreground dark:text-neutral-200"
            disabled={reindex.isPending || repo.indexStatus === "INDEXING"}
            onClick={() => reindex.mutate(repo.id)}
            aria-label="Re-index repository"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      <Separator className="bg-black/10 dark:bg-white/10" />

      <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 dark:text-neutral-500">
        ls ./sessions
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 px-2 pb-4">
          {!ready && (
            <p className="px-2 font-mono text-xs text-muted-foreground/80 dark:text-neutral-500">
              index required
            </p>
          )}

          {sessionsQuery.isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-sm bg-black/5 dark:bg-white/5" />
            ))}

          {sessionsQuery.data?.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-black/5 dark:bg-white/5",
                sessionId === session.id && "bg-black/5 dark:bg-white/5 border-l-2 border-primary dark:border-amber-500"
              )}
            >
              <p className="truncate font-mono text-sm text-foreground/90 dark:text-neutral-300">{session.title}</p>
              <p className="font-mono text-[10px] text-muted-foreground/80 dark:text-neutral-500 mt-1">
                {formatDistanceToNow(new Date(session.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </button>
          ))}

          {ready && sessionsQuery.isSuccess && (sessionsQuery.data.length <= 1) && (
            <p className="px-2 mt-2 font-mono text-[10px] text-neutral-600">
              // no other sessions yet
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}