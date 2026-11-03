package revforge.cobol;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Numeric editing (MOVE to a numeric-edited item), for the picture symbols
 * 9 Z * , . B 0 / and fixed or floating + - $ and trailing CR / DB.
 * The picture is passed expanded (no repetition factors).
 */
public final class Edit {
  private Edit() {}

  public static String format(BigDecimal value, String pic, int len) {
    final boolean neg = value.signum() < 0;
    // Floating insertion: a leading run of 2+ identical $, + or - symbols.
    char fl = 0;
    int flEnd = 0;
    if (pic.length() > 1 && (pic.charAt(0) == '$' || pic.charAt(0) == '+' || pic.charAt(0) == '-') && pic.charAt(1) == pic.charAt(0)) {
      fl = pic.charAt(0);
      flEnd = 1;
      while (flEnd < pic.length() && (pic.charAt(flEnd) == fl || pic.charAt(flEnd) == ',')) flEnd++;
    }
    // Digit positions before and after the decimal point.
    int intPos = 0;
    int decPos = 0;
    boolean afterPoint = false;
    for (int i = 0; i < pic.length(); i++) {
      final char c = pic.charAt(i);
      final boolean digit = c == '9' || c == 'Z' || c == '*' || (fl != 0 && i > 0 && i < flEnd && c == fl);
      if (c == '.' || c == 'V') afterPoint = true;
      else if (digit) {
        if (afterPoint) decPos++;
        else intPos++;
      }
    }
    final BigDecimal a = value.abs().setScale(decPos, RoundingMode.DOWN);
    String ds = a.unscaledValue().toString();
    if (ds.length() > intPos + decPos) ds = ds.substring(ds.length() - (intPos + decPos));
    ds = "0".repeat(intPos + decPos - ds.length()) + ds;
    final boolean allZero = a.signum() == 0;
    final boolean hasNine = pic.indexOf('9') >= 0;
    final StringBuilder out = new StringBuilder();
    int d = 0;
    boolean sig = false;
    int flFirstSig = -1;
    for (int i = 0; i < pic.length(); i++) {
      final char c = pic.charAt(i);
      final boolean inFloat = fl != 0 && i < flEnd;
      if (inFloat) {
        if (i == 0) {
          out.append(' ');
          continue;
        }
        if (c == ',') {
          out.append(sig ? ',' : ' ');
          continue;
        }
        final char dc = ds.charAt(d++);
        if (dc != '0' || sig) {
          if (!sig) flFirstSig = out.length();
          sig = true;
          out.append(dc);
        } else out.append(' ');
        continue;
      }
      if (fl != 0 && i == flEnd && !sig) flFirstSig = out.length();
      switch (c) {
        case '9': {
          if (!sig && fl != 0 && flFirstSig < 0) flFirstSig = out.length();
          sig = true;
          out.append(ds.charAt(d++));
          break;
        }
        case 'Z':
        case '*': {
          final char dc = ds.charAt(d++);
          if (dc != '0' || sig) {
            sig = true;
            out.append(dc);
          } else out.append(c == '*' ? '*' : ' ');
          break;
        }
        case ',':
          out.append(sig ? ',' : (pic.indexOf('*') >= 0 ? '*' : ' '));
          break;
        case '.':
          sig = true;
          out.append('.');
          break;
        case 'V':
          break;
        case 'B':
          out.append(' ');
          break;
        case '0':
        case '/':
          out.append(c);
          break;
        case '+':
          out.append(neg ? '-' : '+');
          break;
        case '-':
          out.append(neg ? '-' : ' ');
          break;
        case '$':
          out.append('$');
          break;
        case 'C':
          if (i + 1 < pic.length() && pic.charAt(i + 1) == 'R') {
            out.append(neg ? "CR" : "  ");
            i++;
            break;
          }
          throw new CobolAbend("EDIT", "unsupported picture symbol C in " + pic);
        case 'D':
          if (i + 1 < pic.length() && pic.charAt(i + 1) == 'B') {
            out.append(neg ? "DB" : "  ");
            i++;
            break;
          }
          throw new CobolAbend("EDIT", "unsupported picture symbol D in " + pic);
        default:
          throw new CobolAbend("EDIT", "unsupported picture symbol " + c + " in " + pic);
      }
    }
    if (fl != 0) {
      // The floating symbol goes immediately left of the first significant character.
      final int at = Math.max(0, (flFirstSig < 0 ? flEndOut(out) : flFirstSig) - 1);
      final char sym = fl == '$' ? '$' : fl == '+' ? (neg ? '-' : '+') : (neg ? '-' : ' ');
      out.setCharAt(at, sym);
    }
    String r = out.toString();
    if (allZero && !hasNine && pic.indexOf('*') < 0 && pic.indexOf('.') < 0) r = " ".repeat(r.length());
    if (r.length() != len) r = r.length() > len ? r.substring(0, len) : r + " ".repeat(len - r.length());
    return r;
  }

  private static int flEndOut(StringBuilder out) {
    for (int i = 0; i < out.length(); i++) if (out.charAt(i) != ' ' && out.charAt(i) != ',') return i;
    return out.length();
  }
}
