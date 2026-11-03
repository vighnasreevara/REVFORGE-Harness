package revforge.cobol;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.MathContext;
import java.math.RoundingMode;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * COBOL statement semantics shared by all generated programs. Operands are
 * Field, BigDecimal (numeric literal), String (alphanumeric literal) or Fig.
 *
 * Where the language leaves a result undefined the method fails explicitly:
 *   RUNTIME-SIZE-ERROR  an arithmetic result exceeds the receiving item and the
 *                       statement has no ON SIZE ERROR phrase
 *   RUNTIME-TRUNC       a value beyond the PIC digits is moved into a binary item
 *                       (the result depends on the compiler TRUNC option)
 *   S0CB                division by zero without ON SIZE ERROR
 * Alphanumeric comparisons use the EBCDIC (code page 037) collating sequence of
 * the legacy z/OS platform.
 */
public final class Ops {
  private Ops() {}

  /* ------------------------------------------------------------ collation */

  private static final int[] RANK = new int[256];
  static {
    final Charset ebcdic = Charset.forName("IBM037");
    for (int i = 0; i < 256; i++) {
      final byte[] e = String.valueOf((char) i).getBytes(ebcdic);
      RANK[i] = e.length == 1 ? e[0] & 0xFF : 0x6F;
    }
  }

  /** Byte order of the EBCDIC collating sequence. */
  public static int rank(int isoChar) {
    return RANK[isoChar & 0xFF];
  }

  public static int compareText(String a, String b) {
    final int n = Math.max(a.length(), b.length());
    for (int i = 0; i < n; i++) {
      final int x = i < a.length() ? a.charAt(i) & 0xFF : ' ';
      final int y = i < b.length() ? b.charAt(i) & 0xFF : ' ';
      if (x != y) return Integer.compare(RANK[x], RANK[y]);
    }
    return 0;
  }

  /* ------------------------------------------------------------ operands */

  static boolean numericOperand(Object o) {
    return (o instanceof Field f && f.isNumeric()) || o instanceof BigDecimal || o == Fig.ZERO;
  }

  /** Numeric value of an operand used arithmetically. */
  public static BigDecimal num(Object o) {
    if (o instanceof BigDecimal d) return d;
    if (o instanceof Field f) {
      if (f.isNumeric()) return f.value();
      throw new CobolAbend("S0C7", f.name + " is not a numeric item");
    }
    if (o == Fig.ZERO) return BigDecimal.ZERO;
    throw new CobolAbend("S0C7", o + " is not numeric");
  }

  /** Alphanumeric form of an operand of length {@code n} for figurative constants. */
  static String text(Object o, int n) {
    if (o instanceof String s) return s;
    if (o instanceof Fig g) return g.repeat(Math.max(n, 1));
    if (o instanceof BigDecimal d) return d.abs().unscaledValue().toString();
    final Field f = (Field) o;
    return f.kind == Field.Kind.BINARY || f.kind == Field.Kind.PACKED ? f.digitsText() : f.raw();
  }

  static int lengthOf(Object o) {
    if (o instanceof Field f) return f.len;
    if (o instanceof String s) return s.length();
    if (o instanceof BigDecimal d) return d.abs().unscaledValue().toString().length();
    return 1;
  }

  /* ------------------------------------------------------------ MOVE */

  /** MOVE src TO dst, where no gap applies to alphanumeric content moved into a numeric item. */
  public static void move(Object src, Field dst) {
    move(src, dst, null);
  }

