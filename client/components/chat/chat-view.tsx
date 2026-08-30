"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { IndexingState } from "@/components/chat/indexing-state";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useChatMessages,
  useChatSessions,
  useCreateChatSession,
  useStreamChat,
} from "@/hooks/use-chat";
import { useIndexStatus, useRepository } from "@/hooks/use-repos";

export function ChatView({ repoId }: { repoId: string }) {
  const repoQuery = useRepository(repoId);
  const isIndexing = repoQuery.data?.indexStatus === "INDEXING";
  const statusQuery = useIndexStatus(
    repoId,
    isIndexing || repoQuery.data?.indexStatus === "PENDING"
  );

  const indexStatus =
    statusQuery.data?.indexStatus ?? repoQuery.data?.indexStatus;
  const ready = indexStatus === "READY";

  const sessionsQuery = useChatSessions(repoId, ready);
  const createSession = useCreateChatSession(repoId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const autoCreateRef = useRef(false);

  const sessionId =
    selectedSessionId ?? sessionsQuery.data?.[0]?.id ?? null;

  const messagesQuery = useChatMessages(sessionId);
  const { send, stop, streaming, streamText } = useStreamChat(sessionId);

  useEffect(() => {
    if (!ready || sessionsQuery.isLoading) return;
    if (sessionsQuery.data && sessionsQuery.data.length > 0) return;
    if (
      !sessionsQuery.isSuccess ||
      (sessionsQuery.data?.length ?? 0) > 0 ||
      autoCreateRef.current
    ) {
      return;
    }

    autoCreateRef.current = true;
    createSession.mutate(undefined, {
      onSuccess: (session) => setSelectedSessionId(session.id),
      onError: () => {
        autoCreateRef.current = false;
      },
    });
  }, [
    ready,
    sessionsQuery.isLoading,
    sessionsQuery.isSuccess,
    sessionsQuery.data,
    createSession,
  ]);

  if (repoQuery.isLoading) {
    return (
      <AppShell title="booting...">
        <div className="grid flex-1 gap-4 p-4 md:grid-cols-[18rem_1fr] bg-background dark:bg-[#0a0a0a]">
          <Skeleton className="min-h-80 rounded-sm bg-black/5 dark:bg-white/5 border border-border dark:border-white/10" />
          <Skeleton className="min-h-80 rounded-sm bg-black/5 dark:bg-white/5 border border-border dark:border-white/10" />
        </div>
      </AppShell>
    );
  }

  if (repoQuery.isError || !repoQuery.data) {
    return (
      <AppShell title="ERR_NOT_FOUND">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 bg-background dark:bg-[#0a0a0a]">
          <p className="text-sm font-mono text-red-500">
            {(repoQuery.error as Error)?.message ?? "Directory not found."}
          </p>
          <Button 
            nativeButton={false} 
            render={<Link href="/dashboard" />}
            className="rounded-sm font-mono text-xs border border-border dark:border-white/10 bg-transparent text-foreground/90 dark:text-neutral-300 hover:bg-black/5 dark:bg-white/5"
          >
            $ cd ..
          </Button>
        </div>
      </AppShell>
    );
  }

  const repo = repoQuery.data;

  return (
    <TooltipProvider>
    <AppShell
      title={repo.fullName}
      description={
        ready
          ? "chat active"
          : "building index..."
      }
      actions={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button 
                variant="outline" 
                size="sm" 
                nativeButton={false} 
                render={<Link href="/dashboard" />}
                className="rounded-sm font-mono text-xs border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] text-muted-foreground dark:text-neutral-400 hover:bg-black/5 dark:bg-white/5 hover:text-foreground dark:text-neutral-200"
              />
            }
          >
            <ArrowLeft className="size-3.5 mr-2" />
            cd ..
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="font-mono bg-muted/50 dark:bg-[#141414] text-foreground/90 dark:text-neutral-300 border border-border dark:border-white/10">Back to workspace</TooltipContent>
        </Tooltip>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row bg-background dark:bg-[#0a0a0a] text-foreground/90 dark:text-neutral-300">
        <ChatSidebar
          repo={{
            ...repo,
            indexStatus: indexStatus ?? repo.indexStatus,
            filesProcessed:
              statusQuery.data?.filesProcessed ?? repo.filesProcessed,
            filesTotal: statusQuery.data?.filesTotal ?? repo.filesTotal,
            chunkCount: statusQuery.data?.chunkCount ?? repo.chunkCount,
            errorMessage: statusQuery.data?.errorMessage ?? repo.errorMessage,
          }}
          sessionId={sessionId}
          onSelectSession={setSelectedSessionId}
        />

        <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col border-l border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f]">
          {!ready ? (
            <IndexingState repo={repo} status={statusQuery.data} />
          ) : (
            <>
              <ChatMessages
                repo={repo}
                messages={messagesQuery.data ?? []}
                streamText={streamText}
                streaming={streaming}
                isLoading={messagesQuery.isLoading}
              />
              <ChatComposer
                disabled={!sessionId}
                streaming={streaming}
                onSend={send}
                onStop={stop}
              />
            </>
          )}
        </section>
      </div>
    </AppShell>
    </TooltipProvider>
  );
}