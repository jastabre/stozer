import type { Metadata } from "next";
import { I18nProvider } from "@/components/providers/I18nProvider";

export const metadata: Metadata = {
  title: "STOŽER — Auth",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col">
        {children}
      </div>
    </I18nProvider>
  );
}
