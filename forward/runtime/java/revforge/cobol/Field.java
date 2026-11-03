package revforge.cobol;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;

/**
 * A data item: a typed view of bytes in a storage area.
 *
 * Representations (the legacy platform is IBM z/OS, established by the JCL,
 * VSAM and CICS evidence; character data is held as ISO-8859-1):
 *   ALNUM / GROUP   characters
 *   DISPLAY         zoned decimal, one digit per byte; a signed item without
 *                   SEPARATE carries the sign in the last (or first, LEADING)
 *                   byte as the EBCDIC overpunch letter ({ A-I positive, } J-R
 *                   negative); SIGN SEPARATE uses '+' / '-'
 *   BINARY          big-endian two's complement in 2, 4 or 8 bytes
 *   PACKED          packed decimal, sign nibble C (+), D (-), F (unsigned)
 *   EDITED          numeric-edited characters (see {@link Edit})
 * Reading invalid numeric data raises S0C7 instead of guessing a value.
 */
public final class Field {
  public enum Kind { ALNUM, GROUP, DISPLAY, BINARY, PACKED, EDITED }

  final Storage st;
  final int off;
  public final int len;
  public final Kind kind;
  public final int digits;
  public final int scale;
  public final boolean signed;
  final boolean signSep;
  final boolean signLead;
  final String edit;
  public final String name;
  final int[] occ;
  final int[] stride;

  public Field(Storage st, int off, int len, Kind kind, int digits, int scale, boolean signed, boolean signSep, boolean signLead, String edit, String name, int[] occ, int[] stride) {
    this.st = st;
    this.off = off;
    this.len = len;
    this.kind = kind;
    this.digits = digits;
    this.scale = scale;
    this.signed = signed;
    this.signSep = signSep;
    this.signLead = signLead;
    this.edit = edit;
    this.name = name;
    this.occ = occ;
    this.stride = stride;
  }

  private static final int[] NONE = new int[0];

  public static Field alnum(Storage st, int off, int len, String name) {
    return new Field(st, off, len, Kind.ALNUM, 0, 0, false, false, false, null, name, NONE, NONE);
  }

  public static Field group(Storage st, int off, int len, String name) {
    return new Field(st, off, len, Kind.GROUP, 0, 0, false, false, false, null, name, NONE, NONE);
  }

  /** This item inside OCCURS tables: one (count, stride) per enclosing OCCURS, outermost first. */
  public Field occurs(int[] counts, int[] strides) {
    return new Field(st, off, len, kind, digits, scale, signed, signSep, signLead, edit, name, counts, strides);
  }

  public boolean isNumeric() {
    return kind == Kind.DISPLAY || kind == Kind.BINARY || kind == Kind.PACKED;
  }

  /** One table element: subscripts are 1-based; out of range is an abend, never a wrapped access. */
  public Field at(int... idx) {
    if (idx.length != occ.length) throw new CobolAbend("SUBSCRIPT", name + " needs " + occ.length + " subscript(s), got " + idx.length);
    int o = off;
    for (int k = 0; k < idx.length; k++) {
      if (idx[k] < 1 || idx[k] > occ[k]) throw new CobolAbend("SUBSCRIPT", name + "(" + idx[k] + ") is outside 1.." + occ[k]);
      o += (idx[k] - 1) * stride[k];
    }
    return new Field(st, o, len, kind, digits, scale, signed, signSep, signLead, edit, name, NONE, NONE);
  }

  /** Reference modification (start:length), an alphanumeric view. */
  public Field ref(int start, int length) {
    requireElement();
    if (start < 1 || start > len || length < 1 || start - 1 + length > len) throw new CobolAbend("REFMOD", name + "(" + start + ":" + length + ") is outside 1.." + len);
    return alnum(st, off + start - 1, length, name + "(" + start + ":" + length + ")");
  }

  public Field ref(int start) {
    return ref(start, len - start + 1);
  }

  void requireElement() {
    if (occ.length > 0) throw new CobolAbend("SUBSCRIPT", name + " is a table item used without a subscript");
  }

