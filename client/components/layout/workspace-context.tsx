"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { Citation, Repository } from "@/lib/api";

interface WorkspaceState {
  selectedCitation: Citation | null;
  setSelectedCitation: (citation: Citation | null) => void;
  activeCitations: Citation[];
  setActiveCitations: (citations: Citation[]) => void;
  isSourcePanelOpen: boolean;
  setSourcePanelOpen: (isOpen: boolean) => void;
  activeRepository: Repository | null;
  setActiveRepository: (repo: Repository | null) => void;
}

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [isSourcePanelOpen, setSourcePanelOpen] = useState(false);
  const [activeRepository, setActiveRepository] = useState<Repository | null>(null);

  const handleSetCitation = (citation: Citation | null, citations?: Citation[]) => {
    setSelectedCitation(citation);
    if (citations) {
      setActiveCitations(citations);
    }
    if (citation) {
      setSourcePanelOpen(true);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        selectedCitation,
        setSelectedCitation: (c) => handleSetCitation(c),
        activeCitations,
        setActiveCitations,
        isSourcePanelOpen,
        setSourcePanelOpen,
        activeRepository,
        setActiveRepository,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
