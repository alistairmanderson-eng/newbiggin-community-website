const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export const cataloguePhotosMarkup = [
  '<section class="card" id="cataloguePhotosPanel">',
  '<h3>Tool photos</h3>',
  '<p>Upload one clear photo and assign it to several matching tool listings. Use the same image only for tools that are the same type and model. Photos are public for published tools; avoid including people or personal information.</p>',
  '<div style="display:grid;gap:10px">',
  '<label>Find tools by name or category<br><input id="toolPhotoSearch" type="search" style="width:100%;padding:10px"></label>',
  '<label>Filter by category<br><select id="toolPhotoCategory" style="width:100%;padding:10px"><option value="">All categories</option></select></label>',
  '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn alt" type="button" id="toolPhotoSelectVisible">Select visible tools</button><span id="toolPhotoSelectedCount" aria-live="polite">0 selected</span></div>',
  '<div id="toolPhotoTools" style="max-height:340px;overflow:auto;border:1px solid #d5ddd8;border-radius:10px;padding:8px" aria-label="Tool listings to receive this photo"></div>',
  '<label>Choose photo (JPEG, PNG or WebP; up to 5 MB after compression)<br><input id="toolPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"></label>',
  '<div id="toolPhotoPreview"></div><button class="btn" type="button" id="toolPhotoUpload" disabled>Upload photo to selected tools</button>',
  '<p id="toolPhotoStatus" role="status" aria-live="polite"></p></div></section>',
].join("");

async function preparePhoto(file) {
  if (typeof createImageBitmap !== "function") {
    if (file.size > 5 * 1024 * 1024) throw new Error("This browser cannot resize the photo. Choose an image under 5 MB.");
    return file;
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("This photo format could not be opened. Please choose a JPEG, PNG or WebP image."); }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The photo could not be prepared in this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob) throw new Error("The photo could not be prepared in this browser.");
    if (blob.size > 5 * 1024 * 1024) throw new Error("The prepared photo is still too large. Choose a smaller image.");
    return new File([blob], "toolshare-photo.webp", { type: "image/webp" });
  } finally { bitmap.close(); }
}

export async function initCataloguePhotos({ api, onUpdated }) {
  const search = document.getElementById("toolPhotoSearch");
  const category = document.getElementById("toolPhotoCategory");
  const list = document.getElementById("toolPhotoTools");
  const fileInput = document.getElementById("toolPhotoFile");
  const preview = document.getElementById("toolPhotoPreview");
  const uploadButton = document.getElementById("toolPhotoUpload");
  const status = document.getElementById("toolPhotoStatus");
  if (!list || !fileInput || !uploadButton || !status) return;

  let tools = [];
  const selected = new Set();
  const say = (message, error = false) => {
    status.textContent = message;
    status.style.color = error ? "#a00" : "#17442f";
  };
  const visibleTools = () => {
    const q = (search.value || "").trim().toLowerCase();
    const cat = category.value || "";
    return tools.filter((tool) => (!cat || tool.category === cat) &&
      (!q || (tool.name + " " + tool.category).toLowerCase().includes(q)));
  };
  const updateControls = () => {
    document.getElementById("toolPhotoSelectedCount").textContent = selected.size + " selected";
    uploadButton.disabled = selected.size === 0 || !fileInput.files?.[0];
  };
  const render = () => {
    const visible = visibleTools();
    list.innerHTML = visible.length ? visible.map((tool) =>
      '<label style="display:flex;gap:10px;align-items:center;padding:7px;border-bottom:1px solid #edf0ee">' +
      '<input type="checkbox" data-photo-tool="' + escapeHtml(tool.id) + '"' + (selected.has(String(tool.id)) ? " checked" : "") + '>' +
      (tool.photoUrl ? '<img src="' + escapeHtml(tool.photoUrl) + '" alt="" width="48" height="42" loading="lazy" style="object-fit:contain;border-radius:5px;background:#f4f6f5">' : "") +
      '<span>' + escapeHtml(tool.name) + ' <small>· ' + escapeHtml(tool.category) + ' · ' + (tool.active ? "Published" : "Draft") + '</small></span></label>'
    ).join("") : "<p>No matching tools.</p>";
    list.querySelectorAll("[data-photo-tool]").forEach((checkbox) => {
      checkbox.onchange = () => {
        const id = checkbox.dataset.photoTool;
        if (checkbox.checked) selected.add(id); else selected.delete(id);
        updateControls();
      };
    });
    updateControls();
  };

  try {
    const result = await api("catalogue-photos");
    tools = result.tools || [];
    const categories = [...new Set(tools.map((tool) => tool.category).filter(Boolean))].sort();
    category.innerHTML = '<option value="">All categories</option>' + categories.map((item) =>
      '<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + '</option>'
    ).join("");
    render();
  } catch (error) { say(error.message || "Photo listings could not be loaded.", true); }

  search.oninput = render;
  category.onchange = render;
  document.getElementById("toolPhotoSelectVisible").onclick = () => {
    const visible = visibleTools().map((tool) => String(tool.id));
    const select = visible.some((id) => !selected.has(id));
    visible.forEach((id) => select ? selected.add(id) : selected.delete(id));
    render();
  };
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    preview.textContent = file ? "Selected: " + file.name : "";
    updateControls();
    say("");
  };
  uploadButton.onclick = async () => {
    const file = fileInput.files?.[0];
    if (!file) { say("Choose a photo first.", true); return; }
    uploadButton.disabled = true;
    say("Preparing and uploading photo…");
    try {
      const photo = await preparePhoto(file);
      const form = new FormData();
      form.append("photo", photo, photo.name);
      form.append("toolIds", JSON.stringify([...selected]));
      const response = await fetch("/.netlify/functions/catalogue-photos", {
        method: "POST", credentials: "same-origin", cache: "no-store", body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The photo could not be saved.");
      say(result.message || "Photo saved.");
      selected.clear();
      fileInput.value = "";
      preview.textContent = "";
      const refreshed = await api("catalogue-photos");
      tools = refreshed.tools || tools;
      render();
      await onUpdated?.();
    } catch (error) {
      say(error.message || "The photo could not be saved.", true);
      updateControls();
    }
  };
}
