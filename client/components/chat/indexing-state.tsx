"use client";

import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
 Empty,
 EmptyDescription,
 EmptyHeader,
 EmptyMedia,
 EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { getRepoProgress, useStartIndexing } from "@/hooks/use-repos";
import type { IndexStatusResponse, Repository } from "@/lib/api";

export function IndexingState({
 repo,
 status,
}: {
 repo: Repository;
 status?: IndexStatusResponse;
}) {
 const indexMutation = useStartIndexing();
 const filesProcessed = status?.filesProcessed ?? repo.filesProcessed;
 const filesTotal = status?.filesTotal ?? repo.filesTotal;
 const chunkCount = status?.chunkCount ?? repo.chunkCount;
 const progress = getRepoProgress({ filesProcessed, filesTotal });
 const indexStatus = status?.indexStatus ?? repo.indexStatus;
 const errorMessage = status?.errorMessage ?? repo.errorMessage;

 if (indexStatus === "FAILED") {
 return (
 <Empty className="h-full border-0">
 <EmptyHeader>
 <EmptyMedia variant="icon">
 <AlertCircle className="text-destructive" />
 </EmptyMedia>
 <EmptyTitle>Indexing failed</EmptyTitle>
 <EmptyDescription>
 {errorMessage || "Something went wrong while indexing this repository."}
 </EmptyDescription>
 </EmptyHeader>
 <Button
 onClick={() => indexMutation.mutate(repo.id)}
 disabled={indexMutation.isPending}
 >
 <RotateCcw data-icon="inline-start" />
 Retry indexing
 </Button>
 </Empty>
 );
 }

  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Loader2 className="animate-spin" />
        </EmptyMedia>
        <EmptyTitle>Indexing {repo.fullName}</EmptyTitle>
        <EmptyDescription>
          {filesTotal > 0
            ? `${filesProcessed} of ${filesTotal} files · ${chunkCount} chunks embedded`
            : indexStatus === "PENDING" && !indexMutation.isPending
              ? "Connecting repository and preparing to index…"
              : "Fetching repository files and preparing embeddings…"}
        </EmptyDescription>
      </EmptyHeader>
      <div className="w-full max-w-sm space-y-3">
        <Progress value={Math.max(progress, filesTotal ? progress : 12)} />
        <p className="text-center text-xs text-muted-foreground">
          You can leave this page open — chat unlocks when indexing finishes.
        </p>
        {indexStatus === "PENDING" && !indexMutation.isPending && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => indexMutation.mutate(repo.id)}
            >
              Start indexing now
            </Button>
          </div>
        )}
      </div>
    </Empty>
  );
}