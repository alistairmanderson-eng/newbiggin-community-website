import { db, json } from "../lib/toolshare-shared.mts";

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const rows = await db.sql`
    SELECT tool_id, tool_type, name, icon, category, daily_rate, replacement_value,
      condition, description, safety_requirements
    FROM toolshare_catalogue WHERE active=TRUE ORDER BY tool_type, name
  `;
  return json({ tools: rows.map((row) => ({
    id: row.tool_id, type: row.tool_type, name: row.name, icon: row.icon,
    category: row.category, rate: Number(row.daily_rate), value: Number(row.replacement_value),
    condition: row.condition, notes: row.description, safety: row.safety_requirements,
    owner: row.tool_type === "Community" ? "Pass-On Tool" : "Elizabethan Hall",
  })) });
};

