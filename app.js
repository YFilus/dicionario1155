function splitAlternatives(text) {
  if (!text) return [];
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}

function hasSlashAlternatives(text) {
  return text.includes(' / ');
}

function splitSlashAlternatives(text) {
  return text.split(' / ').map(s => s.trim()).filter(Boolean);
}

function normalizeTerm(text) {
  const alternatives = splitAlternatives(text);
  if (alternatives.length > 1) return alternatives;
  if (hasSlashAlternatives(text)) return splitSlashAlternatives(text);
  return [text];
}

let allEntries = [];
let termLinks = [];

function loadData() {
  fetch('db/termos.json')
    .then(res => res.json())
    .then(data => {
      allEntries = data;

      allEntries.sort((a, b) => {
        const ta = a.termo.split('\n')[0].trim().toLowerCase();
        const tb = b.termo.split('\n')[0].trim().toLowerCase();
        if (ta === 'et') return -1;
        if (tb === 'et') return 1;
        if (ta === '1155') return -1;
        if (tb === '1155') return 1;
        return ta.localeCompare(tb, 'pt-BR');
      });

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

      renderEntries(allEntries, '');
    })
    .catch(err => {
      document.getElementById('entriesContainer').innerHTML =
        '<div class="empty-state">Erro ao carregar os dados.</div>';
    });
}

function renderEntries(entries, searchTerm) {
  const container = document.getElementById('entriesContainer');
  const emptyState = document.getElementById('emptyState');
  const noResultsTerm = document.getElementById('noResultsTerm');

  if (entries.length === 0) {
    container.innerHTML = '';
    noResultsTerm.textContent = searchTerm;
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  container.innerHTML = entries.map(entry => {
    const terms = normalizeTerm(entry.termo);
    const cardId = slugify(terms[0]);
    const definicoes = splitAlternatives(entry.definicao);
    const hasExemplo = entry.exemplo && entry.exemplo.trim().length > 0;

    const termHtml = `<div class="term-alternatives">${
        terms.map((t, i) =>
          (i > 0 ? '<span class="term-sep">ou</span>' : '') +
          `<span class="term-tag">${escapeHtml(t)}</span>`
        ).join('')
      }</div>`;

    const defHtml = definicoes.length > 0
      ? `<div class="entry-definition">${
          definicoes.map(d =>
            `<div class="def-item">${linkifyText(d, terms)}</div>`
          ).join('')
        }</div>`
      : '';

    const exemploHtml = hasExemplo
      ? `<div class="entry-example">${linkifyText(entry.exemplo, terms)}</div>`
      : '';

    return `<article id="${cardId}" class="entry-card">${termHtml}${defHtml}${exemploHtml}</article>`;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function slugify(text) {
  return 'term-' + text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function linkifyText(text, skipTerms = []) {
  let result = escapeHtml(text);
  const skipLower = new Set(skipTerms.map(t => t.toLowerCase()));
  for (const { term, id } of termLinks) {
    if (skipLower.has(term)) continue;
    const regex = new RegExp('\\b(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi');
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

  return allEntries.filter(entry => {
    const termo = entry.termo.toLowerCase();
    const definicao = entry.definicao.toLowerCase();
    const exemplo = entry.exemplo.toLowerCase();

    if (termo.includes(term)) return true;
    if (definicao.includes(term)) return true;
    if (exemplo.includes(term)) return true;
    return false;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();

  const searchInput = document.getElementById('searchInput');
  let debounceTimer;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const filtered = filterEntries(searchInput.value);
      renderEntries(filtered, searchInput.value);
    }, 150);
  });
});
