"use client";

import { useEffect, useRef, useState } from "react";
import { Network, Search, FileCode2, Terminal, CheckCircle2 } from "lucide-react";

export function WorkflowSection() {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || !stickyRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const stickyRect = stickyRef.current.getBoundingClientRect();
      
      // top-24 is 96px
      const stickyTop = 96;
      const scrollableDistance = containerRect.height - stickyRect.height;
      
      if (scrollableDistance <= 0) return;
      
      const scrolled = stickyTop - containerRect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableDistance));
      
      let step = 0;
      if (progress > 0.16) step = 1;
      if (progress > 0.33) step = 2;
      if (progress > 0.50) step = 3;
      if (progress > 0.66) step = 4;
      if (progress > 0.83) step = 5;
      
      setActiveStep(step);
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const steps = [
    { num: "01", title: "CONNECT", desc: "Attach your repository" },
    { num: "02", title: "UNDERSTAND", desc: "Prosno builds a semantic graph" },
    { num: "03", title: "ASK", desc: "Query your codebase" },
    { num: "04", title: "RETRIEVE", desc: "Locate relevant context" },
    { num: "05", title: "ANSWER", desc: "Synthesize the solution" },
    { num: "06", title: "VERIFY", desc: "Trace back to source" }
  ];

  const visualizations = [
    // 01 CONNECT
    <div key="0" className="w-full h-full flex flex-col items-center justify-center p-6">
       <div className="text-center font-mono text-zinc-500 text-xs">
         <Terminal className="size-8 mx-auto mb-4 text-zinc-600" />
         git clone acme/e-commerce
       </div>
    </div>,
    // 02 UNDERSTAND
    <div key="1" className="w-full h-full relative p-8 flex items-center justify-center min-h-[250px]">
       <Network className="size-16 text-zinc-700 md:animate-pulse" />
       <div className="absolute top-1/4 left-1/4 px-2 py-1 bg-[#111] border border-[#222] rounded text-[10px] font-mono text-zinc-400">client.ts</div>
       <div className="absolute bottom-1/4 right-1/4 px-2 py-1 bg-[#111] border border-[#222] rounded text-[10px] font-mono text-zinc-400">auth.ts</div>
       <div className="absolute top-1/3 right-1/3 px-2 py-1 bg-[#111] border border-[#222] rounded text-[10px] font-mono text-zinc-400">middleware.ts</div>
    </div>,
    // 03 ASK
    <div key="2" className="w-full h-full flex flex-col items-center justify-center p-6 min-h-[200px]">
       <div className="w-full max-w-sm p-4 bg-[#111] border border-[#222] rounded-sm font-mono text-xs sm:text-sm text-zinc-300 flex items-center gap-3 shadow-2xl">
         <Search className="size-4 text-primary shrink-0" />
         <span className="truncate">Why does checkout fail?</span>
         <span className="w-1.5 h-4 bg-primary animate-pulse shrink-0" />
       </div>
    </div>,
    // 04 RETRIEVE
    <div key="3" className="w-full h-full flex flex-col items-center justify-center p-6 min-h-[200px]">
       <div className="space-y-3 font-mono text-xs w-full max-w-sm">
         <div className="text-zinc-500 mb-4 uppercase tracking-widest text-[10px]">Context Retrieved</div>
         <div className="p-3 bg-primary/10 border border-primary/20 text-primary rounded-sm flex items-center gap-2">
           <FileCode2 className="size-3.5" /> client.ts (100%)
         </div>
         <div className="p-3 bg-[#111] border border-[#222] text-zinc-400 rounded-sm flex items-center gap-2 opacity-70">
           <FileCode2 className="size-3.5" /> auth.ts (85%)
         </div>
       </div>
    </div>,
    // 05 ANSWER
    <div key="4" className="w-full h-full flex flex-col items-center justify-center p-6 min-h-[200px]">
       <div className="w-full max-w-sm p-6 bg-[#0a0a0a] border border-[#222] font-sans text-sm text-zinc-300 leading-relaxed shadow-2xl">
         <div className="text-primary mb-3"><CheckCircle2 className="size-5" /></div>
         Checkout fails because the refreshed token is not applied to the headers before the request is made.
       </div>
    </div>,
    // 06 VERIFY
    <div key="5" className="w-full h-full flex flex-col items-center justify-center p-6 min-h-[200px]">
       <div className="w-full max-w-sm p-4 bg-[#0a0a0a] border border-primary/30 font-mono text-[10px] text-zinc-400 shadow-[0_0_30px_rgba(var(--primary),0.05)]">
         <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#222]">
           <span className="text-zinc-300">client.ts</span>
           <span className="text-primary">L84</span>
         </div>
         <pre className="leading-loose overflow-x-auto">
           <code>83 </code><br/>
           <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">84 client.headers.Authorization = token</code><br/>
           <code>85 </code>
         </pre>
       </div>
    </div>
  ];

  return (
    <>
      {/* DESKTOP: Cinematic Sticky Scroll */}
      <div ref={containerRef} className="hidden md:block relative w-full h-[300vh] bg-[#000000]">
        <div ref={stickyRef} className="sticky top-24 w-full pb-24 flex items-center justify-center">
          <div className="w-full max-w-7xl mx-auto px-6 grid grid-cols-2 gap-16 items-start">
            
            {/* Left: Sticky narrative */}
            <div className="space-y-6">
              <p className="text-primary text-xs font-mono tracking-widest uppercase mb-4">How Prosno Works</p>
              <h2 className="font-heading text-4xl lg:text-5xl font-medium tracking-tight text-zinc-100 leading-[1.1]">
                From question <br />
                to answer <br />
                <span className="text-zinc-500">with evidence.</span>
              </h2>
              
              <div className="pt-12 font-mono text-sm relative">
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-[#222] z-0" />
                {steps.map((step, idx) => (
                  <div key={idx} className={`flex items-start gap-6 mb-8 relative z-10 transition-all duration-500 ${activeStep >= idx ? "opacity-100" : "opacity-30"}`}>
                    <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 transition-colors duration-500 ${activeStep >= idx ? "bg-primary text-[#050505]" : "bg-[#111] text-zinc-500"}`}>
                      <span className="text-[10px] font-bold">{step.num}</span>
                    </div>
                    <div>
                      <div className={`font-bold ${activeStep >= idx ? "text-zinc-200" : "text-zinc-500"}`}>{step.title}</div>
                      <div className="text-xs text-zinc-500 mt-1">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visualization State Machine */}
            <div className="h-[500px] border border-[#222] bg-[#050505] relative overflow-hidden flex items-center justify-center">
              {visualizations.map((viz, idx) => (
                <div key={idx} className={`absolute inset-0 transition-all duration-700 ease-in-out ${activeStep === idx ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 pointer-events-none z-0"}`}>
                  {viz}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE: Vertical Stacked Flow */}
      <div className="md:hidden w-full bg-[#000000] pt-24 pb-16 px-6 space-y-16">
        <div className="space-y-4 mb-16">
          <p className="text-primary text-xs font-mono tracking-widest uppercase">How Prosno Works</p>
          <h2 className="font-heading text-4xl font-medium tracking-tight text-zinc-100 leading-[1.1]">
            From question <br />
            to answer <br />
            <span className="text-zinc-500">with evidence.</span>
          </h2>
        </div>

        {steps.map((step, idx) => (
          <div key={idx} className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 bg-[#111] border border-[#222] text-zinc-300 font-mono">
                <span className="text-[10px] font-bold">{step.num}</span>
              </div>
              <div>
                <div className="font-bold text-zinc-200 font-mono text-sm">{step.title}</div>
                <div className="text-xs text-zinc-500 mt-1">{step.desc}</div>
              </div>
            </div>
            <div className="border border-[#222] bg-[#050505] rounded-sm overflow-hidden">
              {visualizations[idx]}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