  public Area area() {
    requireElement();
    return new Area(st, off, len);
  }

  /* ---------------------------------------------------------------- raw bytes */

  byte b(int i) {
    return st.buf[st.base + off + i];
  }

  void put(int i, int v) {
    st.buf[st.base + off + i] = (byte) v;
  }

  public String raw() {
    requireElement();
    return new String(st.buf, st.base + off, len, StandardCharsets.ISO_8859_1);
  }

  public byte[] bytes() {
    requireElement();
    final byte[] r = new byte[len];
    System.arraycopy(st.buf, st.base + off, r, 0, len);
    return r;
  }

  /** Stores characters left-justified, space-padded, truncated on the right. */
  public void setRaw(String s) {
    requireElement();
    for (int i = 0; i < len; i++) put(i, i < s.length() ? s.charAt(i) : ' ');
  }

  public void setBytes(byte[] v) {
    requireElement();
    for (int i = 0; i < len; i++) put(i, i < v.length ? v[i] : ' ');
  }

  public void fill(int b) {
    requireElement();
    for (int i = 0; i < len; i++) put(i, b);
  }

  /* ---------------------------------------------------------------- numeric */

  private static final BigDecimal[] POW = new BigDecimal[40];
  static {
    for (int i = 0; i < POW.length; i++) POW[i] = BigDecimal.TEN.pow(i);
  }

  static BigDecimal pow10(int n) {
    return POW[n];
  }

  /** The numeric value; invalid content is S0C7. */
  public BigDecimal value() {
    requireElement();
    switch (kind) {
      case DISPLAY:
        return zoned();
      case BINARY: {
        BigInteger v = new BigInteger(bytes());
        if (!signed && v.signum() < 0) v = v.add(BigInteger.ONE.shiftLeft(8 * len));
        return new BigDecimal(v, scale);
      }
      case PACKED:
        return packed();
      default:
        throw new CobolAbend("S0C7", name + " is not numeric (" + kind + ")");
    }
  }

  private BigDecimal zoned() {
    final StringBuilder d = new StringBuilder(digits);
    int sign = 1;
    int first = 0;
    int last = len - 1;
    if (signed && signSep) {
      final int sc = signLead ? b(0) : b(len - 1);
      if (sc == '-') sign = -1;
      else if (sc != '+') throw new CobolAbend("S0C7", name + " has no valid separate sign");
      if (signLead) first = 1;
      else last = len - 2;
    }
    for (int i = first; i <= last; i++) {
      final int c = b(i) & 0xFF;
      final boolean signByte = signed && !signSep && (signLead ? i == first : i == last);
      if (c >= '0' && c <= '9') d.append((char) c);
      else if (signByte && c == '{') d.append('0');
      else if (signByte && c >= 'A' && c <= 'I') d.append((char) ('1' + c - 'A'));
      else if (signByte && c == '}') {
        d.append('0');
        sign = -1;
      } else if (signByte && c >= 'J' && c <= 'R') {
        d.append((char) ('1' + c - 'J'));
        sign = -1;
      } else throw new CobolAbend("S0C7", name + " contains non-numeric data '" + raw() + "'");
    }
    final BigDecimal v = new BigDecimal(new BigInteger(d.toString()), scale);
    return sign < 0 ? v.negate() : v;
  }

  private BigDecimal packed() {
    final StringBuilder d = new StringBuilder();
    for (int i = 0; i < len; i++) {
      final int c = b(i) & 0xFF;
      final int hi = c >> 4;
      final int lo = c & 0xF;
      if (hi > 9) throw new CobolAbend("S0C7", name + " contains invalid packed data");
      d.append((char) ('0' + hi));
      if (i < len - 1) {
        if (lo > 9) throw new CobolAbend("S0C7", name + " contains invalid packed data");
        d.append((char) ('0' + lo));
      } else if (lo < 0xA) throw new CobolAbend("S0C7", name + " has no valid packed sign");
      else if (lo == 0xB || lo == 0xD) d.insert(0, '-');
    }
    return new BigDecimal(new BigInteger(d.toString()), scale);
  }

