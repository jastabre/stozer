"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    // Exchange the auth code from the URL for a session. /sr is safe for both
    // flows: an invited user already has organization claims and lands in the
    // club; a fresh signup without claims is redirected to onboarding by the
    // middleware.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.push("/sr");
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
