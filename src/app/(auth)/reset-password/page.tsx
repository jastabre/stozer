"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@/lib/supabase/browser";
import {
  resetPasswordSchema,
  newPasswordSchema,
  type ResetPasswordInput,
  type NewPasswordInput,
} from "@/schemas/auth";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(data: ResetPasswordInput) {
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      data.email,
      {
        redirectTo: `${window.location.origin}/login`,
      }
    );

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">Email poslat</h1>
          <p className="text-muted-foreground">
            Poslali smo vam link za resetovanje lozinke. Proverite svoje
            sanduče.
          </p>
          <a
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Nazad na prijavu
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Resetovanje lozinke</h1>
          <p className="mt-2 text-muted-foreground">
            Unesite svoju email adresu i poslaćemo vam link za resetovanje
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="vas@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
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
            {loading ? "Šalje se..." : "Pošalji link"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className="text-primary hover:underline">
            Nazad na prijavu
          </a>
        </p>
      </div>
    </div>
  );
}
