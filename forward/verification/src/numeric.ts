/**
 * COBOL data category and permitted Java representations. The same rules are
 * used to prepare F2 worksheets and to reject F2 outputs, so an agent cannot
 * choose a lossy type (float/double, int for large or fractional values).
 */

export type CobolCategory = 'alphanumeric' | 'numeric_display' | 'numeric_binary' | 'numeric_packed' | 'numeric_edited' | 'group' | 'condition' | 'unknown';
export type JavaType = 'String' | 'byte[]' | 'int' | 'long' | 'BigDecimal' | 'BigInteger' | 'Group' | 'Condition';

export interface FieldFacts {
  normalized_type: string | null;
  storage_type: string | null;
  length: number | null;
  decimal_places: number | null;
  is_condition?: boolean;
  is_group?: boolean;
}

export function cobolCategory(f: FieldFacts): CobolCategory {
  if (f.is_condition) return 'condition';
  if (f.is_group) return 'group';
  const t = (f.normalized_type ?? '').toUpperCase();
  const s = (f.storage_type ?? '').toUpperCase();
  if (t === 'STRING') return 'alphanumeric';
  if (t === 'NUMERIC_EDITED') return 'numeric_edited';
  if (['INTEGER', 'SIGNED_INTEGER', 'DECIMAL', 'SIGNED_DECIMAL'].includes(t)) {
    if (s === 'BINARY' || s === 'COMP' || s === 'COMP-5') return 'numeric_binary';
    if (s === 'PACKED_DECIMAL' || s === 'COMP-3') return 'numeric_packed';
    if (s === 'DISPLAY' || s === '') return 'numeric_display';
  }
  return 'unknown';
}

/** Permitted Java types; an empty list means the representation is unsupported and must stay unresolved. */
export function allowedJavaTypes(f: FieldFacts): JavaType[] {
  const c = cobolCategory(f);
  if (c === 'condition') return ['Condition'];
  if (c === 'group') return ['Group'];
  if (c === 'alphanumeric') return ['String', 'byte[]'];
  if (c === 'numeric_edited') return ['String'];
  if (c === 'unknown') return [];
  const digits = f.length ?? 0;
  const decimals = f.decimal_places ?? 0;
  if (digits <= 0) return [];
  if (decimals > 0) return ['BigDecimal'];
  if (digits <= 9) return ['int', 'long', 'BigDecimal', 'BigInteger'];
  if (digits <= 18) return ['long', 'BigDecimal', 'BigInteger'];
  return ['BigDecimal', 'BigInteger'];
}
