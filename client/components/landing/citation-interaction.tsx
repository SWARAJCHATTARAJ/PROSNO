"use client";

import { useState, useRef, useEffect } from "react";
import { Terminal } from "lucide-react";

export function CitationInteraction() {
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHovered(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto border border-[#222] bg-[#0a0a0a] overflow-hidden flex flex-col md:flex-row">
      
      {/* Left: Answer & Citation */}
      <div className="flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r border-[#222] flex flex-col justify-center relative">
        <h3 className="font-heading text-2xl text-zinc-100 mb-6">ASK THE CODE.</h3>
        
        <div className="flex items-start gap-3 mb-6">
          <Terminal className="size-4 text-zinc-500 mt-1 shrink-0" />
          <div className="text-zinc-300 font-mono text-sm">
            Why does checkout return 401?
          </div>
        </div>

        <div className="bg-[#050505] border border-[#222] p-6 text-sm text-zinc-300 leading-relaxed font-sans">
          The refreshed token is created correctly, but the checkout client continues using the previous session token.
          
          <div className="mt-6 pt-6 border-t border-[#222]">
            <button
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onClick={() => setHovered(h => !h)}
              onFocus={() => setHovered(true)}
              onBlur={() => setHovered(false)}
              aria-expanded={hovered}
              className={`font-mono text-xs px-2 py-1 rounded transition-colors duration-300 border focus:outline-none focus:ring-1 focus:ring-primary
                ${hovered ? "bg-primary/10 border-primary/30 text-primary" : "bg-transparent border-[#333] text-zinc-500"}
              `}
            >
              [checkout/client.ts:84]
            </button>
          </div>
        </div>
      </div>

      {/* Right: Source Code Reveal */}
      <div className="flex-1 bg-[#050505] p-8 md:p-12 relative flex flex-col justify-center font-mono text-[10px] sm:text-xs">
        <div className="text-zinc-600 mb-4 border-b border-[#222] pb-2">checkout/client.ts</div>
        
        <div className="space-y-1 text-zinc-500">
          <div className="flex"><span className="w-6 text-zinc-700 select-none">82</span> <span>const token = session.token</span></div>
          <div className="flex"><span className="w-6 text-zinc-700 select-none">83</span> <span></span></div>
          
          <div className={`flex relative transition-all duration-500 overflow-hidden rounded
            ${hovered ? "bg-primary/10 text-primary" : ""}
          `}>
            {hovered && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
            <span className={`w-6 select-none ${hovered ? "text-primary/50" : "text-zinc-700"}`}>84</span> 
            <span>client.headers.Authorization = token</span>
          </div>
          
          <div className="flex"><span className="w-6 text-zinc-700 select-none">85</span> <span></span></div>
          <div className="flex"><span className="w-6 text-zinc-700 select-none">86</span> <span>return client.request()</span></div>
        </div>
      </div>

    </div>
  );
}
