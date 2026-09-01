"use client";

import { RequireAuth } from "@/components/providers/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { FolderGit2 } from "lucide-react";
import { AddPublicRepo } from "@/components/dashboard/add-public-repo";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <AppShell title="workspace">
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-background">
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <div className="size-12 rounded-lg bg-muted flex items-center justify-center border border-border">
              <FolderGit2 className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-foreground">ASK YOUR CODEBASE</h2>
              <p className="text-sm text-muted-foreground">
                Ask about architecture, bugs, dependencies, APIs, or implementation details.
              </p>
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-card border border-border p-4 rounded-sm text-left w-full mt-4">
              <p className="text-muted-foreground mb-2">Example:</p>
              <p className="text-primary/80">&quot;Where is authentication handled?&quot;</p>
            </div>
            <div className="mt-8">
               <AddPublicRepo />
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}