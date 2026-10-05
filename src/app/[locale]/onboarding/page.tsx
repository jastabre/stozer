"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { onboardingSchema, type OnboardingInput } from "@/schemas/onboarding";
import { useToast } from "@/components/ui/Toast";
import { safeFeedbackMessage } from "@/lib/feedback";
import { createOrganization } from "./actions";

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tf = useTranslations("feedback");
  const { success, error: toastError } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      sport: "football",
      language: "sr",
      timezone: "Europe/Belgrade",
    } as OnboardingInput,
  });

  async function onSubmit(data: OnboardingInput) {
    setLoading(true);
    setError(null);

    try {
      await createOrganization(data);
      success(tf("organizationCreated"));
      router.push("/sr");
      router.refresh();
    } catch (err) {
      setError(
        safeFeedbackMessage(
          err instanceof Error ? err.message : null,
          tf("actionFailed")
        )
      );
      toastError(tf("actionFailed"));
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30">
      <div className="w-full max-w-lg space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("welcome")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-xl bg-card p-6 shadow-sm"
        >
          <div>
            <label htmlFor="club_name" className="block text-sm font-medium mb-1">
              {t("clubName")}
            </label>
            <input
              id="club_name"
              type="text"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t("clubNamePlaceholder")}
              {...register("club_name")}
            />
            {errors.club_name && (
              <p className="mt-1 text-sm text-destructive">{errors.club_name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="sport" className="block text-sm font-medium mb-1">
              {t("sport")}
            </label>
            <select
              id="sport"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("sport")}
            >
              <option value="football">{t("sportFootball")}</option>
              <option value="basketball">{t("sportBasketball")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium mb-1">
              {t("country")}
            </label>
            <select
              id="country"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("country")}
            >
              <option value="">{t("countryPlaceholder")}</option>
              <option value="RS">{t("countryRS")}</option>
              <option value="BA">{t("countryBA")}</option>
              <option value="HR">{t("countryHR")}</option>
              <option value="ME">{t("countryME")}</option>
              <option value="MK">{t("countryMK")}</option>
              <option value="SI">{t("countrySI")}</option>
              <option value="DE">{t("countryDE")}</option>
            </select>
            {errors.country && (
              <p className="mt-1 text-sm text-destructive">{errors.country.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium mb-1">
              {t("language")}
            </label>
            <select
              id="language"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("language")}
            >
              <option value="sr">{t("languageSr")}</option>
              <option value="en">{t("languageEn")}</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? t("loading") : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
