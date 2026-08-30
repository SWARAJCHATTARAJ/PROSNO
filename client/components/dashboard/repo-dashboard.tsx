"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderGit2, RefreshCw, RotateCw, TriangleAlert } from "lucide-react";

import { api, type IndexStatus, type Repository, type IndexTriggerResponse, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const statusLabels: Record<IndexStatus, string> = {
  PENDING: "pending",
  INDEXING: "indexing",
  READY: "ready",
  FAILED: "failed",
};

function StatusIndicator({ status }: { status: IndexStatus }) {
  let color = "bg-neutral-500";
  if (status === "READY") color = "bg-green-500";
  if (status === "PENDING" || status === "INDEXING") color = "bg-primary dark:bg-amber-500 text-primary-foreground dark:text-[#0a0a0a]";
  if (status === "FAILED") color = "bg-red-500";
  
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground dark:text-neutral-400">
      <div className={cn("size-2 rounded-full", color, status === "INDEXING" && "animate-pulse")} />
      {statusLabels[status]}
    </div>
  );
}

function indexingProgress(repository: Repository) {
  if (repository.filesTotal === 0) return 0;
  return Math.round((repository.filesProcessed / repository.filesTotal) * 100);
}

export function RepoDashboard() {
  const queryClient = useQueryClient();
  const repositories = useQuery({
    queryKey: queryKeys.repos.list(),
    queryFn: () => api.listRepos(),
    refetchInterval: (query) =>
      query.state.data?.some((repository) => repository.indexStatus === "INDEXING")
        ? 3_000
        : false,
  });

  const handleOutcome = (data: IndexTriggerResponse) => {
    queryClient.setQueryData(queryKeys.repos.list(), (old: Repository[] | undefined) => {
      if (!old) return old;
      return old.map(r => r.id === data.repository.id ? data.repository : r);
    });
    
    if (data.outcome === "STARTED_INDEXING") {
      toast({ type: "success", title: "Indexing started" });
    } else if (data.outcome === "ALREADY_UP_TO_DATE") {
      toast({ type: "info", title: "Already up to date — no changes found" });
    } else if (data.outcome === "ALREADY_IN_PROGRESS") {
      toast({ type: "info", title: "Already indexing — hang tight" });
    }
  };

  const handleError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 429) {
      const hours = error.retryAfter ? Math.ceil(error.retryAfter / 3600) : 24;
      toast({ type: "warning", title: `Rate limit reached — try again in ${hours} hour${hours !== 1 ? 's' : ''}` });
    } else {
      toast({ type: "error", title: "Failed to start indexing" });
    }
  };

  const indexRepository = useMutation({
    mutationFn: api.startIndex,
    onSuccess: handleOutcome,
    onError: handleError,
    onSettled: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() }), 1000);
    }
  });

  const refreshRepository = useMutation({
    mutationFn: api.refreshIndex,
    onSuccess: handleOutcome,
    onError: handleError,
    onSettled: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() }), 1000);
    }
  });

  const isRefreshing = repositories.isFetching && !repositories.isLoading;
  const repositoryList = repositories.data ?? [];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 bg-background dark:bg-[#0a0a0a]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border dark:border-white/10 pb-4">
        <div>
          <h1 className="font-mono text-xl font-medium tracking-tight text-foreground dark:text-neutral-200">
            ~/workspaces
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground/80 dark:text-neutral-500">
            Select a project to boot chat server.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => repositories.refetch()}
          disabled={repositories.isFetching}
          className="border-border dark:border-white/10 bg-transparent text-muted-foreground dark:text-neutral-400 hover:bg-black/5 dark:bg-white/5 hover:text-foreground dark:text-neutral-200 rounded-sm font-mono text-xs"
        >
          <RefreshCw className={cn("size-3.5 mr-2", isRefreshing && "animate-spin")} />
          sync
        </Button>
      </div>

      {repositories.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16 text-primary dark:text-amber-500">
          <Spinner className="size-7" />
        </div>
      ) : repositories.isError ? (
        <Empty className="min-h-64 border border-red-500/20 bg-red-500/5 rounded-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="text-red-500 bg-transparent">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle className="font-mono text-red-400">ERR_FETCH_FAILED</EmptyTitle>
            <EmptyDescription className="font-mono text-xs text-red-500/70">
              Connection refused.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => repositories.refetch()} className="rounded-sm font-mono text-xs bg-black/10 dark:bg-white/10 text-foreground/90 dark:text-neutral-300 hover:bg-white/20">
              retry()
            </Button>
          </EmptyContent>
        </Empty>
      ) : repositoryList.length === 0 ? (
        <Empty className="min-h-64 border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] rounded-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="text-muted-foreground/80 dark:text-neutral-500 bg-transparent">
              <FolderGit2 />
            </EmptyMedia>
            <EmptyTitle className="font-mono text-foreground/90 dark:text-neutral-300">directory empty</EmptyTitle>
            <EmptyDescription className="font-mono text-xs text-muted-foreground/80 dark:text-neutral-500">
              Mount a GitHub repository to begin.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {repositoryList.map((repository) => (
            <RepositoryCard
              key={repository.id}
              repository={repository}
              isIndexing={indexRepository.isPending && indexRepository.variables === repository.id}
              isRefreshing={refreshRepository.isPending && refreshRepository.variables === repository.id}
              onIndex={() => indexRepository.mutate(repository.id)}
              onRefresh={() => refreshRepository.mutate(repository.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function RepositoryCard({
  repository,
  isIndexing,
  isRefreshing,
  onIndex,
  onRefresh,
}: {
  repository: Repository;
  isIndexing: boolean;
  isRefreshing: boolean;
  onIndex: () => void;
  onRefresh: () => void;
}) {
  const progress = indexingProgress(repository);
  const indexing = repository.indexStatus === "INDEXING";

  return (
    <Card className="border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] shadow-none rounded-sm flex flex-col transition-colors hover:border-border dark:border-white/20 hover:bg-muted/40 dark:bg-[#121212]">
      <CardHeader className="p-4 border-b border-border dark:border-white/5 space-y-0 pb-3 flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate font-mono text-sm font-normal text-foreground dark:text-neutral-200">
            <span className="text-primary dark:text-amber-500/70 mr-1">const</span>
            {repository.fullName.split('/')[1] || repository.fullName}
          </CardTitle>
          <p className="mt-2 line-clamp-2 min-h-8 font-mono text-xs text-muted-foreground/80 dark:text-neutral-500">
            {repository.description ? `// ${repository.description}` : "// no description"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-end">
        {indexing && (
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground dark:text-neutral-400">
              <span>processing...</span>
              <span className="text-primary dark:text-amber-500">{repository.filesProcessed} / {repository.filesTotal}</span>
            </div>
            <Progress value={progress} className="h-1 bg-black/5 dark:bg-white/5 [&>div]:bg-primary dark:[&>div]:bg-amber-500 rounded-none" aria-label="Indexing progress" />
          </div>
        )}
        {repository.indexStatus === "FAILED" && repository.errorMessage && (
          <p className="font-mono text-xs text-red-500 bg-red-500/10 p-2 rounded-sm border border-red-500/20">{repository.errorMessage}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-cyan-500/70">{repository.language || "txt"}</span>
            {repository.indexStatus === "READY" && (
              <span className="font-mono text-[10px] text-neutral-600">{repository.chunkCount.toLocaleString()} chunks</span>
            )}
          </div>
          <StatusIndicator status={repository.indexStatus} />
        </div>
        <div className="flex w-full gap-2 pt-2">
          {repository.indexStatus === "READY" && (
            <Button
              className="flex-1 rounded-sm font-mono text-xs bg-primary dark:bg-amber-500 text-primary-foreground dark:text-[#0a0a0a]  hover:bg-primary/90 dark:hover:bg-amber-400 focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0a]"
              nativeButton={false}
              render={<Link href={`/chat/${repository.id}`} />}
            >
              $ ./chat
            </Button>
          )}
          <Button
            className={cn(
              "rounded-sm font-mono text-xs border border-border dark:border-white/10 hover:bg-black/5 dark:bg-white/5 text-foreground/90 dark:text-neutral-300 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0a]",
              repository.indexStatus === "READY" ? "flex-1 bg-transparent" : "w-full bg-muted dark:bg-[#1a1a1a]"
            )}
            onClick={repository.indexStatus === "READY" ? onRefresh : onIndex}
            disabled={repository.indexStatus === "INDEXING" || isIndexing || isRefreshing}
          >
            {isIndexing || isRefreshing || indexing ? (
              <Spinner className="text-primary dark:text-amber-500" />
            ) : repository.indexStatus === "READY" ? (
              <><RefreshCw className="size-3.5 mr-2" />rebuild()</>
            ) : (
              <><RotateCw className="size-3.5 mr-2" />make install</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
