"use client";

import { useEffect, useRef, useState } from "react";
import { FileCode2, ArrowDown } from "lucide-react";

export function TransformationViz() {
  const [activePhase, setActivePhase] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const progress = 1 - (rect.bottom / (window.innerHeight + rect.height));
      
      let phase = 0;
      if (progress > 0.2) phase = 1;
      if (progress > 0.5) phase = 2;
      if (progress > 0.8) phase = 3;
      
      setActivePhase(Math.max(0, Math.min(3, phase)));
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-lg mx-auto py-32 font-mono text-sm">
      
      {/* 0. CODE */}
      <div className={`transition-all duration-700 ${activePhase >= 0 ? "opacity-100" : "opacity-0 translate-y-4"}`}>
        <div className="text-zinc-600 mb-2 border-b border-[#222] pb-2">CODE</div>
        <div className="space-y-2 text-zinc-400">
          <div className="flex items-center gap-2"><FileCode2 className="size-3.5" /> session.ts</div>
          <div className="flex items-center gap-2"><FileCode2 className="size-3.5" /> middleware.ts</div>
          <div className="flex items-center gap-2"><FileCode2 className="size-3.5" /> client.ts</div>
        </div>
      </div>

      <div className={`my-8 flex justify-center transition-all duration-700 ${activePhase >= 1 ? "opacity-100" : "opacity-0"}`}>
        <ArrowDown className="size-4 text-zinc-700 animate-pulse" />
      </div>

      {/* 1. CONTEXT */}
      <div className={`transition-all duration-700 ${activePhase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <div className="text-zinc-600 mb-2 border-b border-[#222] pb-2">CONTEXT</div>
        <div className="text-primary bg-primary/10 border border-primary/20 p-3 rounded text-xs">
          3 relevant sources isolated
        </div>
      </div>

      <div className={`my-8 flex justify-center transition-all duration-700 ${activePhase >= 2 ? "opacity-100" : "opacity-0"}`}>
        <ArrowDown className="size-4 text-zinc-700 animate-pulse" />
      </div>

      {/* 2. ANSWER */}
      <div className={`transition-all duration-700 ${activePhase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <div className="text-zinc-600 mb-2 border-b border-[#222] pb-2">ANSWER</div>
        <div className="text-zinc-200 font-sans p-4 border border-[#222] bg-[#050505] rounded leading-relaxed">
          Token refresh isn&apos;t propagated to checkout client.
        </div>
      </div>

      <div className={`my-8 flex justify-center transition-all duration-700 ${activePhase >= 3 ? "opacity-100" : "opacity-0"}`}>
        <ArrowDown className="size-4 text-zinc-700 animate-pulse" />
      </div>

      {/* 3. EVIDENCE */}
      <div className={`transition-all duration-700 ${activePhase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <div className="text-zinc-600 mb-2 border-b border-[#222] pb-2">EVIDENCE</div>
        <div className="text-zinc-400 bg-[#050505] border border-[#222] p-3 rounded text-xs flex items-center justify-between">
          <span>client.ts:84</span>
          <span className="text-primary">[View source]</span>
        </div>
      </div>

    </div>
  );
}
