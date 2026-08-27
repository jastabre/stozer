"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization, hasPermission } from "@/lib/organization";

const teamSchema = z.object({
  name: z.string().min(1, "Naziv je obavezan").max(100, "Naziv je predugačak"),
  category: z.enum(["first_team", "youth", "academy", "other"]),
});

/**
 * Create a team. Requires teams.create (org scope from requireOrganization).
 * Sport defaults to the org's sport (declared via the DB default).
 */
export async function createTeam(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("teams.create");
  if (!allowed) throw new Error("Nemate dozvolu za kreiranje timova");

  const parsed = teamSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("teams").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    category: parsed.data.category,
  });

  if (error) throw new Error("Greška pri kreiranju tima: " + error.message);

  revalidatePath("/teams");
  redirect("/teams");
}

/**
 * Update a team (name/category). Requires teams.edit.
 */
export async function updateTeam(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("teams.edit");
  if (!allowed) throw new Error("Nemate dozvolu za izmenu timova");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("Nedostaje id tima");

  const parsed = teamSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
  });
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("teams")
    .update({ name: parsed.data.name, category: parsed.data.category })
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) throw new Error("Greška pri izmeni tima: " + error.message);

  revalidatePath("/teams");
  redirect("/teams");
}

/**
 * Delete a team. Requires teams.delete.
 */
export async function deleteTeam(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("teams.delete");
  if (!allowed) throw new Error("Nemate dozvolu za brisanje timova");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("Nedostaje id tima");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) throw new Error("Greška pri brisanju tima: " + error.message);

  revalidatePath("/teams");
  redirect("/teams");
}
