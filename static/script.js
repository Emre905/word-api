/* ── State ─────────────────────────────────────────────────────────────────── */
const state = {
  categories: [],
  subCategories: [],
  notes: [],
  selectedCategoryId: null,
  selectedSubCategoryId: null,
  view: "table", // "table" | "cards"
};

/* ── DOM refs ──────────────────────────────────────────────────────────────── */
let currentNoteIndex = -1;
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sidebar = $("#sidebar");
const sidebarToggle = $("#sidebarToggle");
const categoryList = $("#categoryList");
const subCategoryList = $("#subCategoryList");
const notesBody = $("#notesBody");
const notesGrid = $("#notesGrid");
const emptyState = $("#emptyState");
const tableView = $("#tableView");
const cardsView = $("#cardsView");
const searchInput = $("#searchInput");
const priorityFilter = $("#priorityFilter");
const themeToggle = $("#themeToggle");
const viewBtns = $$(".view-btn");
const newNoteBtn = $("#newNoteBtn");
const noteModal = $("#noteModal");
const noteForm = $("#noteForm");
const modalWord = $("#modalWord");
const noteId = $("#noteId");
const singleNoteFields = $("#singleNoteFields");
const bulkNoteFields = $("#bulkNoteFields");
const bulkModeControls = $("#bulkModeControls");
const bulkWithHeaderWrap = $("#bulkWithHeaderWrap");
const bulkCsvInput = $("#bulkCsvInput");
const bulkWithHeader = $("#bulkWithHeader");
const bulkPreview = $("#bulkPreview");
const bulkPreviewSummary = $("#bulkPreviewSummary");
const bulkPreviewRows = $("#bulkPreviewRows");
const noteWord = $("#noteWord");
const noteMeaning = $("#noteMeaning");
const noteWordDuplicateMessage = $("#noteWordDuplicateMessage");
const noteMeaningDuplicateMessage = $("#noteMeaningDuplicateMessage");
const noteCategory = $("#noteCategory");
const noteSubCategory = $("#noteSubCategory");
const notePriority = $("#notePriority");
const noteDate = $("#noteDate");
const noteColor = $("#noteColor");
const noteTags = $("#noteTags");
const noteText = $("#noteText");
const modalSubmit = $("#modalSubmit");
const modalClose = $("#modalClose");
const modalCancel = $("#modalCancel");
const modalPrev = $("#modalPrev");
const modalNext = $("#modalNext");

const categoryModal = $("#categoryModal");
const categoryForm = $("#categoryForm");
const categoryName = $("#categoryName");
const categoryDescription = $("#categoryDescription");

const subCategoryModal = $("#subCategoryModal");
const subCategoryForm = $("#subCategoryForm");
const subCategoryParent = $("#subCategoryParent");
const subCategoryName = $("#subCategoryName");
const subCategoryDescription = $("#subCategoryDescription");

/* ── API helpers ───────────────────────────────────────────────────────────── */
const api = {
  async get(path) { const r = await fetch(path); if (!r.ok) throw Error(r.statusText); return r.status === 204 ? null : r.json(); },
  async post(path, body) {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const text = await r.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed.detail || text;
      } catch (error) {
        // keep the raw text fallback
      }
      throw new Error(message);
    }
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const text = await r.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed.detail || text;
      } catch (error) {
        // keep the raw text fallback
      }
      throw new Error(message);
    }
    return r.json();
  },
  async del(path) { const r = await fetch(path, { method: "DELETE" }); if (!r.ok) throw Error(r.statusText); },
};

/* ── Theme ─────────────────────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

/* ── Backup / Restore ──────────────────────────────────────────────────────── */
/* Toggle popover in collapsed mode when clicking the section header */
document.getElementById("backupSection")?.addEventListener("click", (e) => {
  const header = e.target.closest(".section-header");
  if (header && sidebar.classList.contains("collapsed")) {
    document.getElementById("backupSection")?.classList.toggle("popover");
  }
});

document.querySelectorAll(".sidebar-section .chevron").forEach((chevron) => {
  chevron.addEventListener("click", (e) => {
    e.stopPropagation();
    chevron.closest(".sidebar-section")?.classList.toggle("accordion-open");
  });
});

document.getElementById("backupDownload")?.addEventListener("click", (e) => {
  e.stopPropagation();
  window.location.href = "/api/backup";
});