  /**
   * MOVE src TO dst. {@code gapId} names the preserved gap for an alphanumeric
   * sender and a numeric receiver: only all-digit content (an unsigned integer)
   * is defined; anything else blocks the path.
   */
  public static void move(Object src, Field dst, String gapId) {
    dst.requireElement();
    final boolean group = dst.kind == Field.Kind.GROUP || (src instanceof Field f && f.kind == Field.Kind.GROUP);
    if (group || dst.kind == Field.Kind.ALNUM) {
      if (src instanceof Field f && f.kind != Field.Kind.GROUP && f.isNumeric() && !group) {
        dst.setRaw(f.digitsText());
        return;
      }
      if (src instanceof Field f) {
        dst.setBytes(f.bytes());
        return;
      }
      dst.setRaw(text(src, dst.len));
      return;
    }
    // Numeric or numeric-edited receiver.
    final BigDecimal v;
    if (numericOperand(src)) v = num(src);
    else if (src instanceof Field f && f.kind == Field.Kind.EDITED) throw UnresolvedGapException.blocked(gapId == null ? "RUNTIME-DE-EDIT" : gapId, "MOVE of numeric-edited " + f.name + " to " + dst.name + " (de-editing)");
    else if (src instanceof Fig g) throw new IllegalStateException("MOVE " + g + " to numeric " + dst.name + " is not a defined move");
    else {
      final String s = text(src, dst.len);
      if (s.isEmpty() || !s.chars().allMatch(c -> c >= '0' && c <= '9')) {
        throw UnresolvedGapException.blocked(gapId == null ? "RUNTIME-ALNUM-TO-NUMERIC" : gapId, "alphanumeric to numeric MOVE into " + dst.name + " of content that is not all digits");
      }
      v = new BigDecimal(new BigInteger(s));
    }
    storeTruncated(dst, v);
  }

  /** MOVE semantics: low-order decimals and high-order integer digits are truncated (binary: TRUNC dependent). */
  static void storeTruncated(Field dst, BigDecimal v) {
    BigDecimal x = v.setScale(dst.kind == Field.Kind.EDITED ? Math.max(v.scale(), 0) : dst.scale, RoundingMode.DOWN);
    if (dst.kind == Field.Kind.EDITED) {
      dst.setRaw(Edit.format(x, dst.edit, dst.len));
      return;
    }
    final BigDecimal limit = Field.pow10(dst.digits - dst.scale);
    if (x.abs().compareTo(limit) >= 0) {
      if (dst.kind == Field.Kind.BINARY) throw UnresolvedGapException.blocked("RUNTIME-TRUNC", "a value of " + x.abs().precision() + " digits moved into binary " + dst.name + " PIC " + dst.digits + " digits (compiler TRUNC option)");
      x = x.remainder(limit);
    }
    dst.store(x);
  }

  /** INITIALIZE: alphanumeric items to spaces, numeric items to zero. */
  public static void initialize(Field... items) {
    for (Field f : items) {
      if (f.isNumeric() || f.kind == Field.Kind.EDITED) storeTruncated(f, BigDecimal.ZERO);
      else f.fill(' ');
    }
  }

  /** INITIALIZE ... REPLACING category DATA BY value. */
  public static void initializeReplacing(Field f, Object alnumBy, Object numericBy) {
    if ((f.isNumeric() || f.kind == Field.Kind.EDITED)) {
      if (numericBy != null) move(numericBy, f);
      else initialize(f);
    } else if (alnumBy != null) move(alnumBy, f);
    else initialize(f);
  }

  /* ------------------------------------------------------------ conditions */

  public static int compare(Object a, Object b) {
    if (numericOperand(a) && numericOperand(b)) return num(a).compareTo(num(b));
    final int n = Math.max(lengthOf(a), lengthOf(b));
    return compareText(text(a, n), text(b, n));
  }

  public static boolean eq(Object a, Object b) {
    return compare(a, b) == 0;
  }

  public static boolean isNumeric(Object o) {
    if (o instanceof Field f) return f.isNumericClass();
    return o instanceof BigDecimal;
  }

  public static boolean isAlphabetic(Object o) {
    if (o instanceof Field f) return f.isAlphabeticClass();
    return o instanceof String s && s.chars().allMatch(c -> c == ' ' || Character.isLetter(c));
  }

  /** Sign condition: POSITIVE (1), NEGATIVE (-1), ZERO (0). */
  public static int sign(Object o) {
    return num(o).signum();
  }

  /* ------------------------------------------------------------ arithmetic */

  private static final MathContext MC = new MathContext(34, RoundingMode.DOWN);

  public static BigDecimal add(BigDecimal a, BigDecimal b) {
    return a == null || b == null ? null : a.add(b);
  }

