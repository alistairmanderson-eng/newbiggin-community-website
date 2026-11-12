import { getStore } from "@netlify/blobs";
import { db, isAdmin, json, requireUser } from "../lib/toolshare-shared.mts";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const cleanIds = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,140}$/.test(id)))];
};
const photos = () => getStore({ name: "toolshare-photos", region: "eu-central-1" });

function validImageBytes(type, bytes) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value);
  if (type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  return false;
}

export default async (request) => {
  const user = await requireUser();
  if (!user || !isAdmin(user)) return json({ error: "Staff access required." }, 403);

  if (request.method === "GET") {
    const result = await db.pool.query(
      "SELECT tool_id, name, category, tool_type, active, photo_key FROM toolshare_catalogue WHERE active=TRUE OR import_batch_id IS NOT NULL ORDER BY category, name",
    );
    return json({ tools: result.rows.map((row) => ({
      id: row.tool_id, name: row.name, category: row.category, type: row.tool_type,
      active: row.active, photoUrl: row.photo_key ? "/.netlify/functions/catalogue-photo?key=" + encodeURIComponent(row.photo_key) : "",
    })) });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let form, ids;
  try {
    form = await request.formData();
    ids = cleanIds(JSON.parse(String(form.get("toolIds") || "null")));
  } catch { return json({ error: "Choose tools and a valid photo, then try again." }, 400); }
  const file = form.get("photo");
  if (!file || typeof file.arrayBuffer !== "function" || !imageTypes.has(file.type)) {
    return json({ error: "Choose a JPEG, PNG or WebP photo." }, 400);
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return json({ error: "Photos must be 5 MB or smaller after preparation." }, 400);
  if (!ids.length || ids.length > 500) return json({ error: "Select between 1 and 500 tool listings for this photo." }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validImageBytes(file.type, bytes)) return json({ error: "This file does not appear to be a valid JPEG, PNG or WebP image." }, 400);

  const key = crypto.randomUUID();
  const store = photos();
  try { await store.set(key, bytes, { metadata: { contentType: file.type } }); }
  catch (error) {
    console.error("Toolshare photo storage failed", error);
    return json({ error: "Photo storage is unavailable right now. Please refresh the page and try again." }, 503);
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT tool_id FROM toolshare_catalogue WHERE tool_id = ANY($1::text[]) AND (active=TRUE OR import_batch_id IS NOT NULL) FOR UPDATE",
      [ids],
    );
    if (found.rowCount !== ids.length) throw new Error("One or more selected tools could not be found. Refresh the photo list and try again.");
    await client.query("UPDATE toolshare_catalogue SET photo_key=$1 WHERE tool_id = ANY($2::text[])", [key, ids]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    await store.delete(key);
    return json({ error: error.message || "The photo could not be assigned." }, 400);
  } finally { client.release(); }

  return json({ count: ids.length, message: "Photo assigned to " + ids.length + " tool listing" + (ids.length === 1 ? "." : "s.") }, 201);
};


