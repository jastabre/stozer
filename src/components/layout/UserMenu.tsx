"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/browser";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const router = useRouter();
  const t = useTranslations("navigation");

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
    >
      <LogOut className="h-5 w-5" />
      {t("logout")}
    </button>
  );
}
