"use client";

import { useEffect, useState } from "react";
import { FolderGit2, Search, FileCode2, Terminal, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

export function AnimatedHero() {
  const [step, setStep] = useState(0);
  const [queryText, setQueryText] = useState("");
  const fullQuery = "How does authentication work?";

  useEffect(() => {
    // Sequence timing
    // 0: Init
    // 1: Repo appears (0.5s)
    // 2: Typing query (1.5s -> 3s)
    // 3: Searching / indexing (3.5s)
    // 4: Files retrieved (4.5s)
    // 5: Answer appears (5.5s)
    
    let timer: NodeJS.Timeout;
    
    if (step === 0) {
      timer = setTimeout(() => setStep(1), 500);
    } else if (step === 1) {
      timer = setTimeout(() => setStep(2), 800);
    } else if (step === 2) {
      let i = 0;
      const typeInterval = setInterval(() => {
        setQueryText(fullQuery.slice(0, i + 1));
        i++;
        if (i === fullQuery.length) {
          clearInterval(typeInterval);
          setTimeout(() => setStep(3), 500);
        }
      }, 50);
      return () => clearInterval(typeInterval);
    } else if (step === 3) {
      timer = setTimeout(() => setStep(4), 1200);
    } else if (step === 4) {
      timer = setTimeout(() => setStep(5), 1000);
    } else if (step === 5) {
      // Loop back or hold
      timer = setTimeout(() => {
        setStep(0);
        setQueryText("");
      }, 10000); // Hold for 10s then restart
    }

    return () => clearTimeout(timer);
  }, [step]);

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-lg border border-border bg-[#09090b] shadow-2xl overflow-hidden font-mono text-sm">
      {/* Window Header */}
      <div className="flex h-10 items-center justify-between border-b border-border px-4 bg-[#09090b]">
        <div className="flex gap-2">
          <div className="size-3 rounded-full bg-border" />
          <div className="size-3 rounded-full bg-border" />
          <div className="size-3 rounded-full bg-border" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground transition-opacity duration-500">
          <FolderGit2 className="size-3.5" />
          <span className={step >= 1 ? "opacity-100" : "opacity-0"}>prosno / repository</span>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex min-h-[360px]">
        {/* Sidebar */}
        <div className="w-48 border-r border-border bg-[#09090b] p-3 hidden sm:block">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Search className="size-3.5" /> Explorer
          </div>
          <div className={`space-y-2 text-xs text-muted-foreground transition-all duration-700 ${step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <div className="flex items-center gap-2 text-foreground"><ChevronRight className="size-3" /> src</div>
            <div className="flex items-center gap-2 pl-4"><FileCode2 className="size-3" /> auth/service.ts</div>
            <div className="flex items-center gap-2 pl-4"><FileCode2 className="size-3" /> middleware/auth.ts</div>
            <div className="flex items-center gap-2 pl-4"><FileCode2 className="size-3" /> lib/session.ts</div>
            <div className="flex items-center gap-2"><ChevronRight className="size-3" /> api</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#09090b]">
          {/* Chat area */}
          <div className="flex-1 p-6 flex flex-col gap-6">
            
            {/* User Query */}
            <div className={`flex gap-3 transition-opacity duration-300 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
              <div className="shrink-0 mt-0.5 text-primary"><Terminal className="size-4" /></div>
              <div className="text-foreground">
                {queryText}
                {step === 2 && <span className="inline-block w-2 h-4 ml-1 align-middle bg-primary animate-pulse" />}
              </div>
            </div>

            {/* Loading / Searching State */}
            {step === 3 && (
              <div className="flex gap-3 text-muted-foreground items-center text-xs animate-in fade-in duration-300">
                <Loader2 className="size-3.5 animate-spin" />
                Searching 142 files...
              </div>
            )}

            {/* Retrieved Files */}
            <div className={`flex flex-col gap-2 transition-all duration-500 ${step >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 hidden"}`}>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-green-500" />
                Retrieved 3 files
              </div>
              <div className="flex gap-2">
                <div className="px-2 py-1 rounded border border-border bg-muted/20 text-xs text-foreground/80 flex items-center gap-1.5">
                  <FileCode2 className="size-3 text-primary" /> auth/service.ts
                </div>
                <div className="px-2 py-1 rounded border border-border bg-muted/20 text-xs text-foreground/80 flex items-center gap-1.5">
                  <FileCode2 className="size-3 text-primary" /> middleware/auth.ts
                </div>
              </div>
            </div>

            {/* Answer */}
            <div className={`flex gap-3 transition-all duration-700 ${step >= 5 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 hidden"}`}>
              <div className="shrink-0 mt-0.5"><div className="size-4 rounded-full bg-primary/20 flex items-center justify-center"><div className="size-2 rounded-full bg-primary" /></div></div>
              <div className="text-foreground/90 font-sans text-sm leading-relaxed max-w-md">
                Authentication uses JWT rotation. The <span className="font-mono text-xs text-primary bg-primary/10 px-1 py-0.5 rounded">auth/service.ts</span> generates short-lived access tokens and long-lived refresh tokens. The middleware intercepts 401s and attempts to refresh the session automatically.
                
                <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2">
                  <div className="px-2 py-1 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer border border-border text-xs font-mono text-muted-foreground flex items-center gap-1 transition-colors">
                    <span className="text-primary">1</span> auth/service.ts:42
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer border border-border text-xs font-mono text-muted-foreground flex items-center gap-1 transition-colors">
                    <span className="text-primary">2</span> middleware/auth.ts:18
                  </div>
                </div>
              </div>
            </div>
            
          </div>
          
          {/* Input Box Mock */}
          <div className="p-4 border-t border-border bg-[#09090b]">
            <div className="w-full rounded-md border border-border bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
              <Search className="size-3.5" />
              Ask anything about your codebase...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
