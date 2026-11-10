const h = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let xlsxReady;
async function loadXlsx() {
  if (window.XLSX) return window.XLSX;
  if (!xlsxReady) xlsxReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("The spreadsheet reader did not load."));
    script.onerror = () => reject(new Error("The spreadsheet reader could not load. Check your internet connection and try again."));
    document.head.appendChild(script);
  });
  return xlsxReady;
}
const norm = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const moneyValue = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const text = String(value).replace(/[£,\s]/g, "").trim();
  return text ? Number(text) : null;
};
function parseSheet(XLSX, file) {
  const workbook = XLSX.read(file, { type: "array" });
  const sheetName = workbook.SheetNames.find((name) => norm(name) === "tool catalogue") || workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
  const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
  const headerIndex = grid.findIndex((row) => {
    const keys = row.map(norm);
    return keys.includes("tool name") && keys.includes("category");
  });
  if (headerIndex < 0) throw new Error("I couldn't find a header row with Tool name and Category columns.");
  const headers = grid[headerIndex].map(norm);
  const indexOf = (...aliases) => headers.findIndex((header) => aliases.includes(header));
  const read = (row, ...aliases) => {
    const i = indexOf(...aliases);
    return i < 0 ? "" : row[i] ?? "";
  };
  const rows = [];
  const issues = [];
  grid.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some((value) => String(value ?? "").trim() !== "")) return;
    const item = {
      rowNumber: headerIndex + offset + 2,
      name: String(read(row, "tool name", "name")).trim(),
      category: String(read(row, "category")).trim(),
      type: String(read(row, "ownership", "tool type", "type")).trim(),
      condition: String(read(row, "condition", "tool condition")).trim(),
      description: String(read(row, "description included parts", "description", "included parts")).trim(),
      suitableUses: String(read(row, "suitable uses", "uses")).trim(),
      additionalItems: String(read(row, "additional items", "accessories", "included accessories")).trim(),
      safetyRequirements: String(read(row, "safety checks required", "safety requirements", "safety")).trim(),
      dailyRate: moneyValue(read(row, "daily hire charge", "daily rate", "hire charge per day")),
      weeklyRate: moneyValue(read(row, "weekly hire charge", "weekly rate", "hire charge per week")),
      replacementValue: moneyValue(read(row, "replacement value", "replacement value gbp")),
      photoFilename: String(read(row, "photo filename", "photo", "image filename")).trim().replace(/^['"]|['"]$/g, ""),
    };
    const errors = [];
    if (!item.name) errors.push("tool name");
    if (!item.category) errors.push("category");
    if (item.dailyRate === null || !Number.isFinite(item.dailyRate) || item.dailyRate < 0) errors.push("daily hire charge");
    if (item.weeklyRate !== null && (!Number.isFinite(item.weeklyRate) || item.weeklyRate < 0)) errors.push("weekly hire charge");
    if (item.replacementValue !== null && (!Number.isFinite(item.replacementValue) || item.replacementValue < 0)) errors.push("replacement value");
    if (errors.length) issues.push(`Row ${item.rowNumber}: add or correct ${errors.join(", ")}.`);
    rows.push(item);
  });
  if (!rows.length) throw new Error("There are no tool rows below the headings.");
  if (rows.length > 500) throw new Error("Import up to 500 tools at a time. Split a larger list into batches.");
  return { rows, issues };
}

export const catalogueImportMarkup = `
  <section class="card" id="catalogueImport">
    <h3>Import tool list</h3>
    <p>Choose your completed Excel workbook. Tool name, category and daily charge are needed. Weekly charge and the other details can be left blank. IDs are generated automatically.</p>
    <p class="muted">We read the workbook in your browser. Import sends the tool details to the shared catalogue as drafts. Photos are not uploaded; photo filenames are kept only as references. Drafts are not shown to members until staff review and publish them.</p>
    <div style="display:grid;gap:10px;max-width:620px">
      <label>Default ownership for rows without an Ownership column<br><select id="catalogueImportType" required><option value="">Choose Hall or Pass-On</option><option value="Hall">Hall tools</option><option value="Community">Pass-On / community tools</option></select></label>
      <label>Excel workbook (.xlsx or .xls)<br><input id="catalogueImportFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>
      <button type="button" class="btn" id="cataloguePreviewButton">Preview workbook</button>
    </div>
    <p id="catalogueImportStatus" role="status" aria-live="polite"></p>
    <div id="catalogueImportPreview"></div>
  </section>
  <section class="card" id="catalogueDraftsPanel"><h3>Imported drafts awaiting review</h3><div id="catalogueDrafts">Loading…</div></section>`;

