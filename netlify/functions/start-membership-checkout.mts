import { db, json, profileFor, requireUser, sumupConfig, validateProfile } from "../lib/toolshare-shared.mts";

const allowedMethods = (request) => request.method === "POST";

export default async (request) => {
  if (!allowedMethods(request)) return json({ error: "Method not allowed" }, 405);
  const user = await requireUser();
  if (!user) return json({ error: "Sign in to continue." }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const normaliseProfile = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const pick = (...keys) => {
      for (const key of keys) {
        const item = value[key];
        if (typeof item === "string" && item.trim()) return item.trim();
      }
      return "";
    };
    return {
      firstName: pick("firstName", "first_name", "givenName", "given_name"),
      lastName: pick("lastName", "last_name", "familyName", "family_name"),
      address: pick("address", "streetAddress", "street_address", "address1", "address_line1"),
      town: pick("town", "city", "locality"),
      postcode: pick("postcode", "postalCode", "postal_code", "zip"),
      mobile: pick("mobile", "mobileNumber", "mobile_number", "phone"),
    };
  };
  const suppliedProfile = normaliseProfile(body.profile);
  const profile = validateProfile(suppliedProfile) ? suppliedProfile : normaliseProfile(profileFor(user));
  if (!validateProfile(profile)) {
    const missingFields = ["firstName", "lastName", "address", "town", "postcode", "mobile"]
      .filter((key) => !profile[key]);
    return json({
      error: "Complete your address and contact details before paying.",
      missingFields,
    }, 400);
  }

  const choice = body.contributionAmount;
  const contribution = Number(choice);
  if (!Number.isFinite(contribution) || contribution < 0 || contribution > 1000 || Math.round(contribution * 100) !== contribution * 100) {
    return json({ error: "Choose a valid contribution amount between £0 and £1,000." }, 400);
  }

  const memberId = String(user.id);
  const email = String(user.email).trim().toLowerCase();
  await db.sql`
    INSERT INTO toolshare_members
      (identity_user_id, email, first_name, last_name, address, town, postcode, mobile)
    VALUES
      (${memberId}, ${email}, ${profile.firstName.trim()}, ${profile.lastName.trim()},
       ${profile.address.trim()}, ${profile.town.trim()}, ${profile.postcode.trim().toUpperCase()}, ${profile.mobile.trim()})
    ON CONFLICT (identity_user_id) DO UPDATE SET
      email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
      address = EXCLUDED.address, town = EXCLUDED.town, postcode = EXCLUDED.postcode,
      mobile = EXCLUDED.mobile, updated_at = NOW()
  `;
  const existing = await db.sql`
    SELECT membership_status, membership_expires_at FROM toolshare_members
    WHERE identity_user_id = ${memberId} LIMIT 1
  `;
  if (existing[0]?.membership_status === "active" && new Date(existing[0].membership_expires_at) > new Date()) {
    return json({ error: "Your membership is already active." }, 409);
  }

  const reference = crypto.randomUUID();
  const total = Math.round((30 + contribution) * 100) / 100;
  await db.sql`
    INSERT INTO toolshare_payments
      (checkout_reference, identity_user_id, membership_amount, contribution_amount, total_amount)
    VALUES (${reference}, ${memberId}, 30, ${contribution}, ${total})
  `;

  try {
    const { apiKey, merchantCode } = sumupConfig();
    const origin = new URL(request.url).origin;
    const response = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        checkout_reference: reference,
        amount: total,
        currency: "GBP",
        merchant_code: merchantCode,
        description: contribution
          ? `Newbiggin Toolshare annual membership and Pay It Forward £${contribution.toFixed(2)}`
          : "Newbiggin Toolshare annual membership",
        hosted_checkout: { enabled: true },
        return_url: `${origin}/.netlify/functions/sumup-webhook`,
        redirect_url: `${origin}/toolshare.html?payment=return&ref=${encodeURIComponent(reference)}`,
      }),
    });
    const checkout = await response.json().catch(() => ({}));
    if (!response.ok || !checkout.hosted_checkout_url || !checkout.id) {
      await db.sql`UPDATE toolshare_payments SET payment_status = 'failed' WHERE checkout_reference = ${reference}`;
      return json({ error: "SumUp could not start checkout. Please try again or contact Elizabethan Hall." }, 502);
    }
    await db.sql`UPDATE toolshare_payments SET sumup_checkout_id = ${checkout.id} WHERE checkout_reference = ${reference}`;
    return json({ checkoutUrl: checkout.hosted_checkout_url, reference });
  } catch (error) {
    console.error("Membership checkout setup failed", error instanceof Error ? error.message : "unknown error");
    await db.sql`UPDATE toolshare_payments SET payment_status = 'failed' WHERE checkout_reference = ${reference}`;
    return json({ error: "Checkout is temporarily unavailable. Please try again later." }, 503);
  }
};

