function splitAlternatives(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasSlashAlternatives(text) {
  return text.includes(" / ");
}

function splitSlashAlternatives(text) {
  return text
    .split(" / ")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeTerm(text) {
  const alternatives = splitAlternatives(text);
  if (alternatives.length > 1) return alternatives;
  if (hasSlashAlternatives(text)) return splitSlashAlternatives(text);
  return [text];
}

const emptyMessages = [
  "Nenhum termo encontrado.",
  "Nada sobre isso no dicionário ainda. Manda pro ET!",
  "A comunidade do ET e criativa, mas nao tanto. Tenta outro termo.",
  "Essa giria e nova até pro 1155.",
  "Buscou e nao achou. Sugere esse termo pro ET na live!",
];

let allEntries = [];
let termLinks = [];
let lastEmptyIndex = -1;

function pickMessage(arr) {
  let idx;
  do {
    idx = Math.floor(Math.random() * arr.length);
  } while (idx === lastEmptyIndex && arr.length > 1);
  lastEmptyIndex = idx;
  return arr[idx];
}

function shakeElement(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 500);
}

function loadData() {
  const script = document.getElementById("termosData");
  if (!script) {
    document.getElementById("entriesContainer").innerHTML =
      '<div class="empty-state">Erro ao carregar os dados.</div>';
    return;
  }

  allEntries = JSON.parse(script.textContent);

  termLinks = [];
  const seen = new Set();
  for (const entry of allEntries) {
    const variants = normalizeTerm(entry.termo);
    const id = slugify(variants[0]);
    for (const v of variants) {
      const key = v.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        termLinks.push({ term: key, id });
      }
    }
  }
  termLinks.sort((a, b) => b.term.length - a.term.length);
}

function renderEntries(entries, searchTerm) {
  const container = document.getElementById("entriesContainer");
  const emptyState = document.getElementById("emptyState");

  if (entries.length === 0) {
    container.innerHTML = "";
    const msg = pickMessage(emptyMessages);
    emptyState.className = "empty-state";
    const escapedTerm = escapeHtml(searchTerm);
    if (msg.includes("Nenhum termo encontrado para")) {
      emptyState.innerHTML = "<p>" + msg + ' "' + escapedTerm + '"</p>';
    } else {
      emptyState.innerHTML = "<p>" + msg + "</p>";
    }
    emptyState.classList.remove("hidden");
    if (searchTerm.trim()) {
      shakeElement(document.querySelector(".search-container"));
    }
    return;
  }

  emptyState.classList.add("hidden");

  container.innerHTML = entries
    .map((entry, index) => {
      const terms = normalizeTerm(entry.termo);
      const cardId = slugify(terms[0]);
      const definicoes = splitAlternatives(entry.definicao);
      const hasExemplo = entry.exemplo && entry.exemplo.trim().length > 0;

      const termHtml = `<h2 class="term-alternatives">${terms
        .map(
          (t, i) =>
            (i > 0 ? '<span class="term-sep">ou</span>' : "") +
            `<span class="term-tag">${escapeHtml(t)}</span>`,
        )
        .join("")}</h2>`;

      const defHtml =
        definicoes.length > 0
          ? `<div class="entry-definition">${definicoes
              .map(
                (d) => `<div class="def-item">${linkifyText(d, terms)}</div>`,
              )
              .join("")}</div>`
          : "";

      const exemploHtml = hasExemplo
        ? `<div class="entry-example">${linkifyText(entry.exemplo, terms)}</div>`
        : "";

      const delay = Math.min(index * 40, 400);
      return `<article id="${cardId}" class="entry-card" style="animation-delay:${delay}ms">${termHtml}${defHtml}${exemploHtml}</article>`;
    })
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function slugify(text) {
  return (
    "term-" +
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

function linkifyText(text, skipTerms = []) {
  let result = escapeHtml(text);
  const skipLower = new Set(skipTerms.map((t) => t.toLowerCase()));
  for (const { term, id } of termLinks) {
    if (skipLower.has(term)) continue;
    const regex = new RegExp(
      "\\b(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b",
      "gi",
    );
    result = result.replace(regex, (match) => {
      if (match.toLowerCase() === term) {
        return `<a href="#${id}" class="term-link">${match}</a>`;
      }
      return match;
    });
  }
  return result;
}

function filterEntries(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return allEntries;

  return allEntries.filter((entry) => {
    const termo = entry.termo.toLowerCase();
    const definicao = entry.definicao.toLowerCase();
    const exemplo = entry.exemplo.toLowerCase();

    if (termo.includes(term)) return true;
    if (definicao.includes(term)) return true;
    if (exemplo.includes(term)) return true;
    return false;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const searchInput = document.getElementById("searchInput");
  let debounceTimer;

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const filtered = filterEntries(searchInput.value);
      renderEntries(filtered, searchInput.value);
    }, 150);
  });
});
