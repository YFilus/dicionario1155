import { readFileSync, writeFileSync } from 'fs';

const SHEET_ID = '17PFBtzTPxxinjmkkPuDOFBnwmfuBxKcyhfTFOkBae5Y';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const CSV_FALLBACK = new URL('../db/termos.csv', import.meta.url);
const OUTPUT = new URL('../db/termos.json', import.meta.url);

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
    categoria: row[3] || ''
  }));

  writeFileSync(OUTPUT, JSON.stringify(entries, null, 2), 'utf-8');
  console.log(`Gerado db/termos.json com ${entries.length} termos`);
}

main();
