import { db, isAdmin, json, requireUser } from "../lib/toolshare-shared.mts";

const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const asDate = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const mapBooking = (row) => {
  const start = asDate(row.start_date), end = asDate(row.end_date);
  const days = Math.max(1, (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1);
  return {
    id: row.id, toolId: row.tool_id, toolName: row.tool_name, start, end, days,
    rate: Number(row.daily_rate), weeklyRate: row.weekly_rate === null || row.weekly_rate === undefined ? null : Number(row.weekly_rate), total: Number(row.total_amount), status: row.booking_status,
    collectionStatus: row.collection_status, paymentStatus: row.hire_payment_status, email: row.email,
  };
};

export default async (request) => {
  const user = await requireUser();
  if (!user) return json({ error: "Sign in to use bookings." }, 401);
  const admin = isAdmin(user);
  if (request.method === "GET") {
    const ref = new URL(request.url).searchParams.get("ref");
    if (ref && !admin) return json({ error: "Staff access required." }, 403);
    const rows = ref
      ? await db.sql`SELECT b.*, m.email FROM toolshare_bookings b JOIN toolshare_members m ON m.identity_user_id=b.identity_user_id WHERE b.id=${ref} LIMIT 1`
      : admin
        ? await db.sql`SELECT b.*, m.email FROM toolshare_bookings b JOIN toolshare_members m ON m.identity_user_id=b.identity_user_id ORDER BY b.created_at DESC LIMIT 200`
        : await db.sql`SELECT b.*, NULL::text AS email FROM toolshare_bookings b WHERE b.identity_user_id=${String(user.id)} ORDER BY b.created_at DESC LIMIT 100`;
    return json({ bookings: rows.map(mapBooking) });
  }
  if (request.method === "POST") {
    const member = await db.sql`SELECT membership_status, membership_expires_at FROM toolshare_members WHERE identity_user_id=${String(user.id)} LIMIT 1`;
    if (member[0]?.membership_status !== "active" || new Date(member[0].membership_expires_at) <= new Date()) {
      return json({ error: "An active annual membership is required before booking." }, 403);
    }
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid booking details." }, 400); }
    const id = String(body.id || "");
    const toolId = String(body.toolId || "").slice(0, 120);
    const start = body.start;
    const end = body.end;
    if (!/^TS-[A-Z0-9-]{8,40}$/.test(id) || !toolId || !validDate(start) || !validDate(end) || end < start) {
      return json({ error: "Check the tool and booking dates, then try again." }, 400);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (start < today || (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 > 30) {
      return json({ error: "Choose a future date and a booking of no more than 31 days." }, 400);
    }
    const tools = await db.sql`SELECT name, daily_rate, weekly_rate FROM toolshare_catalogue WHERE tool_id=${toolId} AND active=TRUE LIMIT 1`;
    if (!tools[0]) return json({ error: "That tool is unavailable. Refresh the catalogue and try again." }, 404);
    const rate = Number(tools[0].daily_rate);
    const conflict = await db.sql`
      SELECT id FROM toolshare_bookings
      WHERE tool_id=${toolId} AND booking_status IN ('requested', 'confirmed')
        AND start_date <= ${end} AND end_date >= ${start} LIMIT 1
    `;
    if (conflict.length) return json({ error: "This tool is already requested for some of those dates. Choose another date range." }, 409);
    const days = Math.max(1, (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1);
    const weeklyRate = tools[0].weekly_rate === null ? null : Number(tools[0].weekly_rate);
    const total = Math.round((weeklyRate === null ? days * rate : Math.floor(days / 7) * weeklyRate + (days % 7) * rate) * 100) / 100;
    const rows = await db.sql`
      INSERT INTO toolshare_bookings (id, identity_user_id, tool_id, tool_name, daily_rate, weekly_rate, start_date, end_date, total_amount)
      VALUES (${id}, ${String(user.id)}, ${toolId}, ${tools[0].name}, ${rate}, ${weeklyRate}, ${start}, ${end}, ${total})
      RETURNING *, NULL::text AS email
    `;
    return json({ booking: mapBooking(rows[0]) }, 201);
  }
  if (request.method === "PATCH") {
    if (!admin) return json({ error: "Staff access required." }, 403);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const id = String(body.id || "");
    let rows;
    if (body.action === "collect") {
      rows = await db.sql`UPDATE toolshare_bookings SET collection_status='collected', hire_payment_status='paid', collected_at=NOW() WHERE id=${id} AND collection_status='awaiting_collection' RETURNING *`;
    } else if (body.action === "return") {
      rows = await db.sql`UPDATE toolshare_bookings SET collection_status='returned', booking_status='complete', returned_at=NOW() WHERE id=${id} AND collection_status='collected' RETURNING *`;
    } else return json({ error: "Choose a valid staff action." }, 400);
    if (!rows[0]) return json({ error: "Booking not found or its status has already changed." }, 404);
    return json({ booking: mapBooking(rows[0]) });
  }
  return json({ error: "Method not allowed." }, 405);
};

