import { db, json, requireUser } from "../lib/toolshare-shared.mts";

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const user = await requireUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const rows = await db.sql`
    SELECT membership_status, membership_expires_at
    FROM toolshare_members WHERE identity_user_id = ${String(user.id)} LIMIT 1
  `;
  const member = rows[0];
  return json({
    member: member ? {
      membershipStatus: member.membership_status,
      expiresAt: member.membership_expires_at,
    } : null,
  });
};

