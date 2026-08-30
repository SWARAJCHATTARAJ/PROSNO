"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useCurrentUser } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, isFetched, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isFetched && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isFetched, pathname, router, user]);

  if (isLoading || !isFetched) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
