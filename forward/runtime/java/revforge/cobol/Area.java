package revforge.cobol;

/** A contiguous range of a storage area: a CALL argument or a record. */
public final class Area {
  final Storage st;
  final int off;
  final int len;

  public Area(Storage st, int off, int len) {
    this.st = st;
    this.off = off;
    this.len = len;
  }

  /** BY CONTENT: a private copy, so the callee cannot change the caller's data. */
  public Area copy() {
    final Storage c = new Storage(st.name + "(copy)", len);
    System.arraycopy(st.buf, st.base + off, c.buf, 0, len);
    return c.area();
  }

  public byte[] bytes() {
    final byte[] b = new byte[len];
    System.arraycopy(st.buf, st.base + off, b, 0, len);
    return b;
  }

  public void put(byte[] b) {
    System.arraycopy(b, 0, st.buf, st.base + off, Math.min(b.length, len));
  }

  public int length() {
    return len;
  }
}
