"use client";

import { X, Code2, ExternalLink } from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { citationHref } from "@/components/chat/citation-chips";
import { cn } from "@/lib/utils";

export function WorkspaceSourcePanel() {
  const { 
    isSourcePanelOpen, 
    setSourcePanelOpen, 
    selectedCitation, 
    setSelectedCitation,
    activeCitations,
    activeRepository 
  } = useWorkspace();

  if (!isSourcePanelOpen || !selectedCitation || !activeRepository) return null;

  const href = citationHref(activeRepository, selectedCitation);

  return (
    <aside className="w-80 flex-shrink-0 border-l border-border bg-sidebar flex flex-col hidden xl:flex text-sidebar-foreground font-mono">
      <div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0 bg-sidebar">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Sources</span>
        </div>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-muted" onClick={() => setSourcePanelOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          
          <div className="space-y-3">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center justify-between">
              <span>{activeCitations.length} Files</span>
            </div>
            <div className="space-y-1">
              {activeCitations.map((citation, i) => {
                const isActive = citation.filePath === selectedCitation.filePath && citation.startLine === selectedCitation.startLine;
                return (
                  <button 
                    key={i}
                    onClick={() => setSelectedCitation(citation)}
                    className={cn(
                      "w-full text-left flex items-center justify-between px-2 py-1.5 rounded transition-colors text-[11px]",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="truncate">{citation.filePath.split('/').pop()}</span>
                    {citation.startLine && <span className="opacity-60">{citation.startLine}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-2 pt-4 border-t border-border">
            <h3 className="text-[11px] font-medium text-foreground break-words">{selectedCitation.filePath}</h3>
            
            <div className="bg-card border border-border rounded flex flex-col items-center justify-center p-8 text-center space-y-4">
               <Code2 className="size-6 text-muted-foreground" />
               <p className="text-[10px] text-muted-foreground max-w-[200px]">Source code preview is not available in the current environment.</p>
               <Button render={<a href={href} target="_blank" rel="noreferrer" />} variant="outline" size="sm" className="bg-muted hover:bg-muted/80 text-foreground text-xs mt-2">
                 View on GitHub <ExternalLink className="size-3 ml-2" />
               </Button>
            </div>
          </div>
          
        </div>
      </ScrollArea>
    </aside>
  );
}
