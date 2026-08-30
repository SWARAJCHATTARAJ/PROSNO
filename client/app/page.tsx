import Link from "next/link";
import {
  ArrowRight,
  Braces,
  ChevronRight,
  FileCode2,
  FolderGit2,
  MessageSquareCode,
  Search,
  Sparkles,
} from "lucide-react";

import { GitHubIcon } from "@/components/icons/github-icon";
import { BrandMark } from "@/components/layout/app-shell";
import { getGithubLoginUrl } from "@/lib/api";

const features = [
  {
    icon: FolderGit2,
    title: "Connect in seconds",
    description:
      "Secure GitHub OAuth gives you access to the repositories you already work in.",
  },
  {
    icon: Sparkles,
    title: "Context that stays grounded",
    description:
      "Your code is indexed into meaningful chunks so every answer has real context.",
  },
  {
    icon: MessageSquareCode,
    title: "Answers you can verify",
    description:
      "Follow inline citations straight to the files and lines behind every response.",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background dark:bg-[#0a0a0a] text-foreground/90 dark:text-neutral-300 font-sans selection:bg-primary/30 dark:selection:bg-amber-500/30">
      <header className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between px-5 sm:px-6 border-b border-border dark:border-white/10">
        <Link href="/" aria-label="prosno home" className="hover:opacity-80 transition-opacity">
          <BrandMark />
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-xs font-mono text-muted-foreground dark:text-neutral-400 hover:text-foreground dark:text-neutral-200 transition-colors"
          >
            [ Sign in ]
          </Link>
          <a
            href={getGithubLoginUrl()}
            className="rounded-sm bg-primary dark:bg-amber-500 text-primary-foreground dark:text-[#0a0a0a] px-4 py-2 font-mono text-xs  transition-colors hover:bg-primary/90 dark:hover:bg-amber-400 inline-flex items-center gap-2"
          >
            init
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-16 pt-14 text-center sm:px-6 sm:pt-20 lg:pb-24 lg:pt-24 border-b border-border dark:border-white/10">
          <a
            href="#how-it-works"
            className="group mb-7 inline-flex items-center gap-2 rounded-sm border border-primary dark:border-amber-500/20 bg-primary/10 dark:bg-amber-500/10 px-3 py-1.5 text-xs font-mono text-primary dark:text-amber-500 transition-colors hover:bg-primary/20 dark:bg-amber-500/20"
          >
            <Sparkles className="size-3.5" />
            AI context for every repository
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>

          <h1 className="max-w-4xl font-heading text-4xl font-medium tracking-tight text-foreground dark:text-neutral-100 sm:text-6xl sm:leading-[1.05] lg:text-7xl">
            Understand  codebases,
            <span className="block text-primary dark:text-amber-500 mt-2">without the treasure hunt.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-7 text-muted-foreground dark:text-neutral-400 sm:text-lg sm:leading-8">
            prosno turns repositories into a searchable source of truth. Ask
            natural questions, get precise answers, and jump straight to the
            code that matters.
          </p>

          <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <a
              href={getGithubLoginUrl()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-neutral-200 text-neutral-900 px-6 font-mono text-sm font-semibold transition-colors hover:bg-white"
            >
              <GitHubIcon className="size-4" />
              Continue with GitHub
              <ArrowRight className="size-4" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] px-6 font-mono text-sm text-foreground/90 dark:text-neutral-300 transition-colors hover:bg-black/5 dark:bg-white/5 hover:border-border dark:border-white/20"
            >
              cat --help
            </a>
          </div>

          <div className="relative mt-16 w-full max-w-5xl sm:mt-24">
            <div className="overflow-hidden rounded-sm border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] text-left shadow-none">
              <div className="flex h-10 items-center justify-between border-b border-border dark:border-white/10 bg-background dark:bg-[#0a0a0a] px-4">
                <div className="flex gap-2">
                  <span className="size-3 rounded-sm border border-border dark:border-white/10 bg-black/5 dark:bg-white/5" />
                  <span className="size-3 rounded-sm border border-border dark:border-white/10 bg-black/5 dark:bg-white/5" />
                  <span className="size-3 rounded-sm border border-border dark:border-white/10 bg-black/5 dark:bg-white/5" />
                </div>
                <div className="flex items-center gap-2 rounded-sm border border-border dark:border-white/10 bg-muted/50 dark:bg-[#141414] px-3 py-1 font-mono text-[10px] text-muted-foreground dark:text-neutral-400">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  acme / storefront
                </div>
                <div className="w-16" />
              </div>
              <div className="flex min-h-96">
                <div className="hidden w-48 border-r border-border dark:border-white/10 bg-background dark:bg-[#0a0a0a] p-3 md:block">
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground dark:text-neutral-400 mb-4">
                    <Search className="size-3" /> Search...
                  </div>
                  <div className="space-y-2 font-mono text-[10px] text-muted-foreground/80 dark:text-neutral-500">
                    <div className="flex items-center gap-2 text-primary dark:text-amber-500"><FolderGit2 className="size-3" /> src</div>
                    <div className="flex items-center gap-2 pl-4"><FileCode2 className="size-3" /> auth.ts</div>
                    <div className="flex items-center gap-2 pl-4"><FileCode2 className="size-3" /> utils.ts</div>
                    <div className="flex items-center gap-2"><FolderGit2 className="size-3" /> tests</div>
                  </div>
                </div>
                <div className="flex-1 p-6 flex flex-col gap-6 bg-muted/30 dark:bg-[#0f0f0f]">
                  <div className="font-mono text-sm text-foreground/90 dark:text-neutral-300">
                    <span className="text-primary dark:text-amber-500">&gt;</span> Explain the authentication flow in this repo.
                  </div>
                  <div className="rounded-sm border border-border dark:border-white/10 bg-muted/50 dark:bg-[#141414] p-5 font-sans text-sm text-foreground/90 dark:text-neutral-300 leading-relaxed shadow-none">
                    <p>
                      Authentication is handled primarily in <span className="font-mono text-primary dark:text-amber-500 text-xs">src/auth.ts</span> using next-auth. 
                      The system uses a JWT strategy combined with GitHub OAuth providers.
                    </p>
                    <div className="mt-4 flex items-center gap-2 font-mono text-xs text-muted-foreground/80 dark:text-neutral-500">
                      <Braces className="size-3.5" /> Cited 3 files
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f]">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
            <div className="mx-auto mb-12 max-w-xl text-center">
              <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-primary dark:text-amber-500 uppercase">
                Built for flow
              </p>
              <h2 className="mt-4 font-heading text-3xl font-medium tracking-tight text-foreground dark:text-neutral-100 sm:text-4xl">
                Your fastest path to understanding.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {features.map((feature, index) => (
                <article
                  key={feature.title}
                  className="group relative overflow-hidden rounded-sm border border-border dark:border-white/10 bg-background dark:bg-[#0a0a0a] p-8 transition-colors hover:border-border dark:border-white/20 hover:bg-muted/40 dark:bg-[#121212]"
                >
                  <span className="absolute right-6 top-6 font-mono text-5xl font-bold leading-none text-white/[0.02]">
                    0{index + 1}
                  </span>
                  <div className="relative flex size-10 items-center justify-center rounded-sm bg-primary/10 dark:bg-amber-500/10 text-primary dark:text-amber-500 border border-primary dark:border-amber-500/20">
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="relative mt-6 font-mono text-sm font-medium text-foreground dark:text-neutral-200">
                    {feature.title}
                  </h3>
                  <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground dark:text-neutral-400">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
          <div className="relative overflow-hidden rounded-sm border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] px-6 py-12 text-foreground/90 dark:text-neutral-300 sm:px-12 sm:py-16">
            <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-xl">
                <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-primary dark:text-amber-500 uppercase">
                  Ready when you are
                </p>
                <h2 className="mt-4 font-heading text-3xl font-medium tracking-tight text-foreground dark:text-neutral-100 sm:text-4xl">
                  Make every repository easier to navigate.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground dark:text-neutral-400 sm:text-base">
                  Connect your GitHub account and get answers with the source
                  code attached.
                </p>
              </div>
              <a
                href={getGithubLoginUrl()}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-sm bg-primary dark:bg-amber-500 text-primary-foreground dark:text-[#0a0a0a] px-6 font-mono text-sm  transition-colors hover:bg-primary/90 dark:hover:bg-amber-400"
              >
                ./install.sh
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-8 text-xs font-mono text-muted-foreground/80 dark:text-neutral-500 sm:px-6 border-t border-border dark:border-white/10 pt-8 mt-12 bg-background dark:bg-[#0a0a0a]">
        <BrandMark className="scale-90 origin-left opacity-80" />
        <span>EOF</span>
      </footer>
    </div>
  );
}
