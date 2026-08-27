"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, type OnboardingInput } from "@/schemas/onboarding";
import { createOrganization } from "./actions";

const SPORTS = [
  { value: "football", label: "Fudbal" },
  { value: "basketball", label: "Košarka" },
];

const COUNTRIES = [
  { value: "RS", label: "Srbija" },
  { value: "BA", label: "Bosna i Hercegovina" },
  { value: "HR", label: "Hrvatska" },
  { value: "ME", label: "Crna Gora" },
  { value: "MK", label: "Severna Makedonija" },
  { value: "SI", label: "Slovenija" },
  { value: "DE", label: "Nemačka" },
];

export default function OnboardingPage() {
  const router = useRouter();
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
      currency: "RSD",
      timezone: "Europe/Belgrade",
    } as OnboardingInput,
  });

  async function onSubmit(data: OnboardingInput) {
    setLoading(true);
    setError(null);

    try {
      await createOrganization(data);
      router.push("/sr/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Došlo je do greške"
      );
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30">
      <div className="w-full max-w-lg space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Dobrodošli u STOŽER</h1>
          <p className="mt-2 text-muted-foreground">
            Podesite svoj klub za nekoliko koraka
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-xl bg-card p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="club_name"
              className="block text-sm font-medium mb-1"
            >
              Ime kluba
            </label>
            <input
              id="club_name"
              type="text"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="npr. FK Partizan"
              {...register("club_name")}
            />
            {errors.club_name && (
              <p className="mt-1 text-sm text-destructive">
                {errors.club_name.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="sport"
              className="block text-sm font-medium mb-1"
            >
              Sport
            </label>
            <select
              id="sport"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("sport")}
            >
              {SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.sport && (
              <p className="mt-1 text-sm text-destructive">
                {errors.sport.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="country"
              className="block text-sm font-medium mb-1"
            >
              Država
            </label>
            <select
              id="country"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("country")}
            >
              <option value="">Izaberite državu</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="mt-1 text-sm text-destructive">
                {errors.country.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="language"
              className="block text-sm font-medium mb-1"
            >
              Jezik
            </label>
            <select
              id="language"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("language")}
            >
              <option value="sr">Srpski</option>
              <option value="en">English</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Kreiranje kluba..." : "Kreiraj klub"}
          </button>
        </form>
      </div>
    </div>
  );
}
