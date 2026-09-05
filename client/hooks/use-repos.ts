"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Repository, type ConnectRepoRequest, type ConnectBatchRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/components/ui/toast";

const INDEXING_POLL_MS = 2000;

function hasIndexingRepos(repos: Repository[] | undefined) {
  return (
    repos?.some(
      (repo) => repo.indexStatus === "INDEXING" || repo.indexStatus === "PENDING"
    ) ?? false
  );
}

function updateRepoInListCache(
  queryClient: ReturnType<typeof useQueryClient>,
  repo: Repository
) {
  queryClient.setQueryData<Repository[]>(queryKeys.repos.list(), (current) => {
    if (!current) return current;
    return current.map((item) => (item.id === repo.id ? repo : item));
  });
}

export function useRepos() {
  return useQuery({
    queryKey: queryKeys.repos.list(),
    queryFn: () => api.listRepos(false),
    staleTime: 30_000,
    refetchInterval: (query) =>
      hasIndexingRepos(query.state.data) ? INDEXING_POLL_MS : false,
  });
}

export function useGithubRepos(enabled = true) {
  return useQuery({
    queryKey: queryKeys.repos.github(),
    queryFn: () => api.listGithubRepos(),
    enabled,
    staleTime: 60_000,
  });
}

export function useConnectRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: ConnectRepoRequest) => api.connectRepo(req),
    onSuccess: (data) => {
      const repo = data.repository;
      queryClient.setQueryData<Repository[]>(queryKeys.repos.list(), (old) => {
        if (!old) return [repo];
        const exists = old.find((r) => r.id === repo.id);
        if (exists) return old.map((r) => (r.id === repo.id ? repo : r));
        return [repo, ...old];
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.github() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.detail(repo.id) });
      toast.add({
        title: "Repository connected",
        description: `Connected ${repo.fullName}. Indexing started…`,
        type: "success",
      });
    },
    onError: (error: Error) => {
      toast.add({
        title: "Could not connect repository",
        description: error.message || "Failed to connect repository",
        type: "error",
      });
    },
  });
}

export function useConnectBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: ConnectBatchRequest) => api.connectBatch(req),
    onSuccess: (data) => {
      const successful = data.results.filter((r) => r.success);
      const failed = data.results.filter((r) => !r.success);

      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.github() });

      if (successful.length > 0) {
        toast.add({
          title: "Repositories connected",
          description: `Connected ${successful.length} repository${successful.length !== 1 ? "ies" : ""}.`,
          type: "success",
        });
      }
      if (failed.length > 0) {
        toast.add({
          title: "Some connections failed",
          description: `${failed.length} repository${failed.length !== 1 ? "ies" : ""} could not be connected.`,
          type: "warning",
        });
      }
    },
    onError: (error: Error) => {
      toast.add({
        title: "Batch connection failed",
        description: error.message || "Failed to connect repositories",
        type: "error",
      });
    },
  });
}

export function useDisconnectRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repoId: string) => api.disconnectRepo(repoId),
    onSuccess: (_, repoId) => {
      queryClient.setQueryData<Repository[]>(queryKeys.repos.list(), (old) => {
        if (!old) return [];
        return old.filter((r) => r.id !== repoId);
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.github() });
      void queryClient.removeQueries({ queryKey: queryKeys.repos.detail(repoId) });
      toast.add({
        title: "Repository removed",
        description: "Repository disconnected from your workspace",
        type: "info",
      });
    },
    onError: (error: Error) => {
      toast.add({
        title: "Could not remove repository",
        description: error.message || "Failed to disconnect repository",
        type: "error",
      });
    },
  });
}

export function useRepository(repoId: string) {
  return useQuery({
    queryKey: queryKeys.repos.detail(repoId),
    queryFn: () => api.getRepo(repoId),
    enabled: Boolean(repoId),
    refetchInterval: (query) => {
      const status = query.state.data?.indexStatus;
      return status === "INDEXING" || status === "PENDING"
        ? INDEXING_POLL_MS
        : false;
    },
  });
}

export function useIndexStatus(repoId: string, enabled = false) {
  return useQuery({
    queryKey: queryKeys.repos.status(repoId),
    queryFn: () => api.indexStatus(repoId),
    enabled: Boolean(repoId) && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.indexStatus;
      return status === "INDEXING" || status === "PENDING" ? 1500 : false;
    },
  });
}

export function useStartIndexing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repoId: string) => api.startIndex(repoId),
    onSuccess: (data) => {
      const repo = data.repository;
      queryClient.setQueryData(queryKeys.repos.detail(repo.id), repo);
      updateRepoInListCache(queryClient, repo);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.status(repo.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.detail(repo.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.list(),
      });
      toast.add({
        title: "Indexing started",
        description: `Indexing ${repo.fullName}…`,
        type: "loading",
      });
    },
    onError: (error: Error) => {
      toast.add({
        title: "Could not start indexing",
        description: error.message,
        type: "error",
      });
    },
  });
}

export function useRefreshRepos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      toast.promise(api.listRepos(true), {
        loading: {
          title: "Syncing repositories",
          description: "Fetching the latest repos from GitHub…",
          type: "loading",
        },
        success: (repos) => ({
          title: "Sync successful",
          description: `${repos.length} repositories loaded`,
          type: "success",
        }),
        error: (error: Error) => ({
          title: "Sync failed",
          description:
            error instanceof Error ? error.message : "Could not sync repositories",
          type: "error",
        }),
      }),
    onSuccess: (repos) => {
      queryClient.setQueryData(queryKeys.repos.list(), repos);
    },
  });
}

export function getRepoProgress(repo: Pick<
  Repository,
  "filesProcessed" | "filesTotal"
>) {
  if (!repo.filesTotal) return 0;
  return Math.min(100, Math.round((repo.filesProcessed / repo.filesTotal) * 100));
}