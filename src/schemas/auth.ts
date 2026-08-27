import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Unesite validnu email adresu"),
  password: z
    .string()
    .min(8, "Lozinka mora imati najmanje 8 karaktera")
    .max(128, "Lozinka je predugačka"),
  display_name: z
    .string()
    .min(2, "Ime mora imati najmanje 2 karaktera")
    .max(100, "Ime je predugačko"),
});

export const loginSchema = z.object({
  email: z.string().email("Unesite validnu email adresu"),
  password: z.string().min(1, "Lozinka je obavezna"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Unesite validnu email adresu"),
});

export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Lozinka mora imati najmanje 8 karaktera")
    .max(128, "Lozinka je predugačka"),
  confirmPassword: z.string().min(1, "Potvrda lozinke je obavezna"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Lozinke se ne poklapaju",
  path: ["confirmPassword"],
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
