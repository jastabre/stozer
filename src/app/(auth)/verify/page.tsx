"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    // Exchange the auth code from the URL for a session
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.push("/sr/onboarding");
      }
    });
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Verifikacija naloga</h1>
        <p className="mt-2 text-muted-foreground">
          Molimo sačekajte...
        </p>
      </div>
    </div>
  );
}
