"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user && pathname !== "/login") {
        router.push("/login");
        return;
      }

      setChecking(false);
    }

    checkUser();
  }, [pathname, router]);

  if (checking && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}