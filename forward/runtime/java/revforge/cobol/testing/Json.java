package revforge.cobol.testing;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Minimal JSON reader for test fixtures: objects, arrays, strings, numbers, booleans, null. */
public final class Json {
  private final String s;
  private int i;

  private Json(String s) {
    this.s = s;
  }

  public static Object parse(String text) {
    final Json j = new Json(text);
    final Object v = j.value();
    j.ws();
    if (j.i != j.s.length()) throw new IllegalArgumentException("trailing JSON at " + j.i);
    return v;
  }

  private void ws() {
    while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
  }

  private Object value() {
    ws();
    final char c = s.charAt(i);
    if (c == '{') {
      i++;
      final Map<String, Object> m = new LinkedHashMap<>();
      ws();
      if (s.charAt(i) == '}') {
        i++;
        return m;
      }
      for (;;) {
        ws();
        final String k = string();
        ws();
        expect(':');
        m.put(k, value());
        ws();
        if (s.charAt(i) == ',') {
          i++;
          continue;
        }
        expect('}');
        return m;
      }
    }
    if (c == '[') {
      i++;
      final List<Object> l = new ArrayList<>();
      ws();
      if (s.charAt(i) == ']') {
        i++;
        return l;
      }
      for (;;) {
        l.add(value());
        ws();
        if (s.charAt(i) == ',') {
          i++;
          continue;
        }
        expect(']');
        return l;
      }
    }
    if (c == '"') return string();
    if (s.startsWith("true", i)) {
      i += 4;
      return Boolean.TRUE;
    }
    if (s.startsWith("false", i)) {
      i += 5;
      return Boolean.FALSE;
    }
    if (s.startsWith("null", i)) {
      i += 4;
      return null;
    }
    final int st = i;
    while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
    if (st == i) throw new IllegalArgumentException("bad JSON at " + i);
    return new java.math.BigDecimal(s.substring(st, i));
  }

  private void expect(char c) {
    if (s.charAt(i) != c) throw new IllegalArgumentException("expected " + c + " at " + i);
    i++;
  }

  private String string() {
    expect('"');
    final StringBuilder b = new StringBuilder();
    for (;;) {
      final char c = s.charAt(i++);
      if (c == '"') return b.toString();
      if (c != '\\') {
        b.append(c);
        continue;
      }
      final char e = s.charAt(i++);
      switch (e) {
        case 'n' -> b.append('\n');
        case 't' -> b.append('\t');
        case 'r' -> b.append('\r');
        case 'b' -> b.append('\b');
        case 'f' -> b.append('\f');
        case 'u' -> {
          b.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
          i += 4;
        }
        default -> b.append(e);
      }
    }
  }
}
