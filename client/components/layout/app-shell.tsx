"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

import { Logo } from "@/components/ui/logo";

import { ModeToggle } from "@/components/ui/mode-toggle";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { dashboardNavGroups, isDashboardNavActive } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  title,
  description,
  actions,
  hideHeader = false,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  hideHeader?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon" className="border-r border-border dark:border-white/10 bg-background dark:bg-[#0a0a0a] text-foreground/90 dark:text-neutral-300">
        <SidebarHeader className="border-b border-border dark:border-white/10 pb-4 pt-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/dashboard" />}
                tooltip="prosno"
                className="hover:bg-black/5 dark:bg-white/5 data-[state=open]:bg-black/5 dark:bg-white/5"
              >
                <Logo className="size-8 rounded-sm" />
                <div className="grid flex-1 text-left text-sm leading-tight font-mono">
                  <span className="truncate font-medium text-foreground dark:text-neutral-200">prosno-workspace</span>
                  <span className="truncate text-xs text-muted-foreground/80 dark:text-neutral-500">
                    ~/projects/chat
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="pt-2 font-mono text-sm">
          {dashboardNavGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs text-muted-foreground/80 dark:text-neutral-500 uppercase tracking-wider">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isDashboardNavActive(pathname, item.href, item.exact);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.title}
                          render={<Link href={item.href} />}
                          className={cn(
                            "rounded-none border-l-2 hover:bg-black/5 dark:bg-white/5 transition-colors",
                            active 
                              ? "border-primary dark:border-amber-500 text-primary dark:text-amber-500 bg-primary/10 dark:bg-amber-500/10" 
                              : "border-transparent text-muted-foreground dark:text-neutral-400"
                          )}
                        >
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-border dark:border-white/10 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="hover:bg-black/5 dark:bg-white/5 data-[state=open]:bg-black/5 dark:bg-white/5 rounded-sm"
                    />
                  }
                >
                  <Avatar className="size-8 rounded-sm border border-border dark:border-white/10">
                    <AvatarImage
                      src={user?.avatarUrl ?? undefined}
                      alt={user?.displayName}
                    />
                    <AvatarFallback className="rounded-sm bg-neutral-800 text-foreground/90 dark:text-neutral-300 font-mono text-xs">
                      {(user?.displayName ?? "DP").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight font-mono">
                    <span className="truncate font-medium text-foreground dark:text-neutral-200">
                      {user?.displayName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground/80 dark:text-neutral-500">
                      @{user?.githubUsername}
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="min-w-56 rounded-sm border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] text-foreground/90 dark:text-neutral-300 font-mono"
                  side="top"
                  align="start"
                  sideOffset={8}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal text-muted-foreground dark:text-neutral-400">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-foreground dark:text-neutral-200">
                          {user?.displayName}
                        </span>
                        <span className="text-xs">
                          Connected via GitHub
                        </span>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-black/10 dark:bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings")}
                    className="focus:bg-black/5 dark:bg-white/5 focus:text-foreground dark:text-neutral-200 cursor-pointer"
                  >
                    <Settings className="size-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/10 dark:bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                    className="focus:bg-black/5 dark:bg-white/5 focus:text-red-400 cursor-pointer text-red-500/80"
                  >
                    <LogOut className="size-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background dark:bg-[#0a0a0a]">
        {!hideHeader && (
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border dark:border-white/10 bg-background dark:bg-[#0a0a0a] px-4">
            <SidebarTrigger className="-ml-1 text-muted-foreground dark:text-neutral-400 hover:text-foreground dark:text-neutral-200" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-black/10 dark:bg-white/10" />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="min-w-0">
                {title && (
                  <h1 className="truncate font-mono text-sm font-medium text-foreground dark:text-neutral-200">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="truncate text-xs font-mono text-muted-foreground/80 dark:text-neutral-500">
                    {description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {actions}
                <ModeToggle />
              </div>
            </div>
          </header>
        )}
        <div className="flex flex-1 flex-col bg-background dark:bg-[#0a0a0a] text-foreground/90 dark:text-neutral-300">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 font-mono font-medium tracking-tight text-foreground dark:text-neutral-200",
        className,
      )}
    >
      <Logo className="size-8 rounded-sm" />
      <span className="text-[1.05rem] leading-none">prosno</span>
    </div>
  );
}

export function GhostButtonLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      className={cn("hover:bg-black/5 dark:bg-white/5 text-muted-foreground dark:text-neutral-400 hover:text-foreground dark:text-neutral-200 font-mono rounded-sm", className)}
      render={<Link href={href} />}
    >
      {children}
    </Button>
  );
}
