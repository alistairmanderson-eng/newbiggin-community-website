import { db, isAdmin, json, requireUser } from "../lib/toolshare-shared.mts";

const clean = (value, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const money = (value, label, max = 100000) => {
  if (value === "" || value === null || value === undefined) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > max) throw new Error(`${label} must be a number from £0 to £${max}.`);
  return Math.round(amount * 100) / 100;
};
const normaliseType = (value, fallback) => {
  const kind = clean(value, 40).toLowerCase().replace(/[–—]/g, "-");
  if (!kind) return fallback;
  if (["hall", "elizabethan hall", "hall tool"].includes(kind)) return "Hall";
  if (["community", "pass-on", "pass on", "donated", "community tool"].includes(kind)) return "Community";
  return null;
};
const basename = (value) => clean(value, 500).replace(/^['"]|['"]$/g, "").split(/[\\/]/).pop().slice(0, 180);

export default async (request) => {
  const user = await requireUser();
  if (!user || !isAdmin(user)) return json({ error: "Staff access required." }, 403);

  if (request.method === "GET") {
    const rows = await db.sql`
      SELECT tool_id, tool_type, name, category, daily_rate, weekly_rate, condition,
        description, suitable_uses, additional_items, safety_requirements, photo_filename
      FROM toolshare_catalogue
      WHERE active=FALSE AND import_batch_id IS NOT NULL
      ORDER BY approved_at, name LIMIT 500
    `;
    return json({ drafts: rows.map((row) => ({
      id: row.tool_id, type: row.tool_type, name: row.name, category: row.category,
      dailyRate: Number(row.daily_rate), weeklyRate: row.weekly_rate === null ? null : Number(row.weekly_rate),
      condition: row.condition, description: row.description, suitableUses: row.suitable_uses,
      additionalItems: row.additional_items, safetyRequirements: row.safety_requirements,
      photoFilename: row.photo_filename,
    })) });
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Choose a valid Excel workbook and try again." }, 400); }
    const rows = body?.rows;
    const fallbackType = normaliseType(body?.toolType, "");
    if (!Array.isArray(rows) || !rows.length || rows.length > 500 || !["Hall", "Community"].includes(fallbackType)) {
      return json({ error: "Choose Hall or Pass-On as the default ownership and import between 1 and 500 tools at a time." }, 400);
    }

    const prepared = [];
    try {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index] || {};
        const name = clean(row.name, 160);
        const category = clean(row.category, 80);
        const dailyRate = money(row.dailyRate, `Row ${index + 1} daily hire charge`, 1000);
        if (!name || !category || dailyRate === null) throw new Error(`Row ${index + 1}: tool name, category and daily hire charge are needed.`);
        const type = normaliseType(row.type, fallbackType);
        if (!type) throw new Error(`Row ${index + 1}: ownership must be Hall or Community / Pass-On.`);
        const weeklyRate = money(row.weeklyRate, `Row ${index + 1} weekly hire charge`, 10000);
        const replacementValue = money(row.replacementValue, `Row ${index + 1} replacement value`, 100000) ?? 0;
        prepared.push({
          toolId: `import-${crypto.randomUUID()}`,
          type, name, category, dailyRate, weeklyRate, replacementValue,
          condition: clean(row.condition, 100) || "Needs checking",
          description: clean(row.description, 1200),
          suitableUses: clean(row.suitableUses, 500),
          additionalItems: clean(row.additionalItems, 500),
          safetyRequirements: clean(row.safetyRequirements, 500),
          photoFilename: basename(row.photoFilename),
        });
      }
    } catch (error) { return json({ error: error.message || "Check the spreadsheet rows and try again." }, 400); }

    const filename = clean(body.filename, 180).replace(/[\\/]/g, "_") || "Toolshare import.xlsx";
    const batchId = crypto.randomUUID();
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO toolshare_catalogue_imports (id, filename, tool_type, imported_by, imported_count) VALUES ($1, $2, $3, $4, $5)",
        [batchId, filename, fallbackType, String(user.id), prepared.length],
      );
      const chunkSize = 100;
      const marksPerRow = 16;
      for (let offset = 0; offset < prepared.length; offset += chunkSize) {
        const chunk = prepared.slice(offset, offset + chunkSize);
        const values = [];
        const groups = chunk.map((row, rowIndex) => {
          values.push(row.toolId, row.type, row.name, "🛠️", row.category, row.dailyRate, row.weeklyRate,
            row.replacementValue, row.condition, row.description, row.safetyRequirements,
            row.suitableUses, row.additionalItems, row.photoFilename, batchId, false);
          const start = rowIndex * marksPerRow;
          return "(" + Array.from({length: marksPerRow}, (_, i) => "$" + (start + i + 1)).join(", ") + ")";
        });
        await client.query(
          `INSERT INTO toolshare_catalogue (tool_id, tool_type, name, icon, category, daily_rate, weekly_rate, replacement_value, condition, description, safety_requirements, suitable_uses, additional_items, photo_filename, import_batch_id, active) VALUES ${groups.join(", ")}`,
          values,
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Toolshare catalogue import failed", error);
      return json({ error: "The import could not be saved. No tools were added; please try again." }, 500);
    } finally { client.release(); }
    return json({ batchId, count: prepared.length, message: `${prepared.length} tools imported as drafts. They are not visible to members until staff review and publish them.` }, 201);
  }

  if (request.method === "PATCH") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid review details." }, 400); }
    const id = clean(body.id, 140);
    const condition = clean(body.condition, 100);
    const safetyRequirements = clean(body.safetyRequirements, 500);
    if (!id || !condition || condition.toLowerCase() === "needs checking" || !safetyRequirements) {
      return json({ error: "Set the checked condition and add safety guidance, or enter ‘None known’, before publishing." }, 400);
    }
    const rows = await db.sql`
      UPDATE toolshare_catalogue
      SET condition=${condition}, safety_requirements=${safetyRequirements}, active=TRUE, approved_at=NOW()
      WHERE tool_id=${id} AND active=FALSE AND import_batch_id IS NOT NULL
      RETURNING tool_id, name
    `;
    if (!rows[0]) return json({ error: "This draft was already published or could not be found." }, 404);
    return json({ tool: rows[0], message: "Tool published to the catalogue." });
  }

  return json({ error: "Method not allowed." }, 405);
};




