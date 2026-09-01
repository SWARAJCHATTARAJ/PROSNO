"use client";

import { useEffect, useRef, useState } from "react";
import { FolderGit2, FileCode2, Network } from "lucide-react";

export function CinematicScroll() {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const progress = -rect.top / (rect.height - window.innerHeight);
      
      let idx = 0;
      if (progress > 0.2) idx = 1;
      if (progress > 0.5) idx = 2;
      if (progress > 0.8) idx = 3;
      
      setActiveIdx(Math.max(0, Math.min(3, idx)));
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // init
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const visualizations = [
    // 0: Repository
    <div key="0" className="flex flex-col items-center justify-center h-full gap-4 opacity-100 transition-opacity duration-700">
      <FolderGit2 className="size-12 text-zinc-600" />
      <div className="font-mono text-sm text-zinc-400">Connecting repository...</div>
    </div>,
    // 1: Files
    <div key="1" className="flex flex-col h-full justify-center gap-2 opacity-100 transition-opacity duration-700 font-mono text-xs pl-12">
      <div className="text-zinc-300 flex items-center gap-2"><FolderGit2 className="size-4 text-zinc-500" /> src/</div>
      <div className="text-zinc-500 flex items-center gap-2 pl-6"><FileCode2 className="size-3" /> main.ts</div>
      <div className="text-zinc-500 flex items-center gap-2 pl-6"><FileCode2 className="size-3" /> utils.ts</div>
      <div className="text-primary flex items-center gap-2 pl-6"><FileCode2 className="size-3" /> auth.ts</div>
      <div className="text-zinc-500 flex items-center gap-2 pl-6"><FileCode2 className="size-3" /> db.ts</div>
    </div>,
    // 2: Relationships
    <div key="2" className="flex flex-col items-center justify-center h-full gap-8 opacity-100 transition-opacity duration-700 font-mono text-xs">
      <div className="flex gap-16">
        <div className="p-3 border border-[#222] bg-[#050505] rounded">api/routes.ts</div>
        <div className="p-3 border border-primary/50 bg-primary/10 text-primary rounded">auth/session.ts</div>
      </div>
      <div className="flex gap-16 text-zinc-600">
        <Network className="size-4" />
        <Network className="size-4 text-primary" />
      </div>
      <div className="p-3 border border-[#222] bg-[#050505] rounded text-zinc-500">database/client.ts</div>
    </div>,
    // 3: Context
    <div key="3" className="flex flex-col justify-center h-full p-8 opacity-100 transition-opacity duration-700">
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Synthesized Context</div>
      <div className="p-6 border border-[#222] bg-[#050505] font-sans text-sm text-zinc-300 leading-relaxed">
        Prosno analyzes the AST, extracts function signatures, maps cross-file imports, and builds an embedded semantic graph of how <span className="text-primary font-mono text-xs">auth.ts</span> interacts with your API routes.
      </div>
    </div>
  ];

  return (
    <div ref={containerRef} className="relative w-full h-[300vh]">
      <div className="sticky top-0 w-full h-screen flex items-center">
        
        <div className="w-full max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          
          {/* Left: Sticky Copy */}
          <div className="space-y-6">
            <h2 className="font-heading text-4xl sm:text-5xl font-medium tracking-tight text-zinc-100 leading-[1.1]">
              THE CODEBASE <br />
              <span className="text-zinc-500">IS THE CONTEXT.</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
              Prosno maps your repository before answering your question. It understands dependencies, not just keywords.
            </p>
          </div>

          {/* Right: Transforming Visualization */}
          <div className="h-[400px] border border-[#222] bg-[#0a0a0a] shadow-2xl relative overflow-hidden">
            {visualizations.map((viz, idx) => (
              <div 
                key={idx} 
                className={`absolute inset-0 transition-all duration-1000 ease-in-out
                  ${activeIdx === idx ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0"}
                `}
              >
                {viz}
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
