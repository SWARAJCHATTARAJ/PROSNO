"use client";

import { useEffect, useState } from "react";
import { FolderGit2, FileCode2, Terminal } from "lucide-react";

export function HeroInteractive() {
  const [step, setStep] = useState(0);
  const [queryText, setQueryText] = useState("");
  const fullQuery = "Why does checkout return 401 after token refresh?";

  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueryText(fullQuery);
      return;
    }

    let timer: NodeJS.Timeout;
    
    // Step 0: Quiet (2s)
    // Step 1: INDEXING (2s)
    // Step 2: READY (1.5s)
    // Step 3: Typing query
    // Step 4: Retrieval signal (1.5s)
    // Step 5: Files illuminate (1.5s)
    // Step 6: Code expands into context (1s)
    // Step 7: Answer appears (2s)
    // Step 8: Citations appear (1.5s)
    // Step 9: Source line highlights (wait 20s, reset)

    if (step === 0) timer = setTimeout(() => setStep(1), 2000);
    else if (step === 1) timer = setTimeout(() => setStep(2), 2000);
    else if (step === 2) timer = setTimeout(() => setStep(3), 1500);
    else if (step === 3) {
      let i = 0;
      const typeInterval = setInterval(() => {
        setQueryText(fullQuery.slice(0, i + 1));
        i++;
        if (i === fullQuery.length) {
          clearInterval(typeInterval);
          setTimeout(() => setStep(4), 1000);
        }
      }, 40);
      return () => clearInterval(typeInterval);
    }
    else if (step === 4) timer = setTimeout(() => setStep(5), 1500);
    else if (step === 5) timer = setTimeout(() => setStep(6), 1500);
    else if (step === 6) timer = setTimeout(() => setStep(7), 1000);
    else if (step === 7) timer = setTimeout(() => setStep(8), 2000);
    else if (step === 8) timer = setTimeout(() => setStep(9), 1500);
    else if (step === 9) {
      timer = setTimeout(() => {
        setStep(0);
        setQueryText("");
      }, 20000); // 20s REST / HOLD
    }

    return () => clearTimeout(timer);
  }, [step]);

  // Files data
  const files = [
    { path: "src/auth/middleware.ts", relevant: true },
    { path: "src/auth/session.ts", relevant: true },
    { path: "src/auth/strategy.ts", relevant: false },
    { path: "src/checkout/client.ts", relevant: true },
    { path: "src/checkout/service.ts", relevant: false },
    { path: "src/api/routes.ts", relevant: false },
    { path: "src/api/client.ts", relevant: false },
    { path: "src/database/connection.ts", relevant: false },
  ];

  const showIndexing = step === 1;
  const showReady = step >= 2;
  const showRetrieval = step === 4;
  const showFilesLit = step >= 5;
  const showCodeContext = step >= 6;
  const showAnswer = step >= 7;
  const showCitations = step >= 8;
  const showSourceHighlight = step >= 9;

  return (
    <div className="relative w-full max-w-2xl font-mono text-xs text-zinc-500 bg-[#050505] border border-[#222] rounded-sm shadow-2xl overflow-hidden flex flex-col h-[600px] md:h-[520px]">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#222] px-4 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <FolderGit2 className="size-3.5 text-zinc-500 shrink-0" />
          <span className="text-zinc-300 truncate">acme / e-commerce</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {showIndexing && <span className="text-primary animate-pulse">INDEXING...</span>}
          {showReady && !showIndexing && (
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              READY <span className="text-zinc-600 hidden sm:inline">142 files</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        {/* Repository Tree */}
        <div className={`transition-all duration-700 ease-in-out border-b md:border-b-0 md:border-r border-[#222] bg-[#050505] overflow-hidden flex flex-col shrink-0
          ${showCodeContext ? "h-12 md:h-auto md:w-48 opacity-100 md:opacity-50" : "h-full md:w-full opacity-100"}`}>
          
          <div className="p-4 flex items-center gap-2 shrink-0 text-zinc-400">
             <FolderGit2 className="size-3.5" /> src/
          </div>
          <div className={`space-y-1.5 px-4 pb-4 relative transition-all duration-500 flex-1 overflow-hidden ${showCodeContext ? "opacity-0 md:opacity-100" : "opacity-100"}`}>
            {showRetrieval && (
              <div className="absolute top-0 left-0 w-full h-px bg-primary/50 animate-[scan_1.5s_ease-in-out]" />
            )}
            
            {files.map((file) => {
              const isRelevant = file.relevant;
              const isLit = showFilesLit && isRelevant;
              const isMuted = showFilesLit && !isRelevant;
              
              const parts = file.path.split('/');
              const name = parts.pop();

              return (
                <div key={file.path} className={`flex items-center gap-2 transition-all duration-500 pl-4
                  ${isLit ? "text-primary" : ""}
                  ${isMuted ? "opacity-20" : "opacity-100"}
                `}>
                  <FileCode2 className={`size-3 shrink-0 ${isLit ? "text-primary" : "text-zinc-600"}`} />
                  <span className={`truncate ${isLit ? "text-zinc-200" : ""}`}>{name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Intelligence Context Area */}
        <div className={`flex-1 flex flex-col transition-all duration-700 ease-in-out absolute md:relative left-0 right-0 bottom-0 md:bottom-auto md:right-auto md:left-auto bg-[#0a0a0a] md:border-l border-[#222]
          ${showCodeContext ? "translate-y-0 md:translate-x-0 h-[calc(100%-3rem)] md:h-auto md:w-[calc(100%-12rem)]" : "translate-y-full md:translate-y-0 md:translate-x-full h-[calc(100%-3rem)] md:h-auto md:w-[calc(100%-12rem)]"}
        `}>
          <div className="p-4 shrink-0 border-b border-[#222] bg-[#050505] flex items-center gap-2 text-zinc-300">
            <Terminal className="size-3.5 text-primary shrink-0" /> 
            <span className="truncate">{queryText}</span>
            {step === 3 && <span className="w-1.5 h-3.5 bg-primary animate-pulse inline-block align-middle ml-1 shrink-0" />}
          </div>
          
          <div className="flex-1 p-5 flex flex-col gap-6 overflow-hidden">
            {/* Retrieved Context */}
            <div className={`transition-all duration-700 delay-100 ${showCodeContext ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Retrieving context
              </div>
              <div className="space-y-1.5 border-l border-[#222] pl-3 ml-1 text-[11px]">
                <div className="text-zinc-400">checkout/client.ts</div>
                <div className="text-zinc-400">auth/session.ts</div>
                <div className="text-zinc-400">auth/middleware.ts</div>
              </div>
            </div>

            {/* Answer */}
            <div className={`transition-all duration-700 ${showAnswer ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 hidden"}`}>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Answer</div>
              <div className="font-sans text-sm text-zinc-200 leading-relaxed max-w-sm">
                The refreshed token is not propagated to the checkout client.
              </div>
            </div>

            {/* Evidence */}
            <div className={`transition-all duration-700 ${showCitations ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 hidden"}`}>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Citations</div>
              <div className="flex gap-2 text-[10px]">
                <span className="px-2 py-1 rounded border border-[#222] bg-[#111]">checkout/client.ts:84</span>
                <span className="px-2 py-1 rounded border border-[#222] bg-[#111]">auth/session.ts:42</span>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                <div className={`border border-[#222] bg-[#050505] p-3 transition-colors duration-500 ${showSourceHighlight ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="text-zinc-400 mb-2 font-mono text-[10px] flex items-center justify-between">
                    <span>checkout/client.ts</span>
                  </div>
                  <pre className="text-[10px] leading-relaxed overflow-x-auto text-zinc-500">
                    <code className="block">82  const token = session.token</code>
                    <code className="block">83</code>
                    <code className={`block transition-colors duration-500 ${showSourceHighlight ? "text-primary bg-primary/10" : ""}`}>84  client.headers.Authorization = token</code>
                    <code className="block">85</code>
                    <code className="block">86  return client.request()</code>
                  </pre>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(200px); opacity: 0; }
        }
      `}} />
    </div>
  );
}
