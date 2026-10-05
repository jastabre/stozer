import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ToastProvider } from "@/components/ui/Toast";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "STOŽER — Sports Club Management",
  description: "Professional SaaS platform for managing sports clubs.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Resolve messages through the request config (src/i18n/request.ts) so the
  // client provider always receives the locale's own messages. This is the
  // canonical path the server-side getTranslations() calls use.
  const messages = await getMessages();
  const t = await getTranslations("common");

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* App-level, above every page and drawer: feedback toasts survive
          local component unmounts and client navigations. */}
      <ToastProvider dismissLabel={t("close")}>{children}</ToastProvider>
    </NextIntlClientProvider>
  );
}
