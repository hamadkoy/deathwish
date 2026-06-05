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
      const user = data.user;

      if (!user && pathname !== "/login") {
        router.push("/login");
        return;
      }

      if (user) {
        console.log("AUTH USER:", user);
        console.log("USER METADATA:", user.user_metadata);
        console.log("IDENTITIES:", user.identities);

        const discordIdentity = user.identities?.find(
          (i: any) => i.provider === "discord"
        );

        const discordId =
          discordIdentity?.id ||
          discordIdentity?.identity_data?.provider_id ||
          discordIdentity?.identity_data?.sub ||
          user.user_metadata?.provider_id ||
          user.user_metadata?.sub;

        console.log("DISCORD ID FOUND:", discordId);

        if (discordId) {
          const { error } = await supabase
            .from("profiles")
            .update({
              discord_id: String(discordId),
              discord_name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.user_metadata?.preferred_username ||
                "Unknown",
              avatar_url: user.user_metadata?.avatar_url || "",
            })
            .eq("user_id", user.id);

          if (error) {
            console.error("FAILED TO SAVE DISCORD ID:", error);
          }
        }
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