document.getElementById("backupRestore")?.addEventListener("click", () => {
  document.getElementById("restoreFileInput")?.click();
});

document.getElementById("restoreFileInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch("/api/restore", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json();
      alert(`Restore failed: ${err.detail}`);
      return;
    }
    alert("Restore successful! Reloading notes...");
    loadCategories();
    loadNotes();
  } catch (err) {
    alert(`Restore failed: ${err.message}`);
  } finally {
    e.target.value = "";
  }
});

/* ── Sidebar ───────────────────────────────────────────────────────────────── */
function initSidebar() {
  const pinned = localStorage.getItem("sidebarPinned") === "true";
  if (!pinned) sidebar.classList.add("collapsed");
}

sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  localStorage.setItem("sidebarPinned", !sidebar.classList.contains("collapsed"));
  document.getElementById("backupSection")?.classList.remove("popover");
});

/* ── All Notes ─────────────────────────────────────────────────────────────── */
const allNotesSection = $("#allNotesSection");
allNotesSection.addEventListener("click", () => {
  state.selectedCategoryId = null;
  state.selectedSubCategoryId = null;
  searchInput.value = "";
  priorityFilter.value = "";
  renderCategories();
  loadSubCategories();
  loadNotes();
});

/* ── View toggle ───────────────────────────────────────────────────────────── */
function initView() {
  state.view = localStorage.getItem("view") || "table";
  viewBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.view);
  });
  applyView();
}

viewBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.view = btn.dataset.view;
    localStorage.setItem("view", state.view);
    viewBtns.forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
    applyView();
    renderNotes();
  });
});

function applyView() {
  const isTable = state.view === "table";
  tableView.style.display = isTable ? "" : "none";
  cardsView.style.display = isTable ? "none" : "block";
}

/* ── Categories ────────────────────────────────────────────────────────────── */
async function loadCategories() {
  state.categories = await api.get("/api/categories");
  renderCategories();
  populateCategoryDropdowns();
}

function renderCategories() {
  allNotesSection.classList.toggle("active", state.selectedCategoryId === null);
  categoryList.innerHTML = state.categories.map((c) => `
    <li class="${state.selectedCategoryId === c.id ? "active" : ""}" data-id="${c.id}">
      <span class="cat-name">${esc(c.name)}</span>
      <button class="delete-btn" data-action="delete-category" data-id="${c.id}" title="Delete">&times;</button>
    </li>
  `).join("") || '<li style="font-size:.8rem;color:var(--text-muted);cursor:default;">No categories yet</li>';

  categoryList.querySelectorAll("li[data-id]").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.closest(".delete-btn")) return;
      const id = parseInt(li.dataset.id);
      state.selectedCategoryId = state.selectedCategoryId === id ? null : id;
      state.selectedSubCategoryId = null;
      renderCategories();
      loadSubCategories();
      loadNotes();
    });
  });

  categoryList.querySelectorAll("[data-action='delete-category']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this category and all its sub-categories?")) return;
      await api.del(`/api/categories/${btn.dataset.id}`);
      state.selectedCategoryId = null;
      loadCategories();
      loadSubCategories();
      loadNotes();
    });
  });
}

/* ── Sub-Categories ────────────────────────────────────────────────────────── */
async function loadSubCategories() {
  const params = new URLSearchParams();
  if (state.selectedCategoryId) params.set("category_id", state.selectedCategoryId);
  state.subCategories = await api.get(`/api/sub_categories?${params}`);
  renderSubCategories();
}

function renderSubCategories() {
  allNotesSection.classList.toggle("active", state.selectedCategoryId === null && state.selectedSubCategoryId === null);
  subCategoryList.innerHTML = state.subCategories.map((s) => `
    <li class="${state.selectedSubCategoryId === s.id ? "active" : ""}" data-id="${s.id}">
      <span class="sub-cat-name">${esc(s.name)}</span>
      <button class="delete-btn" data-action="delete-sub-category" data-id="${s.id}" title="Delete">&times;</button>
    </li>
  `).join("") || '<li style="font-size:.8rem;color:var(--text-muted);cursor:default;">No sub-categories</li>';

  subCategoryList.querySelectorAll("li[data-id]").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.closest(".delete-btn")) return;
      const id = parseInt(li.dataset.id);
      state.selectedSubCategoryId = state.selectedSubCategoryId === id ? null : id;
      renderSubCategories();
      loadNotes();
    });
  });

  subCategoryList.querySelectorAll("[data-action='delete-sub-category']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this sub-category?")) return;
      await api.del(`/api/sub_categories/${btn.dataset.id}`);
      state.selectedSubCategoryId = null;
      loadSubCategories();
      loadNotes();
    });
  });
}

