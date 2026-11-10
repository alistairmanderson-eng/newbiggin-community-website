import { db, isAdmin, json, requireUser } from "../lib/toolshare-shared.mts";

const clean = (value, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default async (request) => {
  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Please check the donation form and try again." }, 400); }
    const donorName = clean(body.donorName, 140);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 50);
    const address = clean(body.address, 400);
    const toolName = clean(body.toolName, 160);
    const category = clean(body.category, 80) || "Other";
    const description = clean(body.description, 1200);
    const condition = clean(body.condition, 60);
    const safety = clean(body.safetyRequirements, 500);
    const value = Number(body.estimatedValue || 0);
    const handover = clean(body.handoverMethod, 30);
    const date = body.preferredDate ? clean(body.preferredDate, 10) : null;
    if (!donorName || !emailValid(email) || !phone || !address || !toolName || !description || !condition ||
        !safety || !Number.isFinite(value) || value < 0 || value > 100000 ||
        !["Drop-off", "Collection", "Either"].includes(handover) ||
        !body.ownershipConfirmed || !body.termsConfirmed || !body.contactConfirmed || !body.safetyConfirmed) {
      return json({ error: "Please complete every donor contact, tool, safety and confirmation field." }, 400);
    }
    if (handover === "Drop-off" && (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      return json({ error: "Please choose a preferred drop-off date." }, 400);
    }
    const recent = await db.sql`SELECT COUNT(*)::int AS count FROM toolshare_donations WHERE donor_email=${email} AND created_at > NOW() - INTERVAL '1 day'`;
    if (Number(recent[0]?.count || 0) >= 5) return json({ error: "We have received several submissions from this email today. Please contact Elizabethan Hall for help." }, 429);
    const user = await requireUser();
    const id = crypto.randomUUID();
    await db.sql`
      INSERT INTO toolshare_donations
        (id, identity_user_id, donor_name, donor_email, donor_phone, donor_address, tool_name,
         category, description, condition, safety_requirements, estimated_value, handover_method,
         preferred_date, ownership_confirmed, safety_confirmed, terms_confirmed)
      VALUES (${id}, ${user ? String(user.id) : null}, ${donorName}, ${email}, ${phone}, ${address}, ${toolName},
        ${category}, ${description}, ${condition}, ${safety}, ${value}, ${handover}, ${date},
        TRUE, TRUE, TRUE)
    `;
    return json({ id, message: "Your pass-on tool submission has been sent to Elizabethan Hall for review." }, 201);
  }

  const user = await requireUser();
  if (!user || !isAdmin(user)) return json({ error: "Staff access required." }, 403);
  if (request.method === "GET") {
    const rows = await db.sql`
      SELECT id, donor_name, donor_email, donor_phone, donor_address, tool_name, category,
        description, condition, safety_requirements, estimated_value, handover_method,
        preferred_date, status, created_at
      FROM toolshare_donations ORDER BY created_at DESC LIMIT 200
    `;
    return json({ submissions: rows });
  }
  if (request.method === "PATCH") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const id = clean(body.id, 80);
    const action = body.action;
    if (!id || !["approve", "reject"].includes(action)) return json({ error: "Choose an approval action." }, 400);
    const entries = await db.sql`SELECT * FROM toolshare_donations WHERE id=${id} AND status='pending' LIMIT 1`;
    const donation = entries[0];
    if (!donation) return json({ error: "This submission was already reviewed or could not be found." }, 404);
    if (action === "approve") {
      const rate = Number(body.dailyRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) return json({ error: "Enter a valid daily hire rate." }, 400);
      const toolId = `community-${donation.id}`;
      await db.sql`
        INSERT INTO toolshare_catalogue
          (tool_id, tool_type, submission_id, name, category, daily_rate, replacement_value,
           condition, description, safety_requirements)
        VALUES (${toolId}, 'Community', ${donation.id}, ${donation.tool_name}, ${donation.category},
          ${rate}, ${donation.estimated_value}, ${donation.condition}, ${donation.description}, ${donation.safety_requirements})
        ON CONFLICT (submission_id) DO UPDATE SET active=TRUE
      `;
      await db.sql`UPDATE toolshare_donations SET status='approved', reviewed_at=NOW(), reviewed_by=${String(user.id)} WHERE id=${id}`;
      return json({ status: "approved", toolId, donorEmail: donation.donor_email });
    }
    await db.sql`UPDATE toolshare_donations SET status='rejected', reviewed_at=NOW(), reviewed_by=${String(user.id)} WHERE id=${id}`;
    return json({ status: "rejected", donorEmail: donation.donor_email });
  }
  return json({ error: "Method not allowed." }, 405);
};

