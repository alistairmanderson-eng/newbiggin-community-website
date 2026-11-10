import { db, json, requireUser } from "../lib/toolshare-shared.mts";
import { verifyAndApplyPayment } from "../lib/payment.mts";

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const user = await requireUser();
  if (!user) return json({ error: "Sign in to check your payment." }, 401);
  const reference = new URL(request.url).searchParams.get("ref") || "";
  if (!/^[0-9a-f-]{36}$/i.test(reference)) return json({ error: "Payment reference not found." }, 404);
  const rows = await db.sql`
    SELECT checkout_reference, sumup_checkout_id, payment_status, total_amount
    FROM toolshare_payments WHERE checkout_reference = ${reference} AND identity_user_id = ${String(user.id)} LIMIT 1
  `;
  if (!rows[0]) return json({ error: "Payment reference not found." }, 404);
  if (rows[0].payment_status !== "paid") {
    await verifyAndApplyPayment(rows[0].sumup_checkout_id, reference);
  }
  const updated = await db.sql`
    SELECT payment_status, email_status, contribution_amount, total_amount
    FROM toolshare_payments WHERE checkout_reference = ${reference} AND identity_user_id = ${String(user.id)} LIMIT 1
  `;
  return json({ status: updated[0]?.payment_status || "pending", emailStatus: updated[0]?.email_status || "not_sent", total: Number(updated[0]?.total_amount || 0) });
};

