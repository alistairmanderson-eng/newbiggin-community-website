import { getStore } from "@netlify/blobs";
import { db, isAdmin, requireUser } from "../lib/toolshare-shared.mts";

const missing = () => new Response("Photo not found", {
  status: 404,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!/^[0-9a-f-]{36}$/i.test(key)) return missing();

  const active = await db.pool.query("SELECT 1 FROM toolshare_catalogue WHERE photo_key=$1 AND active=TRUE LIMIT 1", [key]);
  if (!active.rowCount) {
    const user = await requireUser();
    if (!user || !isAdmin(user)) return missing();
    const draft = await db.pool.query("SELECT 1 FROM toolshare_catalogue WHERE photo_key=$1 AND active=FALSE AND import_batch_id IS NOT NULL LIMIT 1", [key]);
    if (!draft.rowCount) return missing();
  }

  const entry = await getStore({ name: "toolshare-photos", region: "eu-central-1" }).getWithMetadata(key, { type: "arrayBuffer" });
  if (!entry?.data) return missing();
  const contentType = String(entry.metadata?.contentType || "");
  if (!imageTypes.has(contentType)) return missing();

  return new Response(entry.data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
};
