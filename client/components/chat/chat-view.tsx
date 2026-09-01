"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessages } from "@/components/chat/chat-messages";
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
import { useWorkspace } from "@/components/layout/workspace-context";

export function ChatView({ repoId }: { repoId: string }) {
 const repoQuery = useRepository(repoId);
 const isIndexing = repoQuery.data?.indexStatus === "INDEXING";
 const statusQuery = useIndexStatus(
 repoId,
 isIndexing || repoQuery.data?.indexStatus === "PENDING"
 );

 const indexStatus =
 statusQuery.data?.indexStatus ?? repoQuery.data?.indexStatus;
 
 // Both READY and EXPIRED states allow chatting (EXPIRED wakes up on chat)
 const canChat = indexStatus === "READY" || indexStatus === "EXPIRED";

 const sessionsQuery = useChatSessions(repoId, canChat);
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
 if (!canChat || sessionsQuery.isLoading) return;
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
 canChat,
 sessionsQuery.isLoading,
 sessionsQuery.isSuccess,
 sessionsQuery.data,
 createSession,
 ]);

  const { setActiveRepository } = useWorkspace();
  
  useEffect(() => {
    if (repoQuery.data) {
      setActiveRepository({
        ...repoQuery.data,
        indexStatus: indexStatus ?? repoQuery.data.indexStatus,
        filesProcessed: statusQuery.data?.filesProcessed ?? repoQuery.data.filesProcessed,
        filesTotal: statusQuery.data?.filesTotal ?? repoQuery.data.filesTotal,
        chunkCount: statusQuery.data?.chunkCount ?? repoQuery.data.chunkCount,
        errorMessage: statusQuery.data?.errorMessage ?? repoQuery.data.errorMessage,
      });
    }
  }, [repoQuery.data, indexStatus, statusQuery.data, setActiveRepository]);

  if (repoQuery.isLoading) {
    return (
      <AppShell title="booting...">
        <div className="flex flex-1 items-center justify-center bg-background">
          <Skeleton className="h-4 w-32 bg-muted" />
        </div>
      </AppShell>
    );
  }

  if (repoQuery.isError || !repoQuery.data) {
    return (
      <AppShell title="ERR_NOT_FOUND">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 bg-background">
          <p className="text-sm font-mono text-destructive">
            {(repoQuery.error as Error)?.message ?? "Directory not found."}
          </p>
          <Button 
            nativeButton={false} 
            render={<Link href="/dashboard" />}
            className="rounded-sm font-mono text-xs border border-border bg-transparent text-foreground hover:bg-muted"
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
        sessionId={sessionId}
        onSelectSession={setSelectedSessionId}
        actions={
          <Tooltip>
            <TooltipTrigger render={
              <Button 
                variant="outline" 
                size="sm" 
                nativeButton={false} 
                render={<Link href="/dashboard" />}
                className="rounded-sm font-mono text-xs border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-3.5 mr-2" />
                cd ..
              </Button>
            } />
            <TooltipContent side="bottom" align="end" className="font-mono bg-popover text-popover-foreground border border-border">Back to workspace</TooltipContent>
          </Tooltip>
        }
      >
        <section className="flex min-h-0 flex-1 flex-col bg-background">
          {!canChat && (!messagesQuery.data || messagesQuery.data.length === 0) ? (
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
              {!canChat && (
                <div className="border-t border-border bg-card p-3 flex justify-between items-center text-xs font-mono text-amber-500/80">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {repo.indexStatus === "PENDING" ? "Repository is pending index..." : "Repository is waking up & indexing..."}
                  </span>
                  <span>{repo.filesTotal ? `${Math.round((repo.filesProcessed / repo.filesTotal) * 100)}%` : "..."}</span>
                </div>
              )}
              <ChatComposer
                disabled={!sessionId || (!canChat && repo.indexStatus !== "EXPIRED")}
                streaming={streaming}
                onSend={send}
                onStop={stop}
              />
            </>
          )}
        </section>
      </AppShell>
    </TooltipProvider>
  );
}