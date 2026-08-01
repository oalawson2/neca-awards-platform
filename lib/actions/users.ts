"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

export async function inviteUser(input: { name: string; email: string; role: "secretariat" | "jury"; sectorIds?: string[] }) {
  const email = input.email.trim().toLowerCase();
  if (!email) return { success: false, error: "Email is required." };
  if (store.users.some((u) => u.email.toLowerCase() === email)) {
    return { success: false, error: "A user with this email already exists." };
  }

  const id = generateId(input.role);
  store.users.push({
    id,
    name: input.name || email.split("@")[0],
    email,
    role: input.role,
    status: "invited",
    sectorIds: input.role === "jury" ? input.sectorIds ?? [] : undefined,
  });
  if (input.role === "jury") {
    for (const sectorId of input.sectorIds ?? []) {
      store.jurorAssignments.push({ jurorId: id, sectorId });
    }
  }
  store.credentials.push({ userId: id, email, password: "" });

  logAction("Funke Adeyemi", `Invited ${input.role}`, store.users.find((u) => u.id === id)!.name);
  revalidatePath("/secretariat/users");
  return { success: true };
}

export async function resendInvite(userId: string) {
  const user = store.users.find((u) => u.id === userId);
  if (!user) return { success: false };
  logAction("Funke Adeyemi", "Resent invite to", user.name);
  return { success: true };
}

/** Same as resendInvite, but void-returning so it can be bound directly to a <form action>. */
export async function resendInviteFormAction(userId: string): Promise<void> {
  await resendInvite(userId);
}
