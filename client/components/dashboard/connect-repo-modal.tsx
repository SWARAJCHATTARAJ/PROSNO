"use client";

import { useState, useMemo } from "react";
import { Plus, Search, FolderGit2, Lock, ExternalLink, RefreshCw, Check, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useGithubRepos, useConnectRepo, useConnectBatch } from "@/hooks/use-repos";
import { AddPublicRepo } from "./add-public-repo";
import { cn } from "@/lib/utils";
import type { GithubRepo } from "@/lib/api";

interface ConnectRepoModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ConnectRepoModal({ open: controlledOpen, onOpenChange: controlledOnOpenChange, trigger }: ConnectRepoModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const [activeTab, setActiveTab] = useState<"github" | "public">("github");
  const [search, setSearch] = useState("");
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set());

  const githubReposQuery = useGithubRepos(open);
  const connectMutation = useConnectRepo();
  const connectBatchMutation = useConnectBatch();

  const repos = useMemo(() => githubReposQuery.data ?? [], [githubReposQuery.data]);

  const filteredRepos = useMemo(() => {
    if (!search.trim()) return repos;
    const query = search.toLowerCase().trim();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.fullName.toLowerCase().includes(query) ||
        (r.language && r.language.toLowerCase().includes(query))
    );
  }, [repos, search]);

  const toggleSelect = (repo: GithubRepo) => {
    if (repo.connected) return;
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(repo.id)) {
        next.delete(repo.id);
      } else {
        next.add(repo.id);
      }
      return next;
    });
  };

  const handleConnectSingle = (repo: GithubRepo) => {
    connectMutation.mutate(
      { githubRepoId: repo.id, fullName: repo.fullName },
      {
        onSuccess: () => {
          setSelectedRepoIds((prev) => {
            const next = new Set(prev);
            next.delete(repo.id);
            return next;
          });
        },
      }
    );
  };

  const handleConnectSelected = () => {
    if (selectedRepoIds.size === 0) return;
    const items = repos
      .filter((r) => selectedRepoIds.has(r.id))
      .map((r) => ({ githubRepoId: r.id, fullName: r.fullName }));

    connectBatchMutation.mutate(
      { repositories: items },
      {
        onSuccess: () => {
          setSelectedRepoIds(new Set());
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            />
          }
        >
          <Plus className="size-3.5 mr-2" />
          Connect repository
        </DialogTrigger>
      )}

      <DialogContent
        className="border border-border bg-background p-6 gap-4 font-mono w-[min(92vw,760px)] max-w-[min(92vw,760px)] sm:max-w-[760px] max-h-[80vh] flex flex-col overflow-x-hidden overflow-y-hidden"
        style={{ width: "min(92vw, 760px)", maxWidth: "min(92vw, 760px)", maxHeight: "80vh" }}
      >
        <DialogHeader className="gap-1.5 shrink-0">
          <DialogTitle className="text-base font-normal text-foreground">
            Connect Repository
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect GitHub repositories to index code and start conversational AI assistance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border pb-2 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("github")}
            className={cn(
              "px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5",
              activeTab === "github"
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FolderGit2 className="size-3.5" />
            Your GitHub Repos
            {repos.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-1">
                ({repos.length})
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("public")}
            className={cn(
              "px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5",
              activeTab === "public"
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="size-3.5" />
            Public URL
          </button>
        </div>

        {activeTab === "public" ? (
          <div className="py-2 flex-1 min-h-0 overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-4">
              Add any public repository on GitHub by entering its URL or owner/repo path.
            </p>
            <AddPublicRepo />
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter repositories by name or language…"
                  className="pl-8 text-xs font-mono bg-muted/20 border-border w-full"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => githubReposQuery.refetch()}
                disabled={githubReposQuery.isFetching}
                className="text-xs font-mono shrink-0"
              >
                <RefreshCw
                  className={cn("size-3.5 mr-1.5", githubReposQuery.isFetching && "animate-spin")}
                />
                Sync
              </Button>
            </div>

            {selectedRepoIds.size > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded bg-muted/40 border border-border text-xs shrink-0">
                <span>{selectedRepoIds.size} selected</span>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSelectedRepoIds(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7 bg-primary text-primary-foreground"
                    disabled={connectBatchMutation.isPending}
                    onClick={handleConnectSelected}
                  >
                    {connectBatchMutation.isPending && <Spinner className="size-3 mr-1.5" />}
                    Connect selected ({selectedRepoIds.size})
                  </Button>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden border border-border rounded-sm">
              {githubReposQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-6 text-primary" />
                  <span>Loading GitHub repositories…</span>
                </div>
              ) : githubReposQuery.isError ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 p-4 text-center text-xs text-destructive">
                  <span>Failed to load GitHub repositories</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => githubReposQuery.refetch()}
                    className="text-xs font-mono"
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-muted-foreground">
                  <span>No repositories found</span>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredRepos.map((repo) => {
                    const isSelected = selectedRepoIds.has(repo.id);
                    const isConnecting =
                      connectMutation.isPending &&
                      connectMutation.variables?.githubRepoId === repo.id;

                    return (
                      <div
                        key={repo.id}
                        className={cn(
                          "flex items-start justify-between p-3 gap-3 transition-colors hover:bg-muted/30 text-xs min-w-0",
                          isSelected && "bg-primary/5",
                          repo.connected && "opacity-80"
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-4 shrink-0 pt-0.5 flex items-center justify-center">
                            {!repo.connected ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(repo)}
                                className="size-3.5 shrink-0 rounded border-border text-primary cursor-pointer"
                                aria-label={`Select ${repo.fullName}`}
                              />
                            ) : (
                              <div className="size-3.5 shrink-0" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="font-medium text-foreground break-words min-w-0 [overflow-wrap:anywhere] leading-snug">
                                {repo.fullName}
                              </span>
                              {repo.isPrivate && (
                                <Lock className="size-3 text-muted-foreground shrink-0" />
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 break-words [overflow-wrap:anywhere] leading-relaxed">
                                {repo.description}
                              </p>
                            )}
                            {(repo.language || repo.htmlUrl) && (
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground min-w-0 flex-wrap">
                                {repo.language && (
                                  <span className="text-muted-foreground/80 shrink-0">
                                    {repo.language}
                                  </span>
                                )}
                                {repo.htmlUrl && (
                                  <a
                                    href={repo.htmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    GitHub
                                    <ExternalLink className="size-2.5 shrink-0" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 self-center">
                          {repo.connected ? (
                            <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px] gap-1 py-0.5 shrink-0 whitespace-nowrap">
                              <Check className="size-3 shrink-0" />
                              Connected
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 font-mono hover:bg-primary hover:text-primary-foreground shrink-0 whitespace-nowrap"
                              disabled={isConnecting}
                              onClick={() => handleConnectSingle(repo)}
                            >
                              {isConnecting && <Spinner className="size-3 mr-1" />}
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
