import { readFileSync, writeFileSync } from 'fs';

const SHEET_ID = '17PFBtzTPxxinjmkkPuDOFBnwmfuBxKcyhfTFOkBae5Y';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const CSV_FALLBACK = new URL('../db/termos.csv', import.meta.url);
const TEMPLATE = new URL('../index.template.html', import.meta.url);
const OUTPUT_HTML = new URL('../index.html', import.meta.url);
const OUTPUT_SITEMAP = new URL('../sitemap.xml', import.meta.url);
const OUTPUT_DATA = new URL('../db/termos.json', import.meta.url);

function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n') {
        current.push(field.trim());
        field = '';
        if (current.some(f => f.length > 0)) {
          rows.push(current);
        }
        current = [];
      } else {
        field += ch;
      }
    }
  }

  if (field.trim() || current.some(f => f.length > 0)) {
    current.push(field.trim());
    rows.push(current);
  }

  return rows;
}

async function fetchCSV() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function readFallback() {
  return readFileSync(CSV_FALLBACK, 'utf-8');
}

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

function slugify(text) {
  return 'term-' + text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTermLinks(entries) {
  const termLinks = [];
  const seen = new Set();
  for (const entry of entries) {
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
  return termLinks;
}

function linkifyText(text, skipTerms, termLinks) {
  let result = escapeHtml(text);
  const skipLower = new Set(skipTerms.map(t => t.toLowerCase()));
  for (const { term, id } of termLinks) {
    if (skipLower.has(term)) continue;
    const regex = new RegExp(
      '\\b(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b',
      'gi',
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

function renderCard(entry, index, termLinks) {
  const terms = normalizeTerm(entry.termo);
  const cardId = slugify(terms[0]);
  const definicoes = splitAlternatives(entry.definicao);
  const hasExemplo = entry.exemplo && entry.exemplo.trim().length > 0;

  const termHtml = terms.map((t, i) =>
    (i > 0 ? '<span class="term-sep">ou</span>' : '') +
    `<span class="term-tag">${escapeHtml(t)}</span>`
  ).join('');

  const defHtml = definicoes.length > 0
    ? `\n      <div class="entry-definition">${definicoes.map(d =>
      `<div class="def-item">${linkifyText(d, terms, termLinks)}</div>`
    ).join('')}</div>`
    : '';

  const exemploHtml = hasExemplo
    ? `\n      <div class="entry-example">${linkifyText(entry.exemplo, terms, termLinks)}</div>`
    : '';

  const delay = Math.min(index * 40, 400);
  return `    <article id="${cardId}" class="entry-card" style="animation-delay:${delay}ms">
      <h2 class="term-alternatives">${termHtml}</h2>${defHtml}${exemploHtml}
    </article>`;
}

function jsonLd(entries) {
  const terms = entries.map(entry => {
    const primary = normalizeTerm(entry.termo)[0];
    const desc = entry.definicao.split('\n')[0].trim();
    return {
      '@type': 'DefinedTerm',
      name: primary,
      description: desc,
    };
  });

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'Dicionário do 1155 do ET',
    description: 'Vocabulário de informática e games do universo ET',
    url: 'https://dicionario1155doet.netlify.app',
    hasDefinedTerm: terms,
  }, null, 2);
}

function buildHTML(entries) {
  const template = readFileSync(TEMPLATE, 'utf-8');
  const termLinks = buildTermLinks(entries);
  const cards = entries.map((e, i) => renderCard(e, i, termLinks)).join('\n');
  const ld = jsonLd(entries);
  const data = JSON.stringify(entries);

  return template
    .replace('{{TERMS}}', cards)
    .replace('{{JSONLD}}', ld)
    .replace('{{DATA}}', data);
}

function buildSitemap() {
  const today = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://dicionario1155doet.netlify.app/</loc>
    <lastmod>${today}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`;
}

async function main() {
  let csvText;

  try {
    csvText = await fetchCSV();
    console.log('Baixado do Google Sheets');
  } catch {
    csvText = readFallback();
    console.log('Falha ao baixar, usou CSV local como fallback');
  }

  const rows = parseCSV(csvText);
  const header = rows[0];
  const entries = rows.slice(1).map(row => ({
    termo: row[0] || '',
    definicao: row[1] || '',
    exemplo: row[2] || '',
    categoria: row[3] || '',
  }));

  entries.sort((a, b) => {
    const ta = a.termo.split('\n')[0].trim().toLowerCase();
    const tb = b.termo.split('\n')[0].trim().toLowerCase();
    if (ta === 'et') return -1;
    if (tb === 'et') return 1;
    if (ta === '1155') return -1;
    if (tb === '1155') return 1;
    return ta.localeCompare(tb, 'pt-BR');
  });

  writeFileSync(OUTPUT_DATA, JSON.stringify(entries, null, 2), 'utf-8');
  console.log(`Gerado db/termos.json com ${entries.length} termos`);

  writeFileSync(OUTPUT_HTML, buildHTML(entries), 'utf-8');
  console.log('Gerado index.html com termos pré-renderizados e JSON-LD');

  writeFileSync(OUTPUT_SITEMAP, buildSitemap(), 'utf-8');
  console.log('Gerado sitemap.xml');
}

main();
