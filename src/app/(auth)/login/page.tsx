"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@/lib/supabase/browser";
import { loginSchema, type LoginInput } from "@/schemas/auth";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/sr/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Prijava</h1>
          <p className="mt-2 text-muted-foreground">
            Prijavite se na STOŽER
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

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Lozinka
            </label>
            <input
              id="password"
              type="password"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Vaša lozinka"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-destructive">
                {errors.password.message}
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
            {loading ? "Prijavljivanje..." : "Prijavi se"}
          </button>
        </form>

        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Zaboravili ste lozinku?{" "}
            <a href="/reset-password" className="text-primary hover:underline">
              Resetujte lozinku
            </a>
          </p>
          <p>
            Nemate nalog?{" "}
            <a href="/register" className="text-primary hover:underline">
              Registrujte se
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
