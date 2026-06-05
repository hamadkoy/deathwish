"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function finishLogin() {
      await supabase.auth.getSession();

      const savedPage = localStorage.getItem("redirectAfterLogin");

      if (savedPage) {
        localStorage.removeItem("redirectAfterLogin");
        router.replace(savedPage);
      } else {
        router.replace("/");
      }
    }

    finishLogin();
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050008",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      Logging you in...
    </div>
  );
}