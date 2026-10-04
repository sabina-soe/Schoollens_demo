export type FeeRow = {
  item: string;
  amount: string;
  detail?: string;
};

export type FeeNoteChip = {
  label: string;
  value: string;
};

export type FeeTableModel = {
  chips: FeeNoteChip[];
  notes: string[];
  rows: FeeRow[];
};

const CURRENCY_AMOUNT = /(?:MMK|USD)\s*[\d,]+(?:\.\d+)?/gi;
const LAKHS_AMOUNT = /\d+(?:\.\d+)?\s*lakhs?\s*MMK/gi;

function amountMatches(text: string) {
  const matches = [...text.matchAll(CURRENCY_AMOUNT), ...text.matchAll(LAKHS_AMOUNT)];
  return matches
    .map((match) => ({
      amount: compactAmount(match[0]),
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }))
    .sort((a, b) => a.index - b.index);
}

function compactAmount(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeContext(text: string, amounts: ReturnType<typeof amountMatches>) {
  if (!amounts.length) return true;
  if (/published|announced|issued|describes itself|reviewed annually/i.test(text) && !/\b(fee|tuition|deposit|levy|registration|admission|enrolment|enrollment)\b/i.test(text)) {
    return true;
  }
  return false;
}

function isPolicyNote(text: string, amounts: ReturnType<typeof amountMatches>) {
  return (
    amounts.length === 0 &&
    /does not cover|cash only|reserves the right|valid for|crop is incomplete|without a currency|sibling discount|younger-sibling discount/i.test(text)
  );
}

function splitClauses(text: string) {
  return text
    .split(/\s*;\s*/)
    .flatMap((part) => part.split(/(?<=\.)\s+(?=[A-Z])/))
    .map((part) => part.trim())
    .filter(Boolean);
}

function tidyLabel(value: string) {
  return value
    .replace(/\badmission fee for that slot\b/gi, "")
    .replace(/\b(new\s+)?fees?\s+(is|are)\b/gi, " ")
    .replace(/\b(total\s+)?tuition\s+is\b/gi, " ")
    .replace(/\b(course|school|monthly|annual|yearly|discounted|whole-year|normal)\s+fees?\b/gi, " ")
    .replace(/^admission fees:\s*/i, "Admission — ")
    .replace(/^(and|or)\s+/i, "")
    .replace(/\b(is|are)\s+(listed\s+)?(as|at)\b/gi, " ")
    .replace(/\bplus\b/gi, " + ")
    .replace(/^[,:.\-\s]+|[,:.\-\s]+$/g, "")
    .replace(/\b(is|are|at)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inheritItem(item: string, previous?: FeeRow) {
  if (!previous) return item;
  if (/^(online|on-campus|on campus|full-day|full day|half-day|half day)$/i.test(item)) {
    const base = previous.item.replace(/\s+(on-campus|on campus|online|full-day|full day|half-day|half day)$/i, "");
    return `${base} ${item}`.replace(/\s+/g, " ").trim();
  }
  if (/^rejoined student$/i.test(item)) return "Admission — rejoined student";
  if ((!item || /^admission$/i.test(item)) && /move & groove/i.test(previous.item)) {
    return "Move & Groove admission";
  }
  return item;
}

function rowFromClause(clause: string, amount: string, previous?: FeeRow): FeeRow {
  const withoutAmount = clause.replace(amount, " ").replace(/\s+/g, " ").trim();
  const paren = withoutAmount.match(/\(([^)]+)\)/);
  const detail = paren?.[1]?.trim();
  const rawItem = tidyLabel(withoutAmount.replace(/\s*\([^)]*\)\s*/g, " "));
  return {
    item: inheritItem(rawItem, previous) || "Fee",
    amount,
    detail: detail && !/http/i.test(detail) ? detail : undefined,
  };
}

function rowsFromLakhsSchedule(text: string): FeeRow[] {
  if (!/mmk lakhs/i.test(text)) return [];
  const parts = text.replace(/^.*mmk lakhs\)?:\s*/i, "").split(/\s*;\s*/);
  return parts
    .map((part) => {
      const match = part.match(/^(.*?)(?:\s+is\s+)(\d{1,3}(?:,\d{3})*)\s*$/i);
      if (!match) return null;
      return {
        item: tidyLabel(match[1]) || "Tuition",
        amount: `MMK ${match[2]} lakh`,
      };
    })
    .filter((row): row is FeeRow => Boolean(row));
}

function extractChips(notes: string[]): { chips: FeeNoteChip[]; notes: string[] } {
  const chips: FeeNoteChip[] = [];
  const kept: string[] = [];

  for (const note of notes) {
    const campus = note.match(/\(([^)]+)\)/);
    const dated = note.match(/dated\s+([\d.]+)/i);
    const effective = note.match(/effective\s+([\d.]+)/i);
    if (campus && (dated || effective || /township|road|street|quarter/i.test(campus[1]))) {
      chips.push({ label: "Campus", value: campus[1] });
      if (dated) chips.push({ label: "Announced", value: dated[1].replace(/[.\s]+$/, "") });
      if (effective) chips.push({ label: "Effective", value: effective[1].replace(/[.\s]+$/, "") });
      continue;
    }
    kept.push(note);
  }

  return { chips, notes: kept };
}

export function parseFeeClaims(claims: string[]): FeeTableModel {
  const rawNotes: string[] = [];
  const rows: FeeRow[] = [];

  for (const claim of claims) {
    const lakhsRows = rowsFromLakhsSchedule(claim);
    if (lakhsRows.length) {
      rows.push(...lakhsRows);
      continue;
    }

    const clauses = splitClauses(claim);
    for (const clause of clauses) {
      const amounts = amountMatches(clause);
      if (looksLikeContext(clause, amounts) || isPolicyNote(clause, amounts)) {
        rawNotes.push(clause.replace(/\s+/g, " ").trim());
        continue;
      }

      if (!amounts.length) {
        rawNotes.push(clause.replace(/\s+/g, " ").trim());
        continue;
      }

      if (/including/i.test(clause) && amounts.length >= 2) {
        const leftover = clause.replace(/including[\s\S]*$/i, "").replace(/\s+/g, " ").trim();
        if (leftover) rawNotes.push(leftover.replace(/[,:.\-\s]+$/, ""));
        const crop = clause.match(/\(([^)]*incomplete[^)]*)\)/i);
        if (crop) rawNotes.push(crop[1]);
        const included = clause.replace(/^[\s\S]*including\s+/i, "");
        const scoped = amountMatches(included);
        scoped.forEach((entry, index) => {
          const start = index === 0 ? 0 : scoped[index - 1].end;
          const chunk = included.slice(start, entry.end).replace(/\([^)]*incomplete[^)]*\)/i, "").trim();
          rows.push(rowFromClause(chunk, entry.amount, rows[rows.length - 1]));
        });
        continue;
      }

      if (amounts.length === 1) {
        rows.push(rowFromClause(clause, amounts[0].amount, rows[rows.length - 1]));
        continue;
      }

      amounts.forEach((entry, index) => {
        const start = index === 0 ? 0 : amounts[index - 1].end;
        const chunk = clause.slice(start, entry.end).trim();
        rows.push(rowFromClause(chunk, entry.amount, rows[rows.length - 1]));
      });
    }
  }

  const { chips, notes } = extractChips([...new Set(rawNotes.filter(Boolean))]);
  return { chips, notes, rows };
}