  public static BigDecimal sub(BigDecimal a, BigDecimal b) {
    return a == null || b == null ? null : a.subtract(b);
  }

  public static BigDecimal mul(BigDecimal a, BigDecimal b) {
    return a == null || b == null ? null : a.multiply(b);
  }

  /** Division; {@code null} (a size error) for division by zero. */
  public static BigDecimal div(BigDecimal a, BigDecimal b) {
    if (a == null || b == null || b.signum() == 0) return null;
    return a.divide(b, MC);
  }

  public static BigDecimal neg(BigDecimal a) {
    return a == null ? null : a.negate();
  }

  public static BigDecimal pow(BigDecimal a, BigDecimal b) {
    if (a == null || b == null) return null;
    if (b.stripTrailingZeros().scale() > 0) throw UnresolvedGapException.blocked("RUNTIME-FRACTIONAL-POWER", "exponentiation with a non-integer exponent");
    final int e = b.intValueExact();
    return e >= 0 ? a.pow(e) : div(BigDecimal.ONE, a.pow(-e));
  }

  /**
   * Stores an arithmetic result. Returns false when a size error occurred
   * and the statement handles it (the receiving item is unchanged); without
   * an ON SIZE ERROR phrase a size error blocks the path.
   */
  public static boolean store(Field t, BigDecimal v, boolean rounded, boolean onSizeError) {
    t.requireElement();
    if (v == null) {
      if (onSizeError) return false;
      throw new CobolAbend("S0CB", "division by zero for " + t.name + " without ON SIZE ERROR");
    }
    final int sc = t.kind == Field.Kind.EDITED ? Math.max(0, editScale(t.edit)) : t.scale;
    final BigDecimal r = v.setScale(sc, rounded ? RoundingMode.HALF_UP : RoundingMode.DOWN);
    final int intDigits = t.kind == Field.Kind.EDITED ? editIntDigits(t.edit) : t.digits - t.scale;
    if (r.abs().compareTo(Field.pow10(intDigits)) >= 0) {
      if (onSizeError) return false;
      throw UnresolvedGapException.blocked("RUNTIME-SIZE-ERROR", "result " + r.toPlainString() + " exceeds " + t.name + " and the statement has no ON SIZE ERROR phrase");
    }
    if (t.kind == Field.Kind.EDITED) t.setRaw(Edit.format(r, t.edit, t.len));
    else t.store(t.signed ? r : r.abs());
    return true;
  }

  static int editScale(String pic) {
    final int p = Math.max(pic.indexOf('.'), pic.indexOf('V'));
    if (p < 0) return 0;
    int n = 0;
    for (int i = p + 1; i < pic.length(); i++) if ("9Z*".indexOf(pic.charAt(i)) >= 0) n++;
    return n;
  }

  static int editIntDigits(String pic) {
    int p = Math.max(pic.indexOf('.'), pic.indexOf('V'));
    if (p < 0) p = pic.length();
    int n = 0;
    boolean first = true;
    for (int i = 0; i < p; i++) {
      final char c = pic.charAt(i);
      if ("9Z*".indexOf(c) >= 0) n++;
      else if ((c == '$' || c == '+' || c == '-') && i + 1 < p && pic.charAt(i + 1) == c) {
        if (!first) n++;
        first = false;
      } else if ((c == '$' || c == '+' || c == '-') && !first) n++;
    }
    return n;
  }

  /** DIVIDE ... GIVING q REMAINDER r: the remainder uses the quotient as stored. */
  public static boolean remainder(Field r, BigDecimal dividend, BigDecimal divisor, Field quotient, boolean onSizeError) {
    if (divisor.signum() == 0) return store(r, null, false, onSizeError);
    return store(r, dividend.subtract(quotient.value().multiply(divisor)), false, onSizeError);
  }

  /* ------------------------------------------------------------ STRING */

