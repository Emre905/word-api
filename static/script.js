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
const showArchived = $("#showArchived");
const themeToggle = $("#themeToggle");
const viewBtns = $$(".view-btn");
const newNoteBtn = $("#newNoteBtn");
const noteModal = $("#noteModal");
const noteForm = $("#noteForm");
const modalTitle = $("#modalTitle");
const noteId = $("#noteId");
const noteTitle = $("#noteTitle");
const noteMeaning = $("#noteMeaning");
const noteCategory = $("#noteCategory");
const noteSubCategory = $("#noteSubCategory");
const notePriority = $("#notePriority");
const noteDate = $("#noteDate");
const noteColor = $("#noteColor");
const noteTags = $("#noteTags");
const noteText = $("#noteText");
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
  async post(path, body) { const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) throw Error(await r.text()); return r.json(); },
  async put(path, body) { const r = await fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) throw Error(await r.text()); return r.json(); },
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
  showArchived.checked = false;
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
  if (showArchived.checked) params.set("archived", "true");
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

function renderNotesTable() {
  const hasNotes = state.notes.length > 0;
  notesBody.style.display = hasNotes ? "" : "none";
  if (!hasNotes) { notesBody.innerHTML = ""; return; }

  notesBody.innerHTML = state.notes.map((n) => {
    const cat = state.categories.find((c) => c.id === n.category_id);
    const sub = state.subCategories.find((s) => s.id === n.sub_category_id);
    const catSub = [cat?.name, sub?.name].filter(Boolean).join(" / ") || "—";
    const preview = n.note_text.replace(/<[^>]*>/g, "").substring(0, 120);
    const tags = (n.tags || "").split(",").filter(Boolean).map((t) => `<span class="tag">${esc(t.trim())}</span>`).join("");
    return `<tr class="priority-${n.priority}${n.is_archived ? ' archived' : ''}" data-id="${n.id}" data-title="${esc(n.title)}">
      <td class="td-actions">
        <button class="archive-note" title="${n.is_archived ? 'Restore' : 'Archive'}">${n.is_archived ? '&#x21B6;' : '&#x1F4E5;'}</button>
        <button class="edit-note" title="Edit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="delete-note" title="Delete">&times;</button>
      </td>
      <td class="td-title">${esc(n.title)}${n.is_archived ? ' <span class="archived-badge">archived</span>' : ''}</td>
      <td class="td-meaning">${esc(n.meaning)}</td>
      <td class="td-note">${esc(preview)}${n.note_text.length > 120 ? "…" : ""}</td>
      <td class="td-cat">${esc(catSub)}</td>
      <td class="td-priority"><span class="priority-badge">${n.priority}</span></td>
      <td class="td-date">${n.note_date}</td>
      <td class="td-tags">${tags || "—"}</td>
    </tr>`;
  }).join("");

  notesBody.querySelectorAll("tr[data-id]").forEach((row) => {
    const id = parseInt(row.dataset.id);
    row.querySelector(".edit-note").addEventListener("click", (e) => {
      e.stopPropagation();
      openNoteModal(id);
    });
    row.querySelector(".archive-note").addEventListener("click", async (e) => {
      e.stopPropagation();
      const note = state.notes.find((n) => n.id === id);
      await api.put(`/api/notes/${id}`, { is_archived: !note.is_archived });
      loadNotes();
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
    const preview = n.note_text.replace(/<[^>]*>/g, "").substring(0, 150);
    const tags = (n.tags || "").split(",").filter(Boolean).map((t) => `<span class="tag">${esc(t.trim())}</span>`).join("");
    return `<div class="note-card ${pClass}${n.is_archived ? ' archived' : ''}" data-id="${n.id}" style="border-left:3px solid ${n.color || 'transparent'}">
      <div class="card-title">${esc(n.title)}${n.is_archived ? ' <span class="archived-badge">archived</span>' : ''}</div>
      <div class="card-meaning">${esc(n.meaning)}</div>
      <div class="card-preview">${esc(preview)}</div>
      <div class="card-meta">
        <span class="priority-badge">${n.priority}</span>
        <span class="date">${n.note_date}</span>
        ${tags}
        <div class="card-actions">
          <button class="archive-card" title="${n.is_archived ? 'Restore' : 'Archive'}">${n.is_archived ? '&#x21B6;' : '&#x1F4E5;'}</button>
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
    card.querySelector(".archive-card").addEventListener("click", async (e) => {
      e.stopPropagation();
      const note = state.notes.find((n) => n.id === id);
      await api.put(`/api/notes/${id}`, { is_archived: !note.is_archived });
      loadNotes();
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
async function openNoteModal(id = null) {
  noteForm.reset();
  noteId.value = "";
  modalTitle.textContent = "New Note";
  noteDate.value = new Date().toISOString().split("T")[0];
  noteColor.value = "#4f46e5";
  notePriority.value = "medium";

  if (id) {
    const note = await api.get(`/api/notes/${id}`);
    noteId.value = note.id;
    modalTitle.textContent = "Edit Note — " + note.title;
    noteTitle.value = note.title;
    noteMeaning.value = note.meaning;
    noteCategory.value = note.category_id || "";
    await populateSubCategoryDropdown(note.category_id);
    noteSubCategory.value = note.sub_category_id || "";
    notePriority.value = note.priority;
    noteDate.value = note.note_date;
    noteColor.value = note.color || "#4f46e5";
    noteTags.value = note.tags || "";
    noteText.value = note.note_text;

    currentNoteIndex = state.notes.findIndex((n) => n.id === id);
  } else {
    currentNoteIndex = -1;
    if (state.selectedCategoryId) {
      noteCategory.value = state.selectedCategoryId;
      await populateSubCategoryDropdown(state.selectedCategoryId);
      if (state.selectedSubCategoryId) noteSubCategory.value = state.selectedSubCategoryId;
    }
  }

  updateNavButtons();
  noteModal.classList.add("active");
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

noteForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    title: noteTitle.value.trim(),
    meaning: noteMeaning.value.trim(),
    note_text: noteText.value.trim(),
    note_date: noteDate.value,
    priority: notePriority.value,
    color: noteColor.value,
    tags: noteTags.value.trim(),
    category_id: noteCategory.value ? parseInt(noteCategory.value) : null,
    sub_category_id: noteSubCategory.value ? parseInt(noteSubCategory.value) : null,
  };

  const id = noteId.value;
  if (id) {
    await api.put(`/api/notes/${id}`, payload);
  } else {
    const created = await api.post("/api/notes", payload);
    noteId.value = created.id;
  }

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
showArchived.addEventListener("change", loadNotes);

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
