"use client";

import { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceSourcePanel } from "./workspace-source-panel";
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "./workspace-context";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  sessionId,
  onSelectSession,
  title,
  actions,
}: {
  children: ReactNode;
  sessionId?: string | null;
  onSelectSession?: (id: string) => void;
  title?: string;
  actions?: ReactNode;
}) {
  const { activeRepository } = useWorkspace();
  return (
    <SidebarProvider>
      <WorkspaceSidebar sessionId={sessionId} onSelectSession={onSelectSession} />
        
        <SidebarInset className="bg-background flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4 font-mono text-muted-foreground py-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  {title && <h1 className="truncate text-xs font-medium text-foreground">{title}</h1>}
                  {activeRepository && (
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm bg-muted border border-border">
                      <div className={cn("size-1.5 rounded-full", {
                        "bg-primary": activeRepository.indexStatus === "PENDING" || activeRepository.indexStatus === "INDEXING",
                        "animate-pulse": activeRepository.indexStatus === "INDEXING",
                        "bg-green-500": activeRepository.indexStatus === "READY",
                        "bg-red-500": activeRepository.indexStatus === "FAILED",
                        "bg-muted-foreground": activeRepository.indexStatus === "EXPIRED",
                      })} />
                      <span className={cn({
                         "text-primary": activeRepository.indexStatus === "INDEXING" || activeRepository.indexStatus === "PENDING",
                         "text-green-500": activeRepository.indexStatus === "READY",
                         "text-red-500": activeRepository.indexStatus === "FAILED",
                         "text-muted-foreground": activeRepository.indexStatus === "EXPIRED"
                      })}>{activeRepository.indexStatus}</span>
                    </div>
                  )}
                </div>
                {activeRepository && (activeRepository.filesTotal > 0 || activeRepository.chunkCount > 0) && (
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    {activeRepository.filesTotal > 0 && <span>{activeRepository.filesTotal.toLocaleString()} files</span>}
                    {activeRepository.chunkCount > 0 && <span>{activeRepository.chunkCount.toLocaleString()} chunks</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {actions}
              </div>
            </div>
          </header>
          
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <main className="flex-1 min-w-0 flex flex-col bg-background">
              {children}
            </main>
            <WorkspaceSourcePanel />
          </div>
        </SidebarInset>
      </SidebarProvider>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return null; // or restore the original implementation if needed
}

export function GhostButtonLink({ className }: { className?: string }) {
  return null;
}