  /**
   * STRING srcs DELIMITED BY delims INTO into [WITH POINTER ptr]. A null
   * delimiter means DELIMITED BY SIZE. Returns true on overflow.
   */
  public static boolean string(Field into, Field pointer, Object[] srcs, Object[] delims) {
    int p = pointer == null ? 1 : num(pointer).intValueExact();
    if (p < 1 || p > into.len) return true;
    final StringBuilder cur = new StringBuilder(into.raw());
    boolean overflow = false;
    outer:
    for (int k = 0; k < srcs.length; k++) {
      String s = text(srcs[k], 1);
      if (delims[k] != null) {
        final String d = text(delims[k], 1);
        final int at = s.indexOf(d);
        if (at >= 0) s = s.substring(0, at);
      }
      for (int i = 0; i < s.length(); i++) {
        if (p > into.len) {
          overflow = true;
          break outer;
        }
        cur.setCharAt(p - 1, s.charAt(i));
        p++;
      }
    }
    into.setRaw(cur.toString());
    if (pointer != null) storeTruncated(pointer, BigDecimal.valueOf(p));
    return overflow;
  }

  /* ------------------------------------------------------------ DISPLAY */

  public static String display(Object... items) {
    final StringBuilder b = new StringBuilder();
    for (Object o : items) {
      if (o instanceof Field f) b.append(f.displayText());
      else if (o instanceof BigDecimal d) b.append(d.toPlainString());
      else if (o instanceof Fig g) b.append(g.repeat(1));
      else b.append(o);
    }
    return b.toString();
  }

  /* ------------------------------------------------------------ intrinsic functions */

  /** FUNCTION CURRENT-DATE: YYYYMMDDHHMMSShh followed by the UTC offset +hhmm. */
  public static String currentDate(RunUnit ru) {
    final java.time.ZonedDateTime t = ru.clock.now();
    final int off = t.getOffset().getTotalSeconds() / 60;
    return String.format("%04d%02d%02d%02d%02d%02d%02d%s%02d%02d", t.getYear(), t.getMonthValue(), t.getDayOfMonth(), t.getHour(), t.getMinute(), t.getSecond(), t.getNano() / 10_000_000, off < 0 ? "-" : "+", Math.abs(off) / 60, Math.abs(off) % 60);
  }

  /** FUNCTION NUMVAL: leading/trailing spaces, an optional sign (+, -, CR, DB) and one decimal point. */
  public static BigDecimal numval(Object o) {
    String s = text(o, 1).trim();
    boolean neg = false;
    if (s.endsWith("CR") || s.endsWith("DB")) {
      neg = true;
      s = s.substring(0, s.length() - 2).trim();
    } else if (s.startsWith("-") || s.endsWith("-")) {
      neg = true;
      s = s.startsWith("-") ? s.substring(1).trim() : s.substring(0, s.length() - 1).trim();
    } else if (s.startsWith("+") || s.endsWith("+")) s = s.startsWith("+") ? s.substring(1).trim() : s.substring(0, s.length() - 1).trim();
    if (!s.matches("\\d*\\.?\\d*") || s.isEmpty() || s.equals(".")) throw UnresolvedGapException.blocked("RUNTIME-NUMVAL", "FUNCTION NUMVAL of '" + text(o, 1) + "' (not a valid numeric string)");
    final BigDecimal v = new BigDecimal(s.startsWith(".") ? "0" + s : s.endsWith(".") ? s + "0" : s);
    return neg ? v.negate() : v;
  }

  public static String upper(Object o) {
    return text(o, 1).toUpperCase(java.util.Locale.ROOT);
  }

  public static String lower(Object o) {
    return text(o, 1).toLowerCase(java.util.Locale.ROOT);
  }

  public static BigDecimal length(Object o) {
    return BigDecimal.valueOf(lengthOf(o));
  }

  /** Reference modification of a literal or function result. */
  public static String substr(Object o, int start, int len) {
    final String s = text(o, 1);
    if (start < 1 || start - 1 + len > s.length() || len < 1) throw new CobolAbend("REFMOD", "(" + start + ":" + len + ") outside 1.." + s.length());
    return s.substring(start - 1, start - 1 + len);
  }

  public static byte[] latin1(String s) {
    return s.getBytes(StandardCharsets.ISO_8859_1);
  }
}
