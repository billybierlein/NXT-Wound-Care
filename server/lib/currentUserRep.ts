import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function getCurrentUserSalesRepId(userId: number): Promise<number | null> {
  try {
    const [user] = await db.select({ salesRepId: users.salesRepId })
      .from(users)
      .where(eq(users.id, userId));
    return user?.salesRepId ?? null;
  } catch (error) {
    console.error("Error getting current user sales rep ID:", error);
    return null;
  }
}