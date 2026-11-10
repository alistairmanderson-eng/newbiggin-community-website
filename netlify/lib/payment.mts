import nodemailer from "nodemailer";
import { db, sumupConfig } from "./toolshare-shared.mts";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function sendConfirmation(payment, member) {
  const password = Netlify.env.get("GMAIL_APP_PASSWORD");
  const user = Netlify.env.get("GMAIL_USER") || "newbiggincommunity@gmail.com";
  if (!password) {
    await db.sql`UPDATE toolshare_payments SET email_status = 'configuration_required' WHERE id = ${payment.id}`;
    return;
  }
  const claim = await db.sql`
    UPDATE toolshare_payments SET email_status = 'sending', email_claimed_at = NOW()
    WHERE id = ${payment.id} AND (
      email_status IN ('not_sent', 'failed', 'configuration_required') OR
      (email_status = 'sending' AND email_claimed_at < NOW() - INTERVAL '5 minutes')
    ) RETURNING id
  `;
  if (!claim.length) return;
  try {
    const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: password } });
    const contribution = Number(payment.contribution_amount);
    const contributionLine = contribution > 0
      ? `<p>Your Pay It Forward contribution of £${contribution.toFixed(2)} supports memberships for local residents who cannot afford the fee. Elizabethan Hall allocates sponsored memberships.</p>`
      : "";
    await transport.sendMail({
      from: Netlify.env.get("MAIL_FROM") || `Newbiggin Toolshare <${user}>`,
      to: member.email,
      subject: "Your Newbiggin Toolshare membership is confirmed",
      text: `Hello ${member.first_name},\n\nYour £30 annual Newbiggin Toolshare membership is confirmed. Every member has equal access to the full tool catalogue; daily hire charges are separate.\n${contribution > 0 ? `Your Pay It Forward contribution of £${contribution.toFixed(2)} supports local residents. Elizabethan Hall allocates sponsored memberships.\n` : ""}\nPlease bring photo ID and proof of address at your first collection.\n\nThank you,\nNewbiggin Toolshare at Elizabethan Hall`,
      html: `<p>Hello ${escapeHtml(member.first_name)},</p><p>Your £30 annual Newbiggin Toolshare membership is confirmed. Every member has equal access to the full tool catalogue; daily hire charges are separate.</p>${contributionLine}<p>Please bring photo ID and proof of address at your first collection.</p><p>Thank you,<br>Newbiggin Toolshare at Elizabethan Hall</p>`,
    });
    await db.sql`UPDATE toolshare_payments SET email_status = 'sent', email_sent_at = NOW(), email_claimed_at = NULL WHERE id = ${payment.id}`;
  } catch (error) {
    console.error("Membership confirmation email failed", error instanceof Error ? error.message : "unknown error");
    await db.sql`UPDATE toolshare_payments SET email_status = 'failed', email_claimed_at = NULL WHERE id = ${payment.id}`;
  }
}

export async function verifyAndApplyPayment(sumupCheckoutId, expectedReference) {
  if (!sumupCheckoutId) return false;
  const { apiKey, merchantCode } = sumupConfig();
  const response = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(sumupCheckoutId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error("Could not verify checkout with SumUp");
  const checkout = await response.json();
  const rows = await db.sql`
    SELECT p.id, p.checkout_reference, p.identity_user_id, p.total_amount, p.contribution_amount,
      p.payment_status, p.email_status, m.email, m.first_name
    FROM toolshare_payments p JOIN toolshare_members m ON m.identity_user_id = p.identity_user_id
    WHERE p.sumup_checkout_id = ${String(sumupCheckoutId)}
      AND p.checkout_reference = ${String(expectedReference)} LIMIT 1
  `;
  const payment = rows[0];
  if (!payment || checkout.checkout_reference !== payment.checkout_reference ||
      checkout.merchant_code !== merchantCode || checkout.currency !== "GBP" ||
      Number(checkout.amount) !== Number(payment.total_amount)) return false;
  if (checkout.status !== "PAID") return false;

  // One SQL statement atomically applies the first verified PAID transition only.
  await db.sql`
    WITH newly_paid AS (
      UPDATE toolshare_payments
      SET payment_status = 'paid', paid_at = COALESCE(paid_at, NOW())
      WHERE id = ${payment.id} AND payment_status <> 'paid'
      RETURNING identity_user_id, paid_at
    )
    UPDATE toolshare_members AS member SET
      membership_status = 'active',
      membership_paid_at = newly_paid.paid_at,
      membership_expires_at = CASE
        WHEN member.membership_status = 'active' AND member.membership_expires_at > newly_paid.paid_at
          THEN member.membership_expires_at + INTERVAL '1 year'
        ELSE newly_paid.paid_at + INTERVAL '1 year'
      END,
      updated_at = NOW()
    FROM newly_paid
    WHERE member.identity_user_id = newly_paid.identity_user_id
  `;
  const current = await db.sql`
    SELECT id, email_status FROM toolshare_payments WHERE id = ${payment.id} AND payment_status = 'paid' LIMIT 1
  `;
  if (!current[0]) return false;
  payment.email_status = current[0].email_status;
  await sendConfirmation(payment, { email: payment.email, first_name: payment.first_name });
  return true;
}