  /** Stores a value that already fits (scale and digits); the sign is dropped for unsigned items. */
  public void store(BigDecimal v) {
    requireElement();
    BigDecimal x = v.setScale(scale, java.math.RoundingMode.DOWN);
    if (!signed) x = x.abs();
    if (x.abs().compareTo(pow10(digits - scale)) >= 0) throw new IllegalStateException(name + ": value " + v + " does not fit PIC digits " + digits);
    final BigInteger u = x.unscaledValue();
    switch (kind) {
      case DISPLAY: {
        String ds = u.abs().toString();
        ds = "0".repeat(digits - ds.length()) + ds;
        final boolean neg = u.signum() < 0;
        if (signed && signSep) {
          final String s = (neg ? "-" : "+");
          final String all = signLead ? s + ds : ds + s;
          for (int i = 0; i < len; i++) put(i, all.charAt(i));
        } else {
          for (int i = 0; i < len; i++) put(i, ds.charAt(i));
          if (signed) {
            final int at = signLead ? 0 : len - 1;
            final int dig = ds.charAt(at) - '0';
            put(at, neg ? (dig == 0 ? '}' : 'J' + dig - 1) : (dig == 0 ? '{' : 'A' + dig - 1));
          }
        }
        return;
      }
      case BINARY: {
        final byte[] raw = u.toByteArray();
        final int pad = u.signum() < 0 ? 0xFF : 0;
        for (int i = 0; i < len; i++) {
          final int k = raw.length - len + i;
          put(i, k < 0 ? pad : raw[k]);
        }
        return;
      }
      case PACKED: {
        final int nd = len * 2 - 1;
        String ds = u.abs().toString();
        ds = "0".repeat(nd - ds.length()) + ds;
        final int sn = !signed ? 0xF : u.signum() < 0 ? 0xD : 0xC;
        for (int i = 0; i < len; i++) {
          final int hi = ds.charAt(2 * i) - '0';
          final int lo = i < len - 1 ? ds.charAt(2 * i + 1) - '0' : sn;
          put(i, (hi << 4) | lo);
        }
        return;
      }
      case EDITED:
        setRaw(Edit.format(x, edit, len));
        return;
      default:
        throw new IllegalStateException(name + " is not numeric");
    }
  }

  /** Digits as a DISPLAY item would hold them, unsigned (numeric to alphanumeric MOVE, DISPLAY of binary/packed). */
  String digitsText() {
    final BigDecimal v = value().abs();
    final String ds = v.unscaledValue().toString();
    return "0".repeat(Math.max(0, digits - ds.length())) + ds;
  }

  /** Display form for DISPLAY: the stored characters, or digits with a sign for binary and packed items. */
  public String displayText() {
    if (kind == Kind.BINARY || kind == Kind.PACKED) {
      final BigDecimal v = value();
      final String ds = digitsText();
      return (signed && v.signum() < 0 ? "-" : "") + ds;
    }
    return raw();
  }

  /** The NUMERIC class test. */
  public boolean isNumericClass() {
    requireElement();
    switch (kind) {
      case DISPLAY:
      case PACKED:
        try {
          value();
          return true;
        } catch (CobolAbend e) {
          return false;
        }
      case BINARY:
        return true;
      default:
        for (int i = 0; i < len; i++) {
          final int c = b(i) & 0xFF;
          if (c < '0' || c > '9') return false;
        }
        return true;
    }
  }

  /** The ALPHABETIC class test (letters and spaces). */
  public boolean isAlphabeticClass() {
    final String s = raw();
    for (int i = 0; i < s.length(); i++) {
      final char c = s.charAt(i);
      if (c != ' ' && !(c >= 'A' && c <= 'Z') && !(c >= 'a' && c <= 'z')) return false;
    }
    return true;
  }

  @Override
  public String toString() {
    return name;
  }
}
