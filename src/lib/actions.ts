"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";

export async function toggleWatchlist(ticker: string) {
  const t = ticker.toUpperCase();
  const existing = db
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.ticker, t))
    .all();
  if (existing.length > 0) {
    db.delete(schema.watchlist).where(eq(schema.watchlist.ticker, t)).run();
  } else {
    db.insert(schema.watchlist).values({ ticker: t, addedAt: new Date() }).run();
  }
  revalidatePath("/watchlist");
  revalidatePath(`/stocks/${t}`);
}