/* ── Notes ──────────────────────────────────────────────────────────────────── */
async function loadNotes() {
  const params = new URLSearchParams();
  if (state.selectedCategoryId) params.set("category_id", state.selectedCategoryId);
  if (state.selectedSubCategoryId) params.set("sub_category_id", state.selectedSubCategoryId);
  if (priorityFilter.value) params.set("priority", priorityFilter.value);
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  state.notes = await api.get(`/api/notes?${params}`);
  renderNotes();
}

function renderNotes() {
  const hasNotes = state.notes.length > 0;
  emptyState.style.display = hasNotes ? "none" : "flex";
  if (state.view === "table") renderNotesTable();
  else renderNotesCards();
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const text = String(value).split("T")[0];
  if (!text) return "—";
  return text;
}

function renderNotesTable() {
  const hasNotes = state.notes.length > 0;
  notesBody.style.display = hasNotes ? "" : "none";
  if (!hasNotes) { notesBody.innerHTML = ""; return; }

  notesBody.innerHTML = state.notes.map((n) => {
    const cat = state.categories.find((c) => c.id === n.category_id);
    const sub = state.subCategories.find((s) => s.id === n.sub_category_id);
    const catSub = [cat?.name, sub?.name].filter(Boolean).join(" / ") || "—";
    const preview = n.context.replace(/<[^>]*>/g, "").substring(0, 120);
    const tags = (n.tags || "").split(",").filter(Boolean).map((t) => `<span class="tag">${esc(t.trim())}</span>`).join("");
    return `<tr class="priority-${n.priority}" data-id="${n.id}" data-title="${esc(n.word)}">
      <td class="td-actions">
        <button class="edit-note" title="Edit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="delete-note" title="Delete">&times;</button>
      </td>
      <td class="td-word">${esc(n.word)}</td>
      <td class="td-meaning">${esc(n.meaning)}</td>
      <td class="td-context">${esc(preview)}${n.context.length > 120 ? "…" : ""}</td>
      <td class="td-cat">${esc(catSub)}</td>
      <td class="td-priority"><span class="priority-badge">${n.priority}</span></td>
      <td class="td-date">${formatDisplayDate(n.note_date)}</td>
      <td class="td-tags">${tags || "—"}</td>
    </tr>`;
  }).join("");

  notesBody.querySelectorAll("tr[data-id]").forEach((row) => {
    const id = parseInt(row.dataset.id);
    row.querySelector(".edit-note").addEventListener("click", (e) => {
      e.stopPropagation();
      openNoteModal(id);
    });
    row.querySelector(".delete-note").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this note?")) return;
      await api.del(`/api/notes/${id}`);
      loadNotes();
    });
    row.addEventListener("click", () => openNoteModal(id));
  });
}

function renderNotesCards() {
  const hasNotes = state.notes.length > 0;
  notesGrid.innerHTML = "";
  if (!hasNotes) return;

  notesGrid.innerHTML = state.notes.map((n) => {
    const pClass = `priority-${n.priority}`;
    const preview = n.context.replace(/<[^>]*>/g, "").substring(0, 150);
    const tags = (n.tags || "").split(",").filter(Boolean).map((t) => `<span class="tag">${esc(t.trim())}</span>`).join("");
    return `<div class="note-card ${pClass}" data-id="${n.id}" style="border-left:3px solid ${n.color || 'transparent'}">
      <div class="card-word">${esc(n.word)}</div>
      <div class="card-meaning">${esc(n.meaning)}</div>
      <div class="card-preview">${esc(preview)}</div>
      <div class="card-meta">
        <span class="priority-badge">${n.priority}</span>
        <span class="date">${formatDisplayDate(n.note_date)}</span>
        ${tags}
        <div class="card-actions">
          <button class="edit-card" title="Edit">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="delete-card" title="Delete">&times;</button>
        </div>
      </div>
    </div>`;
  }).join("");

  notesGrid.querySelectorAll(".note-card").forEach((card) => {
    const id = parseInt(card.dataset.id);
    card.querySelector(".edit-card").addEventListener("click", (e) => {
      e.stopPropagation();
      openNoteModal(id);
    });
    card.querySelector(".delete-card").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this note?")) return;
      await api.del(`/api/notes/${id}`);
      loadNotes();
    });
    card.addEventListener("click", () => openNoteModal(id));
  });
}

