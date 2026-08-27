import { z } from "zod";

export const onboardingSchema = z.object({
  club_name: z
    .string()
    .min(2, "Ime kluba mora imati najmanje 2 karaktera")
    .max(200, "Ime kluba je predugačko"),
  sport: z.enum(["football", "basketball"], {
    required_error: "Izaberite sport",
  }),
  country: z.string().min(2, "Država je obavezna"),
  language: z.enum(["sr", "en"], {
    required_error: "Izaberite jezik",
  }),
  currency: z.string(),
  timezone: z.string(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
