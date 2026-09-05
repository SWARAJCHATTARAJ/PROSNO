"use client";


export function DependencySection() {
  return (
    <div className="w-full bg-[#050505] pt-16 pb-32">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-16 items-center">
        
        {/* Left: Copy */}
        <div className="lg:col-span-4 space-y-6">
          <p className="text-primary text-xs font-mono tracking-widest uppercase mb-4">See the whole picture</p>
          <h2 className="font-heading text-4xl sm:text-5xl font-medium tracking-tight text-zinc-100 leading-[1.1]">
            Understand <br/>
            complex <br/>
            codebases <br/>
            <span className="text-zinc-500">faster.</span>
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed font-light mt-6">
            Prosno maps the relationships inside your repository so you can focus on what matters.
          </p>
        </div>

        {/* Right: Visualization & Code */}
        <div className="lg:col-span-8 grid md:grid-cols-2 gap-8">
          
          {/* Repository Trace Map */}
          <div className="border border-[#222] bg-[#050505] p-6 h-[400px] flex flex-col relative shadow-xl overflow-hidden font-mono text-xs">
            <div className="text-zinc-600 mb-6 uppercase tracking-widest text-[10px]">Reference Trace</div>
            
            <div className="relative flex-1">
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-1.5 h-1.5 bg-[#333] rounded-full shrink-0" />
                <div className="text-zinc-500">src/api/routes.ts</div>
              </div>

              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-1.5 h-1.5 bg-[#333] rounded-full shrink-0" />
                <div className="text-zinc-500">src/auth/middleware.ts</div>
              </div>

              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.8)] shrink-0 animate-pulse" />
                <div className="text-zinc-200 bg-[#111] px-2 py-1 border border-[#222] rounded-sm flex items-center gap-2">
                  <span>src/auth/session.ts</span>
                  <span className="text-primary text-[10px]">exports SessionToken</span>
                </div>
              </div>

              <div className="flex items-center gap-4 relative z-10 ml-8">
                <div className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                <div className="text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-sm flex items-center gap-2">
                  <span>src/checkout/client.ts</span>
                  <span className="text-primary/70 text-[10px]">imports SessionToken</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-8 relative z-10 ml-8">
                <div className="w-1.5 h-1.5 bg-[#333] rounded-full shrink-0" />
                <div className="text-zinc-500">src/checkout/service.ts</div>
              </div>

              {/* Connecting Lines */}
              <div className="absolute left-[3px] top-[10px] bottom-[20px] w-px bg-[#222] z-0" />
              <div className="absolute left-[3px] top-[110px] w-8 h-px bg-primary/50 border-t border-dashed border-primary z-0 opacity-50" />
              <div className="absolute left-[3px] top-[110px] bottom-[70px] w-px bg-primary/30 z-0" />
              <div className="absolute left-[35px] top-[165px] bottom-[20px] w-px bg-[#222] z-0" />
            </div>
          </div>

          {/* Code Preview */}
          <div className="border border-[#222] bg-[#0a0a0a] h-[400px] flex flex-col shadow-xl">
             <div className="h-10 border-b border-[#222] bg-[#050505] flex items-center px-4 font-mono text-[11px] text-zinc-400">
               src/checkout/client.ts
             </div>
             <div className="flex-1 p-6 overflow-auto font-mono text-xs leading-relaxed text-zinc-500">
               <div className="flex gap-4">
                 <div className="text-zinc-700 select-none text-right w-4">82</div>
                 <div>const token = session.token</div>
               </div>
               <div className="flex gap-4 mt-2">
                 <div className="text-zinc-700 select-none text-right w-4">83</div>
                 <div></div>
               </div>
               <div className="flex gap-4 mt-2 relative">
                 <div className="absolute inset-y-0 -left-6 -right-6 bg-primary/5 border-l-2 border-primary pointer-events-none" />
                 <div className="text-primary select-none text-right w-4 relative z-10">84</div>
                 <div className="text-zinc-200 relative z-10">client.headers.Authorization = token</div>
               </div>
               <div className="flex gap-4 mt-2">
                 <div className="text-zinc-700 select-none text-right w-4">85</div>
                 <div></div>
               </div>
               <div className="flex gap-4 mt-2">
                 <div className="text-zinc-700 select-none text-right w-4">86</div>
                 <div>return client.request()</div>
               </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
