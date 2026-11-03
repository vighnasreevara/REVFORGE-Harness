/**
 * Minimal, deterministic COBOL source reading for independent claim checks:
 * fixed/free-format line handling, data-entry parsing (level, name, PIC,
 * USAGE, OCCURS, REDEFINES, VALUE) and storage-size computation. It reads the
 * original text; it never trusts the reverse artifacts for the facts it checks.
 */

export interface SourceFile {
  path: string;
  lines: string[]; // 1-based access via line(n)
}

export function sourceFile(path: string, text: string): SourceFile {
  return { path, lines: text.replace(/\r\n?/g, '\n').split('\n') };
}

export function line(f: SourceFile, n: number): string | null {
  return n >= 1 && n <= f.lines.length ? f.lines[n - 1] : null;
}

/** Program text of a line: drops the sequence area (cols 1-6) and indicator (col 7) in fixed format; null for comments. */
export function codeText(raw: string): string | null {
  if (raw.trim() === '') return '';
  // Fixed format: columns 1-6 are blank or a numeric sequence area.
  const fixed = raw.length >= 7 && /^[ 0-9]{6}$/.test(raw.slice(0, 6));
  if (fixed) {
    const ind = raw[6];
    if (ind === '*' || ind === '/') return null;
    // A character other than a valid indicator in column 7 means the line is not
    // fixed format (mixed-format source): keep the text rather than drop a letter.
    if (!/[ \-dD$]/.test(ind)) return raw.slice(6);
    return raw.slice(7, 72);
  }
  if (/^\s*\*>/.test(raw) || /^\*/.test(raw)) return null;
  return raw;
}

export interface DataEntry {
  start_line: number;
  end_line: number;
  level: number;
  name: string;
  pic: string | null;
  usage: 'DISPLAY' | 'BINARY' | 'PACKED_DECIMAL' | 'COMP-5' | null;
  occurs: number | null;
  redefines: string | null;
  values: string[];
  text: string;
}

/** Parses the data entry that starts at `start` (continuing to its terminating period). */
export function parseDataEntry(f: SourceFile, start: number): DataEntry | null {
  let text = '';
  let end = start;
  for (let n = start; n <= Math.min(f.lines.length, start + 12); n++) {
    const c = codeText(f.lines[n - 1]);
    if (c === null) continue;
    text += ' ' + c;
    end = n;
    if (/\.\s*$/.test(c.replace(/'[^']*'|"[^"]*"/g, '""'))) break;
  }
  const m = /^\s*(\d{1,2})\s+([A-Z0-9][A-Z0-9-]*)/i.exec(text);
  if (!m) return null;
  const up = text.toUpperCase();
  const pic = /\bPIC(?:TURE)?\s+(?:IS\s+)?([^\s.]+(?:\.[^\s.]+)*)/.exec(up)?.[1]?.replace(/\.$/, '') ?? null;
  let usage: DataEntry['usage'] = null;
  if (/\b(COMP-3|COMPUTATIONAL-3|PACKED-DECIMAL)\b/.test(up)) usage = 'PACKED_DECIMAL';
  else if (/\b(COMP-5|COMPUTATIONAL-5)\b/.test(up)) usage = 'COMP-5';
  else if (/\b(COMP|COMPUTATIONAL|BINARY|COMP-4|COMPUTATIONAL-4)\b/.test(up)) usage = 'BINARY';
  else if (pic) usage = 'DISPLAY';
  const occ = /\bOCCURS\s+(\d+)/.exec(up);
  const red = /\bREDEFINES\s+([A-Z0-9-]+)/.exec(up);
  const values: string[] = [];
  const v = /\bVALUES?\s+(?:ARE\s+|IS\s+)?([\s\S]*?)\.\s*$/.exec(text);
  if (v) for (const lit of v[1].matchAll(/'([^']*)'|"([^"]*)"|([+-]?\d+(?:\.\d+)?)|\b(ZEROS?|ZEROES|SPACES?|HIGH-VALUES?|LOW-VALUES?)\b/gi)) values.push(lit[1] ?? lit[2] ?? lit[3] ?? lit[4]);
  return { start_line: start, end_line: end, level: Number(m[1]), name: m[2].toUpperCase(), pic, usage, occurs: occ ? Number(occ[1]) : null, redefines: red ? red[1] : null, values, text: text.trim() };
}

/** Expands repeat counts: X(3)9(2) -> XXX99. */
export function expandPic(pic: string): string {
  return pic.toUpperCase().replace(/(.)\((\d+)\)/g, (_, c: string, n: string) => c.repeat(Number(n)));
}

export function picFacts(pic: string): { digits: number; decimals: number; signed: boolean; edited: boolean; alnum: boolean; displayLength: number } {
  const e = expandPic(pic);
  const signed = e.includes('S');
  const vIdx = e.indexOf('V');
  const digitsAll = (e.match(/[9P]/g) ?? []).length;
  const decimals = vIdx >= 0 ? (e.slice(vIdx + 1).match(/9/g) ?? []).length : 0;
  const alnum = /[XA]/.test(e);
  const edited = !alnum && /[Z*.,+\-$CRDB0B/]/.test(e.replace(/^S/, ''));
  const displayLength = e.replace(/[SVP]/g, '').length;
  return { digits: alnum ? 0 : edited ? (e.match(/[9Z*]/g) ?? []).length : digitsAll, decimals, signed, edited, alnum, displayLength };
}

/** Storage bytes of an elementary item from its PIC and USAGE. */
export function storageBytes(pic: string, usage: DataEntry['usage']): number {
  const f = picFacts(pic);
  if (usage === 'PACKED_DECIMAL') return Math.floor(f.digits / 2) + 1;
  if (usage === 'BINARY' || usage === 'COMP-5') return f.digits <= 4 ? 2 : f.digits <= 9 ? 4 : 8;
  return f.displayLength;
}

/** Normalises a PIC string for comparison (expands repeats, drops USAGE words). */
export function normPic(pic: string | null): string | null {
  if (!pic) return null;
  return expandPic(pic.toUpperCase().replace(/\s+(COMP(UTATIONAL)?(-\d)?|BINARY|PACKED-DECIMAL|DISPLAY)\b.*$/, '').trim());
}

/** Text of a line range joined, comments removed. */
export function rangeText(f: SourceFile, from: number, to: number): string {
  const out: string[] = [];
  for (let n = Math.max(1, from); n <= Math.min(f.lines.length, to); n++) {
    const c = codeText(f.lines[n - 1]);
    if (c !== null) out.push(c);
  }
  return out.join('\n');
}
