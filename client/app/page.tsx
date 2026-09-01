"use client";

import Link from "next/link";
import { ArrowRight, ArrowDown } from "lucide-react";
import { getGithubLoginUrl } from "@/lib/api";

import { HeroInteractive } from "@/components/landing/hero-interactive";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { DependencySection } from "@/components/landing/dependency-section";
import { CitationInteraction } from "@/components/landing/citation-interaction";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-primary/30">
      {/* 1. TOP NAVIGATION */}
      <header className="flex h-16 items-center justify-between px-6 border-b border-[#222]">
        <Link href="/" aria-label="prosno home" className="font-mono text-zinc-100 font-bold tracking-tight">
          PROSNO
        </Link>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-sans font-medium text-zinc-500">
          <Link href="#how-it-works" className="hover:text-zinc-200 transition-colors">How it works</Link>
        </nav>

        <div className="flex items-center gap-6">
          <Link href="/login" className="hidden sm:inline-flex text-sm font-sans font-medium text-zinc-500 hover:text-zinc-200 transition-colors">
            Sign in
          </Link>
          <a
            href={getGithubLoginUrl()}
            className="group flex items-center gap-2 text-sm font-sans font-medium text-zinc-100 hover:text-primary transition-colors"
          >
            Connect GitHub <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </header>

      <main>
        {/* 2. HERO LAYOUT */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 min-h-[90vh] flex flex-col justify-center relative">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            
            {/* LEFT SIDE: Editorial Headline */}
            <div className="lg:col-span-5 space-y-10 relative z-10">
              <div>
                <p className="text-primary text-xs font-mono tracking-widest uppercase mb-4">Code Intelligence</p>
                <h1 className="font-heading text-5xl sm:text-6xl md:text-[5rem] font-medium tracking-tight text-zinc-100 leading-[1.05]">
                  Turn your<br/>
                  repository into<br/>
                  answers.
                </h1>
              </div>
              
              <div className="space-y-8">
                <p className="text-xl text-zinc-400 max-w-md leading-relaxed font-light">
                  Prosno builds a semantic graph of your codebase. Ask questions, retrieve context, and verify answers directly against the source code.
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <a
                    href={getGithubLoginUrl()}
                    className="group inline-flex h-12 items-center justify-center bg-zinc-100 text-[#050505] px-6 font-sans font-medium text-sm transition-all hover:bg-white"
                  >
                    Connect GitHub <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </a>
                  <a href="#how-it-works" className="text-sm font-sans font-medium text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-2">
                    See how it works <ArrowDown className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Product Visualization */}
            <div className="lg:col-span-7 relative group">
              <div className="relative">
                <HeroInteractive />
              </div>
            </div>

          </div>
        </section>

        {/* 7 & 8. SECOND SECTION — HOW PROSNO WORKS */}
        <section id="how-it-works" className="border-t border-[#111]">
          <WorkflowSection />
        </section>

        {/* 9 & 10. THIRD SECTION — CODEBASE UNDERSTANDING */}
        <section className="border-t border-[#111]">
          <DependencySection />
        </section>

        {/* 11. CITATION INTERACTION SECTION */}
        <section className="mx-auto w-full max-w-7xl px-6 py-32 border-t border-[#111]">
          <CitationInteraction />
        </section>

        {/* 12. FINAL CTA */}
        <section className="mx-auto w-full max-w-7xl px-6 py-40 border-t border-[#111]">
          <div className="max-w-3xl space-y-8 relative">
            <h2 className="font-heading text-5xl sm:text-6xl font-medium tracking-tight text-zinc-100 leading-[1.05]">
              YOUR CODEBASE<br/>
              IS WAITING.
            </h2>
            <p className="text-lg text-zinc-400 font-sans max-w-md leading-relaxed">
              Connect a repository.<br/>
              Ask your first question.
            </p>
            
            <div className="pt-8 relative z-10">
              <a
                href={getGithubLoginUrl()}
                className="group inline-flex h-12 items-center justify-center bg-[#111] border border-[#333] text-zinc-100 px-8 font-sans font-medium text-sm transition-all hover:border-primary hover:text-primary"
              >
                Connect GitHub <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            {/* Subtle Background Signal */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none hidden md:block">
               <div className="font-mono text-[7rem] leading-none font-bold tracking-tighter" style={{ WebkitTextStroke: "1px #fff", color: "transparent" }}>
                 CODE &rarr;<br/>
                 CONTEXT &rarr;<br/>
                 ANSWER
               </div>
            </div>
          </div>
        </section>

      </main>

      {/* 13. FOOTER */}
      <footer className="border-t border-[#111] bg-[#000000]">
        <div className="mx-auto w-full max-w-7xl px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6 text-sm font-sans font-medium text-zinc-500">
          <Link href="/" className="text-zinc-100 font-bold tracking-tight hover:opacity-80 transition-opacity">
            PROSNO
          </Link>
          <div className="flex flex-wrap gap-6 justify-center">
            <Link href="#how-it-works" className="hover:text-zinc-300 transition-colors">How it works</Link>
          </div>
          <div>
             <a href="https://github.com/swarajchattaraj/prosno" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
