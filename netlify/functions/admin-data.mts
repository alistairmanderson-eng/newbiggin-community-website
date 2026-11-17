import { db, isAdmin, json, requireUser } from "../lib/toolshare-shared.mts";

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const user = await requireUser();
  if (!user || !isAdmin(user)) return json({ error: "Staff access required." }, 403);
  const rows = await db.sql`
    SELECT
      (SELECT COUNT(*)::int FROM toolshare_members WHERE membership_status='active' AND membership_expires_at > NOW()) AS active_members,
      (SELECT COALESCE(SUM(membership_amount),0)::numeric FROM toolshare_payments WHERE payment_status='paid') AS membership_income,
      (SELECT COALESCE(SUM(contribution_amount),0)::numeric FROM toolshare_payments WHERE payment_status='paid') AS contributions,
      (SELECT COUNT(*)::int FROM toolshare_donations WHERE status='pending') AS pending_donations,
      (SELECT COUNT(*)::int FROM toolshare_bookings WHERE collection_status='collected') AS tools_out,
      (SELECT COUNT(*)::int FROM toolshare_bookings WHERE hire_payment_status='paid') AS paid_hires
  `;
  return json({ report: rows[0] || {} });
};

