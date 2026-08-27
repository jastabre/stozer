import { z } from "zod";

/**
 * createPlayer form schema (Task 1 / TRACER).
 * federation_id is an optional free-text reference (D-06) — never validated
 * or interpreted against the club ID.
 */
export const createPlayerSchema = z.object({
  first_name: z
    .string()
    .min(1, "Ime je obavezno")
    .max(100, "Ime je predugačko"),
  last_name: z
    .string()
    .min(1, "Prezime je obavezno")
    .max(100, "Prezime je predugačko"),
  birth_date: z.string().min(1, "Datum rođenja je obavezan"),
  gender: z.enum(["male", "female", "other"]).optional(),
  nationality: z.string().max(100, "Nacionalnost je predugačka").optional(),
  position: z.string().max(100, "Pozicija je predugačka").optional(),
  federation_id: z.string().max(100).optional(),
  team_id: z.string().uuid("Tim mora biti UUID").optional(),
  jersey_number: z.coerce
    .number()
    .int("Broj dresa mora biti ceo broj")
    .min(1, "Broj dresa mora biti 1-99")
    .max(99, "Broj dresa mora biti 1-99")
    .optional(),
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