/* ── Note Modal ────────────────────────────────────────────────────────────── */
function parseBulkCsvPreview(rawText, withHeader) {
  if (!rawText || !rawText.trim()) return [];

  const rows = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return [];

  const csvLines = rows.map((line) => {
    const out = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current);
    return out.map((cell) => cell.trim());
  });

  const dataRows = withHeader ? csvLines.slice(1) : csvLines;
  return dataRows.slice(0, 3).map((row) => {
    const padded = [...row];
    while (padded.length < 5) padded.push("");
    return {
      word: padded[0] || "—",
      meaning: padded[1] || "—",
      context: padded[2] || "—",
      category: padded[3] || "—",
    };
  });
}

function countBulkCsvRows(csvText, withHeader) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) return 0;

  const dataRows = withHeader ? lines.slice(1) : lines;
  return dataRows.length;
}

function renderBulkCsvPreview() {
  const value = bulkCsvInput.value.trim();
  if (!value) {
    bulkPreview.style.display = "none";
    bulkPreviewRows.innerHTML = "";
    bulkPreviewSummary.textContent = "Previewing rows";
    return;
  }

  const previewRows = parseBulkCsvPreview(value, bulkWithHeader.checked);
  const totalRows = countBulkCsvRows(value, bulkWithHeader.checked);
  if (!previewRows.length) {
    bulkPreview.style.display = "none";
    bulkPreviewRows.innerHTML = "";
    bulkPreviewSummary.textContent = "Previewing rows";
    return;
  }

  const previewLabel =
    totalRows <= 3
      ? `Previewing ${totalRows} row${totalRows === 1 ? "" : "s"}`
      : `Previewing first 3 of ${totalRows} rows`;

  bulkPreviewSummary.textContent = previewLabel;
  bulkPreviewRows.innerHTML = previewRows.map((row) => `
    <tr>
      <td style="padding:.75rem .8rem; border-bottom:1px solid var(--border);">${esc(row.word)}</td>
      <td style="padding:.75rem .8rem; border-bottom:1px solid var(--border);">${esc(row.meaning)}</td>
      <td style="padding:.75rem .8rem; border-bottom:1px solid var(--border);">${esc(row.context)}</td>
      <td style="padding:.75rem .8rem; border-bottom:1px solid var(--border);">${esc(row.category)}</td>
    </tr>
  `).join("");
  bulkPreview.style.display = "block";
}

function setNoteEntryMode(mode) {
  const isBulk = mode === "bulk";
  singleNoteFields.style.display = isBulk ? "none" : "block";
  bulkNoteFields.style.display = isBulk ? "block" : "none";
  bulkModeControls.style.display = "flex";
  bulkWithHeaderWrap.style.display = isBulk ? "flex" : "none";
  noteWord.required = !isBulk;
  noteMeaning.required = !isBulk;
  noteText.required = false;
  bulkCsvInput.required = isBulk;
  noteWord.disabled = isBulk;
  noteMeaning.disabled = isBulk;
  noteText.disabled = isBulk;
  if (isBulk) {
    renderBulkCsvPreview();
  } else {
    bulkPreview.style.display = "none";
    bulkPreviewRows.innerHTML = "";
  }
  document.querySelectorAll('input[name="noteEntryMode"]').forEach((input) => {
    input.checked = input.value === mode;
  });
}

async function openNoteModal(id = null) {
  noteForm.reset();
  noteId.value = "";
  bulkCsvInput.value = "";
  modalWord.textContent = "New Note";
  if (noteDate) {noteDate.value = new Date().toISOString().split("T")[0];}
  noteColor.value = "#4f46e5";
  notePriority.value = "medium";
  setNoteEntryMode("single");

  if (id) {
    const note = await api.get(`/api/notes/${id}`);
    noteId.value = note.id;
    modalWord.textContent = "Edit Note — " + note.word;
    noteWord.value = note.word;
    noteMeaning.value = note.meaning;
    noteCategory.value = note.category_id || "";
    await populateSubCategoryDropdown(note.category_id);
    noteSubCategory.value = note.sub_category_id || "";
    notePriority.value = note.priority;
    if (noteDate) {noteDate.value = note.note_date;}
    noteColor.value = note.color || "#4f46e5";
    noteTags.value = note.tags || "";
    noteText.value = note.context;
    setNoteEntryMode("single");

    currentNoteIndex = state.notes.findIndex((n) => n.id === id);
  } else {
    currentNoteIndex = -1;
    state.selectedCategoryId = null;
    state.selectedSubCategoryId = null;
    const defaultCategory = await ensureCategoryByName("noun");
    noteCategory.value = String(defaultCategory.id);
    await populateSubCategoryDropdown(defaultCategory.id);
    noteSubCategory.value = "";
  }

  updateNavButtons();
  noteModal.classList.add("active");

  // Focus the word input for new notes (or editing old notes)
  requestAnimationFrame(() => {
    noteWord.focus();
    noteWord.select();
  });
}

