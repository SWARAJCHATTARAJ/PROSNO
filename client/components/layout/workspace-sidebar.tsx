"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderGit2, LogOut, Settings, Plus, RotateCcw, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useRepos, useStartIndexing } from "@/hooks/use-repos";
import { useChatSessions, useCreateChatSession } from "@/hooks/use-chat";
import { useWorkspace } from "./workspace-context";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import type { IndexStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusColors: Record<IndexStatus, string> = {
  PENDING: "bg-primary",
  INDEXING: "bg-primary animate-pulse",
  READY: "bg-green-500",
  FAILED: "bg-red-500",
  EXPIRED: "bg-muted-foreground",
};

export function WorkspaceSidebar({ sessionId, onSelectSession }: { sessionId?: string | null, onSelectSession?: (id: string) => void }) {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  
  const reposQuery = useRepos();
  const repos = reposQuery.data ?? [];
  const { activeRepository } = useWorkspace();
  
  const ready = activeRepository?.indexStatus === "READY";
  const sessionsQuery = useChatSessions(activeRepository?.id ?? "", ready);
  const createSession = useCreateChatSession(activeRepository?.id ?? "");
  const reindex = useStartIndexing();

  return (
    <Sidebar variant="inset" className="border-r border-border bg-sidebar text-sidebar-foreground font-mono">
      <SidebarHeader className="border-b border-border pb-4 pt-4 bg-sidebar">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Logo className="size-8 rounded-sm" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold tracking-tight">PROSNO</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="pt-4 bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
            Repositories
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {reposQuery.isLoading && (
              <div className="space-y-2 px-2">
                <Skeleton className="h-8 bg-muted" />
                <Skeleton className="h-8 bg-muted" />
              </div>
            )}
            <SidebarMenu>
              {repos.map((repo) => {
                const isActive = activeRepository?.id === repo.id;
                return (
                  <SidebarMenuItem key={repo.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={`/chat/${repo.id}`} />}
                      className={cn(
                        "rounded-none border-l-2 transition-colors",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <FolderGit2 className="size-4" />
                      <span className="truncate flex-1">{repo.fullName}</span>
                      <div className={cn("size-1.5 rounded-full", statusColors[repo.indexStatus])} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          <div className="px-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-mono text-muted-foreground border-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => router.push("/dashboard")}
            >
              <Plus className="size-3.5 mr-2" />
              Connect repository
            </Button>
          </div>
        </SidebarGroup>

        {activeRepository && (
          <>
            <Separator className="my-4 bg-border" />
            <SidebarGroup>
                <div className="flex items-center justify-between mb-2 pr-2">
                  <SidebarGroupLabel className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Conversations
                  </SidebarGroupLabel>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground"
                      disabled={!ready || createSession.isPending}
                      onClick={() => {
                        createSession.mutate("New chat", {
                          onSuccess: (session) => {
                            if (onSelectSession) onSelectSession(session.id);
                          },
                        });
                      }}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
                
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sessionsQuery.isLoading && (
                      <div className="space-y-2 px-2 mt-2">
                        <Skeleton className="h-8 bg-muted" />
                        <Skeleton className="h-8 bg-muted" />
                      </div>
                    )}
                    {(() => {
                      const sessions = sessionsQuery.data ?? [];
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);

                      const groups = {
                        TODAY: sessions.filter(s => new Date(s.createdAt) >= today),
                        YESTERDAY: sessions.filter(s => new Date(s.createdAt) >= yesterday && new Date(s.createdAt) < today),
                        OLDER: sessions.filter(s => new Date(s.createdAt) < yesterday),
                      };

                      return Object.entries(groups).map(([label, groupSessions]) => {
                        if (groupSessions.length === 0) return null;
                        return (
                          <div key={label} className="mb-4 last:mb-0">
                            <div className="text-[9px] text-muted-foreground px-3 mb-1 uppercase tracking-widest font-sans font-semibold">
                              {label}
                            </div>
                            {groupSessions.map((session) => {
                              const isActive = sessionId === session.id;
                              return (
                                <SidebarMenuItem key={session.id}>
                                  <SidebarMenuButton
                                    isActive={isActive}
                                    onClick={() => {
                                      if (onSelectSession) onSelectSession(session.id);
                                    }}
                                    className={cn(
                                      "rounded-none h-auto py-2 transition-colors border-l-2",
                                      isActive
                                        ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    )}
                                  >
                                    <div className="flex flex-col gap-1 w-full overflow-hidden px-1">
                                      <span className="truncate text-xs">{session.title}</span>
                                    </div>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border bg-sidebar p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-sm flex w-full items-center gap-2 overflow-hidden px-2 py-1.5 text-left text-sm outline-none transition-colors">
                  <Avatar className="size-8 rounded-sm border border-border">
                    <AvatarImage src={user?.avatarUrl ?? undefined} />
                    <AvatarFallback className="rounded-sm bg-muted text-foreground text-xs">
                      {(user?.displayName ?? "DP").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate text-foreground">{user?.displayName}</span>
                    <span className="truncate text-muted-foreground">@{user?.githubUsername}</span>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-sm border border-border bg-popover text-popover-foreground font-mono text-xs" side="top" align="start">
                <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="focus:bg-muted focus:text-foreground cursor-pointer">
                  <Settings className="size-3.5 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={() => logout.mutate()} className="focus:bg-red-500/10 focus:text-red-500 cursor-pointer text-red-500/80">
                  <LogOut className="size-3.5 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
