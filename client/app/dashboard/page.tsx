"use client";

import { RequireAuth } from "@/components/providers/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { FolderGit2, Plus, RefreshCw } from "lucide-react";
import { AddPublicRepo } from "@/components/dashboard/add-public-repo";
import { ConnectRepoModal } from "@/components/dashboard/connect-repo-modal";
import { RepoCard } from "@/components/dashboard/repo-card";
import { useRepos, useRefreshRepos } from "@/hooks/use-repos";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const reposQuery = useRepos();
  const refreshMutation = useRefreshRepos();
  const repos = reposQuery.data ?? [];

  return (
    <RequireAuth>
      <AppShell title="workspace">
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 bg-background">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 font-mono">
            <div>
              <h1 className="text-lg font-medium tracking-tight text-foreground">
                ~/workspaces
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select a connected repository to chat or start indexing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending || reposQuery.isFetching}
                className="font-mono text-xs border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5 mr-1.5",
                    (refreshMutation.isPending || reposQuery.isFetching) && "animate-spin"
                  )}
                />
                Sync
              </Button>
              <ConnectRepoModal />
            </div>
          </div>

          {reposQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center py-24 text-primary">
              <Spinner className="size-8" />
            </div>
          ) : reposQuery.isError ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center font-mono">
              <div className="p-4 rounded-sm border border-destructive/30 bg-destructive/5 max-w-md text-xs space-y-3">
                <p className="text-destructive font-medium">Failed to load workspaces</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reposQuery.refetch()}
                  className="font-mono text-xs"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : repos.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center font-mono">
              <div className="flex flex-col items-center gap-4 max-w-md">
                <div className="size-12 rounded-lg bg-muted flex items-center justify-center border border-border">
                  <FolderGit2 className="size-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-medium text-foreground">
                    NO REPOSITORIES CONNECTED
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Connect a GitHub repository or add a public repo to start querying your codebase.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <ConnectRepoModal
                    trigger={
                      <Button className="font-mono text-xs bg-primary text-primary-foreground">
                        <Plus className="size-3.5 mr-1.5" />
                        Connect repository
                      </Button>
                    }
                  />
                  <AddPublicRepo />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {repos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          )}
        </main>
      </AppShell>
    </RequireAuth>
  );
}