export async function initCatalogueImport({ api, onPublished }) {
  const status = document.getElementById("catalogueImportStatus");
  const preview = document.getElementById("catalogueImportPreview");
  const fileInput = document.getElementById("catalogueImportFile");
  const typeInput = document.getElementById("catalogueImportType");
  const button = document.getElementById("cataloguePreviewButton");
  let parsed = null;
  const setStatus = (message, error = false) => { status.textContent = message; status.style.color = error ? "#a00" : "#17442f"; };

  const renderDrafts = async () => {
    const box = document.getElementById("catalogueDrafts");
    try {
      const { drafts } = await api("catalogue-import");
      box.innerHTML = drafts.length ? drafts.map((draft) => `<div class="card" data-draft-id="${h(draft.id)}">
        <h4>${h(draft.name)} <span class="tag">${h(draft.type === "Community" ? "Pass-On" : "Hall")}</span></h4>
        <p>${h(draft.category)} · £${Number(draft.dailyRate).toFixed(2)}/day${draft.weeklyRate === null ? "" : ` · £${Number(draft.weeklyRate).toFixed(2)}/week`}</p>
        ${draft.description ? `<p>${h(draft.description)}</p>` : ""}${draft.suitableUses ? `<p><b>Suitable uses:</b> ${h(draft.suitableUses)}</p>` : ""}${draft.additionalItems ? `<p><b>Additional items:</b> ${h(draft.additionalItems)}</p>` : ""}
        ${draft.photoFilename ? `<p><b>Photo reference:</b> ${h(draft.photoFilename)}</p>` : ""}
        <label>Condition after staff check<br><input data-draft-condition value="${h(draft.condition === "Needs checking" ? "" : draft.condition)}" placeholder="e.g. Ready to lend" required></label>
        <label>Safety guidance (write “None known” if there is none)<br><input data-draft-safety value="${h(draft.safetyRequirements)}" required></label>
        <button type="button" class="btn" data-publish-draft>Review and publish this tool</button>
      </div>`).join("") : "<p>No imported drafts are waiting for review.</p>";
      box.querySelectorAll("[data-publish-draft]").forEach((publishButton) => {
        publishButton.onclick = async () => {
          const card = publishButton.closest("[data-draft-id]");
          publishButton.disabled = true;
          try {
            await api("catalogue-import", { method: "PATCH", body: JSON.stringify({
              id: card.dataset.draftId,
              condition: card.querySelector("[data-draft-condition]").value.trim(),
              safetyRequirements: card.querySelector("[data-draft-safety]").value.trim(),
            }) });
            await onPublished();
            await renderDrafts();
          } catch (error) { alert(error.message || "The tool could not be published."); publishButton.disabled = false; }
        };
      });
    } catch (error) { box.textContent = error.message || "Staff sign-in is required to view drafts."; }
  };

  button.onclick = async () => {
    const file = fileInput.files?.[0];
    if (!file) { setStatus("Choose your Excel workbook first.", true); return; }
    if (file.size > 10 * 1024 * 1024) { setStatus("Choose a workbook smaller than 10 MB.", true); return; }
    if (!typeInput.value) { setStatus("Choose a default ownership for rows without an Ownership column.", true); return; }
    button.disabled = true; preview.innerHTML = ""; parsed = null;
    try {
      const XLSX = await loadXlsx();
      const data = parseSheet(XLSX, await file.arrayBuffer());
      parsed = data;
      const rows = data.rows.slice(0, 12).map((row) => `<tr><td>${row.rowNumber}</td><td>${h(row.name)}</td><td>${h(row.category)}</td><td>${h(row.dailyRate)}</td><td>${row.weeklyRate === null ? "" : h(row.weeklyRate)}</td></tr>`).join("");
      preview.innerHTML = `<p><b>${data.rows.length} tool rows found.</b>${data.rows.length > 12 ? " Showing the first 12 for a quick check." : ""}</p>
        ${data.issues.length ? `<div class="notice" style="background:#fff1f0;border-color:#c33;color:#7f1d1d"><b>Fix these rows before import:</b><ul>${data.issues.map((issue) => `<li>${h(issue)}</li>`).join("")}</ul></div>` : ""}
        <div style="overflow:auto"><table><thead><tr><th>Sheet row</th><th>Tool</th><th>Category</th><th>Daily £</th><th>Weekly £</th></tr></thead><tbody>${rows}</tbody></table></div>
        <button type="button" class="btn" id="catalogueImportSubmit" ${data.issues.length ? "disabled" : ""}>Import ${data.rows.length} as drafts</button>`;
      setStatus(data.issues.length ? "Correct the missing required fields in the workbook, then choose it again." : "Preview looks ready. Importing saves drafts; it does not publish them.");
      document.getElementById("catalogueImportSubmit")?.addEventListener("click", async (event) => {
        const importButton = event.currentTarget;
        importButton.disabled = true;
        try {
          const result = await api("catalogue-import", { method: "POST", body: JSON.stringify({ filename: file.name, toolType: typeInput.value, rows: parsed.rows }) });
          setStatus(result.message);
          preview.innerHTML = ""; fileInput.value = ""; parsed = null;
          await renderDrafts();
        } catch (error) { setStatus(error.message || "The tools could not be imported.", true); importButton.disabled = false; }
      });
    } catch (error) { setStatus(error.message || "This workbook could not be read.", true); }
    finally { button.disabled = false; }
  };
  await renderDrafts();
}

