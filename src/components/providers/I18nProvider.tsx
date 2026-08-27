"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    // Detect locale from URL path
    const path = window.location.pathname;
    const locale = path.startsWith("/en") ? "en" : "sr";

    import(`../../../messages/${locale}.json`).then((mod) => {
      setMessages(mod.default);
    });
  }, []);

  if (!messages) {
    return <div className="flex flex-1 items-center justify-center"><span className="text-muted-foreground">Loading...</span></div>;
  }

  const path = window.location.pathname;
  const locale = path.startsWith("/en") ? "en" : "sr";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
