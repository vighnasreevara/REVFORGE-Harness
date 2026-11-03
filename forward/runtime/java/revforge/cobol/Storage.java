package revforge.cobol;

import java.util.Arrays;

/**
 * A COBOL storage area: a byte buffer whose bytes are ISO-8859-1 characters.
 * Data items are views (offset, length) of an area. LINKAGE areas are
 * rebound on every CALL to the caller's argument storage.
 */
public final class Storage {
  byte[] buf;
  int base;
  final int size;
  final String name;

  /** New area of {@code size} bytes. Without a VALUE clause COBOL storage content is not defined; it starts as LOW-VALUES. */
  public Storage(String name, int size) {
    this.name = name;
    this.size = size;
    this.buf = new byte[Math.max(size, 1)];
    this.base = 0;
  }

  /** LINKAGE: this area becomes a view of {@code a} (by reference). */
  public void bind(Area a) {
    if (a.len < size) throw new CobolAbend("LINKAGE", name + " needs " + size + " bytes; the caller passed " + a.len);
    buf = a.st.buf;
    base = a.st.base + a.off;
  }

  /** The whole area as a CALL argument. */
  public Area area() {
    return new Area(this, 0, size);
  }

  public void fill(byte b) {
    Arrays.fill(buf, base, base + size, b);
  }

  public String name() {
    return name;
  }

  public int size() {
    return size;
  }
}