function updateNavButtons() {
  const total = state.notes.length;
  const hasNav = total > 1 && currentNoteIndex >= 0;
  modalPrev.style.display = hasNav ? "" : "none";
  modalNext.style.display = hasNav ? "" : "none";
  if (hasNav) {
    modalPrev.disabled = currentNoteIndex === 0;
    modalNext.disabled = currentNoteIndex === total - 1;
  }
}

function closeNoteModal() {
  noteModal.classList.remove("active");
}

async function ensureCategoryByName(name) {
  const existing = state.categories.find((cat) => cat.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const created = await api.post("/api/categories", {
    name,
    description: `Auto-created from default note behavior`,
  });

  state.categories.push(created);
  renderCategories();
  populateCategoryDropdowns();
  return created;
}

async function syncVerbCategoryPreview() {
  const meaningValue = noteMeaning.value.trim();
  if (!/^to\s+/i.test(meaningValue)) {
    if (!noteCategory.value || noteCategory.value === "") {
      const nounCategory = await ensureCategoryByName("noun");
      noteCategory.value = String(nounCategory.id);
    }
    return;
  }

  let verbCategory = state.categories.find((cat) => cat.name.toLowerCase() === "verb");
  if (!verbCategory) {
    verbCategory = await ensureCategoryByName("verb");
  }

  if (noteCategory) {
    populateCategoryDropdown(noteCategory);
  }

  noteCategory.value = String(verbCategory.id);
  if (state.selectedCategoryId !== verbCategory.id) {
    state.selectedCategoryId = verbCategory.id;
  }
}

async function ensureVerbCategory() {
  return ensureCategoryByName("verb");
}

function setDuplicateFieldState(field, messageEl, message) {
  if (!field || !messageEl) return;
  field.classList.toggle("field-error", Boolean(message));
  messageEl.textContent = message || "";
  messageEl.hidden = !message;
}

function clearDuplicateFieldStates() {
  setDuplicateFieldState(noteWord, noteWordDuplicateMessage, "");
  setDuplicateFieldState(noteMeaning, noteMeaningDuplicateMessage, "");
}

function getDuplicateValueFromMessage(message) {
  if (!message) return "";
  const normalized = message.toLowerCase();

  if (normalized.includes("duplicate word") || normalized.includes("word:")) {
    const match = message.match(/(?:duplicate word|word):\s*["']?([^"']+)/i);
    if (match && match[1]) return match[1].trim();
  }

  if (normalized.includes("duplicate meaning") || normalized.includes("meaning:")) {
    const match = message.match(/(?:duplicate meaning|meaning):\s*["']?([^"']+)/i);
    if (match && match[1]) return match[1].trim();
  }

  return "";
}

function buildDuplicateOverridePrompt(message) {
  const duplicateValue = getDuplicateValueFromMessage(message);
  if (!duplicateValue) {
    return "This note duplicates an existing word or meaning. Cancel save or save anyway?";
  }

  const lower = message.toLowerCase();
  if (lower.includes("word")) {
    return `This word "${duplicateValue}" already exists. Cancel save or save anyway?`;
  }
  if (lower.includes("meaning")) {
    return `This meaning "${duplicateValue}" already exists. Cancel save or save anyway?`;
  }
  return `This value "${duplicateValue}" already exists. Cancel save or save anyway?`;
}

noteWord.addEventListener("input", () => {
  setDuplicateFieldState(noteWord, noteWordDuplicateMessage, "");
});

noteMeaning.addEventListener("input", async () => {
  setDuplicateFieldState(noteMeaning, noteMeaningDuplicateMessage, "");
  const meaningValue = noteMeaning.value.trim();
  if (!/^to\s+/i.test(meaningValue)) {
    if (!noteCategory.value || noteCategory.value === "") {
      const nounCategory = await ensureCategoryByName("noun");
      noteCategory.value = String(nounCategory.id);
    }
    return;
  }
  await syncVerbCategoryPreview();
});

document.querySelectorAll('input[name="noteEntryMode"]').forEach((input) => {
  input.addEventListener("change", (e) => setNoteEntryMode(e.target.value));
});
bulkWithHeader.addEventListener("change", renderBulkCsvPreview);
bulkCsvInput.addEventListener("input", renderBulkCsvPreview);

// if hit Enter key, save the node (shift + Enter for new line)
noteForm.addEventListener("keydown", (event) => {
  const target = event.target;
  const isSaveKey = event.key === "Enter" && !event.shiftKey;
  const isTextArea = target instanceof HTMLElement && target.tagName === "TEXTAREA";

  if (isSaveKey && modalSubmit) {
    event.preventDefault();
    modalSubmit.click();
    return;
  }

  if (event.key === "Enter" && event.shiftKey && isTextArea) {
    return;
  }
});

noteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearDuplicateFieldStates();

  const selectedMode = document.querySelector('input[name="noteEntryMode"]:checked')?.value || "single";

  if (selectedMode === "bulk") {
    const csvText = bulkCsvInput.value.trim();
    if (!csvText) {
      alert("Paste CSV content to import multiple notes.");
      return;
    }

    const previewRows = parseBulkCsvPreview(csvText, bulkWithHeader.checked);
    if (previewRows.length === 0) {
      alert("CSV preview is empty. Please check the pasted data.");
      return;
    }

    const bulkPayload = { csv: csvText, with_header: bulkWithHeader.checked };

    try {
      await api.post("/api/notes/bulk", bulkPayload);
    } catch (error) {
      const message = error.message || "This bulk import could not be saved.";
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("word") || message.toLowerCase().includes("meaning")) {
        const duplicateValue = getDuplicateValueFromMessage(message);
        const shouldSaveAnyway = window.confirm(
          duplicateValue
            ? `This import contains a duplicate value ("${duplicateValue}"). Cancel import or save anyway?`
            : "This import contains duplicate words or meanings. Cancel import or save anyway?"
        );
        if (!shouldSaveAnyway) {
          return;
        }

        try {
          await api.post("/api/notes/bulk", { ...bulkPayload, ignore_duplicate: true });
        } catch (overrideError) {
          alert(overrideError.message || "This bulk import could not be saved.");
          return;
        }
      } else {
        alert(message);
        return;
      }
    }

    state.selectedCategoryId = null;
    state.selectedSubCategoryId = null;
    closeNoteModal();
    loadNotes();
    return;
  }

  const meaningValue = noteMeaning.value.trim();
  let selectedCategoryId = noteCategory.value ? parseInt(noteCategory.value) : null;

  if (/^to\s+/i.test(meaningValue)) {
    const verbCategory = await ensureVerbCategory();
    selectedCategoryId = verbCategory.id;
    noteCategory.value = String(selectedCategoryId);
    state.selectedCategoryId = selectedCategoryId;
  }

  const normalizedTags = noteTags.value
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(", ");

  const payload = {
    word: noteWord.value.trim(),
    meaning: meaningValue,
    context: noteText.value.trim(),
    ...(noteDate ? { note_date: noteDate.value } : {}),
    priority: notePriority.value,
    color: noteColor.value,
    tags: normalizedTags,
    category_id: selectedCategoryId,
    sub_category_id: noteSubCategory.value ? parseInt(noteSubCategory.value) : null,
  };

  const id = noteId.value;
  try {
    if (id) {
      await api.put(`/api/notes/${id}`, payload);
    } else {
      const created = await api.post("/api/notes", payload);
      noteId.value = created.id;
    }
  } catch (error) {
    const message = error.message || "This note could not be saved.";
    if (message.toLowerCase().includes("word") || message.toLowerCase().includes("meaning")) {
      const shouldSaveAnyway = window.confirm(buildDuplicateOverridePrompt(message));
      if (!shouldSaveAnyway) {
        if (message.toLowerCase().includes("word")) {
          setDuplicateFieldState(noteWord, noteWordDuplicateMessage, "This word already exists. Please choose a different one.");
          noteWord.focus();
        }
        if (message.toLowerCase().includes("meaning")) {
          setDuplicateFieldState(noteMeaning, noteMeaningDuplicateMessage, "This meaning already exists. Please choose a different one.");
          noteMeaning.focus();
        }
        return;
      }

      const overridePayload = { ...payload, ignore_duplicate: true };
      try {
        if (id) {
          await api.put(`/api/notes/${id}`, overridePayload);
        } else {
          const created = await api.post("/api/notes", overridePayload);
          noteId.value = created.id;
        }
      } catch (overrideError) {
        const overrideMessage = overrideError.message || "This note could not be saved.";
        alert(overrideMessage);
        return;
      }
    } else {
      alert(message);
      return;
    }
  }

  state.selectedCategoryId = null;
  state.selectedSubCategoryId = null;
  noteCategory.value = "";
  noteSubCategory.value = "";
  closeNoteModal();
  loadNotes();
});

/* ── Category Modal ────────────────────────────────────────────────────────── */
document.querySelectorAll("[id$='CategoryBtn'], [id$='SubCategoryBtn']").forEach((btn) => {
  if (btn.id === "addCategoryBtn") {
    btn.addEventListener("click", () => {
      categoryForm.reset();
      categoryModal.classList.add("active");
    });
  }
  if (btn.id === "addSubCategoryBtn") {
    btn.addEventListener("click", () => {
      subCategoryForm.reset();
      populateCategoryDropdown(subCategoryParent);
      subCategoryModal.classList.add("active");
    });
  }
});

function closeModal(overlay) {
  overlay.classList.remove("active");
}

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await api.post("/api/categories", {
    name: categoryName.value.trim(),
    description: categoryDescription.value.trim() || null,
  });
  closeModal(categoryModal);
  loadCategories();
  loadSubCategories();
});

subCategoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await api.post("/api/sub_categories", {
    name: subCategoryName.value.trim(),
    description: subCategoryDescription.value.trim() || null,
    category_id: parseInt(subCategoryParent.value),
  });
  closeModal(subCategoryModal);
  loadSubCategories();
  loadNotes();
});

/* ── Modal close handlers ──────────────────────────────────────────────────── */
[modalClose, modalCancel].forEach((el) => el?.addEventListener("click", closeNoteModal));

modalPrev.addEventListener("click", () => {
  if (currentNoteIndex > 0) {
    openNoteModal(state.notes[currentNoteIndex - 1].id);
  }
});
modalNext.addEventListener("click", () => {
  if (currentNoteIndex < state.notes.length - 1) {
    openNoteModal(state.notes[currentNoteIndex + 1].id);
  }
});
document.getElementById("categoryModalClose")?.addEventListener("click", () => closeModal(categoryModal));
document.getElementById("categoryModalCancel")?.addEventListener("click", () => closeModal(categoryModal));
document.getElementById("subCategoryModalClose")?.addEventListener("click", () => closeModal(subCategoryModal));
document.getElementById("subCategoryModalCancel")?.addEventListener("click", () => closeModal(subCategoryModal));

document.querySelectorAll(".modal-overlay").forEach((ov) => {
  ov.addEventListener("click", (e) => {
    if (e.target === ov) closeModal(ov);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.active").forEach(closeModal);
  }
});

/* ── Category / Sub-Category dropdown population ───────────────────────────── */
function populateCategoryDropdowns() {
  populateCategoryDropdown(noteCategory);
}

function populateCategoryDropdown(select) {
  const val = select.value;
  select.innerHTML = '<option value="">None</option>' +
    state.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  select.value = val;
}

noteCategory.addEventListener("change", async () => {
  await populateSubCategoryDropdown(noteCategory.value);
  noteSubCategory.value = "";
});

async function populateSubCategoryDropdown(categoryId) {
  noteSubCategory.innerHTML = '<option value="">None</option>';
  if (!categoryId) return;
  const subs = await api.get(`/api/sub_categories?category_id=${categoryId}`);
  subs.forEach((s) => {
    noteSubCategory.innerHTML += `<option value="${s.id}">${esc(s.name)}</option>`;
  });
}

/* ── Filters ───────────────────────────────────────────────────────────────── */
searchInput.addEventListener("input", debounce(loadNotes, 300));
priorityFilter.addEventListener("change", loadNotes);

newNoteBtn.addEventListener("click", () => openNoteModal());

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function esc(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
initTheme();
initSidebar();
initView();
loadCategories();
loadSubCategories();
loadNotes();
