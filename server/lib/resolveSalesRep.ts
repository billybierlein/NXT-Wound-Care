import { db } from "../db";
import { users, salesReps } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function resolveSalesRepIdForUser(userId: number): Promise<number | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return null;
  if (u.salesRepId) return u.salesRepId;

  let rep: { id: number } | undefined;

  // First try to match by email
  if (u.email) {
    const foundByEmail = await db.select({ id: salesReps.id })
      .from(salesReps)
      .where(eq(salesReps.email, u.email))
      .limit(1);
    if (foundByEmail.length > 0) rep = foundByEmail[0];
  }

  // Fallback to matching by name (using legacy salesRepName field)
  if (!rep && u.salesRepName) {
    const foundByName = await db.select({ id: salesReps.id })
      .from(salesReps)
      .where(eq(salesReps.name, u.salesRepName))
      .limit(1);
    if (foundByName.length > 0) rep = foundByName[0];
  }

  // If we found a match, update the user record for future efficiency
  if (rep) {
    await db.update(users).set({ salesRepId: rep.id }).where(eq(users.id, userId));
    return rep.id;
  }

  return null;
}