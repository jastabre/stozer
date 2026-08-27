"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@/lib/supabase/browser";
import { registerSchema, type RegisterInput } from "@/schemas/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput) {
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.display_name,
        },
      },
    });

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
          <h1 className="text-2xl font-bold">Proverite email</h1>
          <p className="text-muted-foreground">
            Poslali smo vam email za verifikaciju. Proverite svoje sanduče i
            pratite link za aktivaciju naloga.
          </p>
          <a
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Prijavi se
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Kreiraj nalog</h1>
          <p className="mt-2 text-muted-foreground">
            Registrujte se za STOŽER
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="display_name"
              className="block text-sm font-medium mb-1"
            >
              Ime i prezime
            </label>
            <input
              id="display_name"
              type="text"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Vaše ime"
              {...register("display_name")}
            />
            {errors.display_name && (
              <p className="mt-1 text-sm text-destructive">
                {errors.display_name.message}
              </p>
            )}
          </div>

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
              placeholder="Najmanje 8 karaktera"
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
            {loading ? "Registracija..." : "Registruj se"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Već imate nalog?{" "}
          <a href="/login" className="text-primary hover:underline">
            Prijavite se
          </a>
        </p>
      </div>
    </div>
  );
}
