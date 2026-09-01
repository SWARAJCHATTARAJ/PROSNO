"use client";

import { FileCode2 } from "lucide-react";
import { useWorkspace } from "@/components/layout/workspace-context";

import { Badge } from "@/components/ui/badge";
import type { Citation, Repository } from "@/lib/api";

export function citationHref(repo: Repository, citation: Citation) {
  const line =
    citation.startLine != null
      ? `#L${citation.startLine}${
          citation.endLine && citation.endLine !== citation.startLine
            ? `-L${citation.endLine}`
            : ""
        }`
      : "";
  return `https://github.com/${repo.fullName}/blob/${repo.defaultBranch}/${citation.filePath}${line}`;
}

export function CitationChips({
  repo,
  citations,
}: {
  repo: Repository;
  citations: Citation[];
}) {
  const { setSelectedCitation, setActiveCitations } = useWorkspace();

  if (!citations.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-2">
      {citations.map((citation, index) => (
        <button
          key={`${citation.filePath}-${index}`}
          type="button"
          onClick={() => {
            setSelectedCitation(citation);
            setActiveCitations(citations);
          }}
          className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded border border-border bg-card text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        >
          <FileCode2 className="size-3 opacity-70" />
          <span className="truncate">
            {citation.filePath.split('/').pop()}
            {citation.startLine != null ? `:${citation.startLine}` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}