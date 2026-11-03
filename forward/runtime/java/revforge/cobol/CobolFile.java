package revforge.cobol;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * A COBOL file (FD) with its record area and FILE STATUS.
 *
 * External formats: a sequential RECFM F dataset is a sequence of fixed-length
 * records without delimiters; RECFM V records carry a 4-byte record descriptor
 * word (length including the RDW, two zero bytes). An indexed (VSAM KSDS) file
 * is stored as its fixed-length records; keys are ordered by the EBCDIC
 * collating sequence. A DD name is resolved through the run unit's dataset
 * table; a missing dataset gives status 35 on OPEN INPUT / I-O.
 * File status codes follow the COBOL standard (00, 02, 10, 21, 22, 23, 35,
 * 41-49). The program reacts to them; no status is invented.
 */
public final class CobolFile {
  public enum Org { SEQUENTIAL, INDEXED }

  public enum Access { SEQUENTIAL, RANDOM, DYNAMIC }

  public enum Mode { INPUT, OUTPUT, IO, EXTEND }

  final RunUnit ru;
  public final String name;
  public final String dd;
  final Org org;
  final Access access;
  final Storage area;
  final int recLen;
  final boolean variable;
  final int keyOff;
  final int keyLen;
  Field status;

  Mode mode;
  Path path;
  String st = "00";
  // sequential
  List<byte[]> recs;
  int pos;
  boolean eof;
  int lastRead = -1;
  // indexed
  TreeMap<String, byte[]> map;
  String posKey;
  boolean posInclusive;
  String lastKey;

  public CobolFile(RunUnit ru, String name, String dd, Org org, Access access, Storage area, int recLen, boolean variable, int keyOff, int keyLen) {
    this.ru = ru;
    this.name = name;
    this.dd = dd;
    this.org = org;
    this.access = access;
    this.area = area;
    this.recLen = recLen;
    this.variable = variable;
    this.keyOff = keyOff;
    this.keyLen = keyLen;
  }

  /** FILE STATUS IS item. */
  public CobolFile status(Field f) {
    this.status = f;
    return this;
  }

  public int recordLength() {
    return recLen;
  }

  public boolean isVariable() {
    return variable;
  }

  public String fileStatus() {
    return st;
  }

  public boolean atEnd() {
    return st.equals("10");
  }

  public boolean invalidKey() {
    return st.charAt(0) == '2';
  }

  public boolean ok() {
    return st.charAt(0) == '0';
  }

  private void set(String s) {
    st = s;
    if (status != null) status.setRaw(s);
  }

  /* ---------------------------------------------------------------- OPEN / CLOSE */

  public void open(Mode m) {
    if (mode != null) {
      set("41");
      return;
    }
    path = ru.dataset(dd);
    final boolean exists = path != null && Files.exists(path);
    if ((m == Mode.INPUT || m == Mode.IO) && !exists) {
      set("35");
      return;
    }
    if (path == null) {
      set("35");
      return;
    }
    try {
      final List<byte[]> loaded = m == Mode.OUTPUT || !exists ? new ArrayList<>() : load(Files.readAllBytes(path));
      if (org == Org.INDEXED) {
        map = new TreeMap<>(Ops::compareText);
        for (byte[] r : loaded) map.put(key(r), r);
        posKey = null;
        posInclusive = true;
      } else {
        recs = loaded;
        pos = m == Mode.EXTEND ? recs.size() : 0;
      }
    } catch (IOException e) {
      set("30");
      return;
    }
    mode = m;
    eof = false;
    lastRead = -1;
    lastKey = null;
    ru.opened(this);
    set("00");
  }

  public void close() {
    if (mode == null) {
      set("42");
      return;
    }
    try {
      flush();
    } catch (IOException e) {
      mode = null;
      set("30");
      return;
    }
    mode = null;
    ru.closed(this);
    set("00");
  }

  /** Writes the dataset back (OUTPUT, EXTEND, I-O). */
  void flush() throws IOException {
    if (mode == Mode.INPUT) return;
    final ByteArrayOutputStream o = new ByteArrayOutputStream();
    final Iterable<byte[]> all = org == Org.INDEXED ? map.values() : recs;
    for (byte[] r : all) {
      if (variable) {
        final int n = r.length + 4;
        o.write(n >> 8);
        o.write(n & 0xFF);
        o.write(0);
        o.write(0);
      }
      o.write(r);
    }
    if (path.getParent() != null) Files.createDirectories(path.getParent());
    Files.write(path, o.toByteArray());
  }

  private List<byte[]> load(byte[] all) {
    final List<byte[]> out = new ArrayList<>();
    int i = 0;
    if (variable) {
      while (i + 4 <= all.length) {
        final int n = ((all[i] & 0xFF) << 8) | (all[i + 1] & 0xFF);
        if (n < 4 || i + n > all.length) throw new CobolAbend("FILE", name + ": invalid record descriptor word at byte " + i);
        final byte[] r = new byte[n - 4];
        System.arraycopy(all, i + 4, r, 0, n - 4);
        out.add(r);
        i += n;
      }
      return out;
    }
    if (all.length % recLen != 0) throw new CobolAbend("FILE", name + ": dataset length " + all.length + " is not a multiple of the record length " + recLen);
    for (; i < all.length; i += recLen) {
      final byte[] r = new byte[recLen];
      System.arraycopy(all, i, r, 0, recLen);
      out.add(r);
    }
    return out;
  }

  private String key(byte[] r) {
    return new String(r, keyOff, keyLen, java.nio.charset.StandardCharsets.ISO_8859_1);
  }

  private String areaKey() {
    return new String(area.buf, area.base + keyOff, keyLen, java.nio.charset.StandardCharsets.ISO_8859_1);
  }

  private void toArea(byte[] r) {
    area.fill((byte) ' ');
    System.arraycopy(r, 0, area.buf, area.base, Math.min(r.length, area.size));
  }

  private byte[] fromArea(int len) {
    final byte[] r = new byte[variable ? len : recLen];
    java.util.Arrays.fill(r, (byte) ' ');
    System.arraycopy(area.buf, area.base, r, 0, Math.min(len, r.length));
    return r;
  }

  /* ---------------------------------------------------------------- READ / START */

  /** READ ... NEXT (sequential retrieval). */
  public void readNext() {
    if (mode != Mode.INPUT && mode != Mode.IO) {
      set("47");
      return;
    }
    if (eof) {
      set("46");
      return;
    }
    if (org == Org.SEQUENTIAL) {
      if (pos >= recs.size()) {
        eof = true;
        set("10");
        return;
      }
      lastRead = pos;
      toArea(recs.get(pos++));
      set("00");
      return;
    }
    final Map.Entry<String, byte[]> e = posKey == null ? map.firstEntry() : posInclusive ? map.ceilingEntry(posKey) : map.higherEntry(posKey);
    if (e == null) {
      eof = true;
      set("10");
      return;
    }
    toArea(e.getValue());
    lastKey = e.getKey();
    posKey = e.getKey();
    posInclusive = false;
    set("00");
  }

  /** READ without NEXT: by key for indexed files in random or dynamic access, otherwise sequential. */
  public void read() {
    if (org == Org.SEQUENTIAL || access == Access.SEQUENTIAL) {
      readNext();
      return;
    }
    if (mode != Mode.INPUT && mode != Mode.IO) {
      set("47");
      return;
    }
    final String k = areaKey();
    final byte[] r = map.get(k);
    if (r == null) {
      set("23");
      return;
    }
    toArea(r);
    lastKey = k;
    posKey = k;
    posInclusive = false;
    eof = false;
    set("00");
  }

  /** START KEY op: op is one of "=", ">", ">=" (">" also for NOT <=). */
  public void start(String op) {
    if (org != Org.INDEXED || (mode != Mode.INPUT && mode != Mode.IO)) {
      set("47");
      return;
    }
    final String k = areaKey();
    final String found = switch (op) {
      case "=" -> map.containsKey(k) ? k : null;
      case ">" -> map.higherKey(k);
      case ">=" -> map.ceilingKey(k);
      default -> throw new IllegalArgumentException("START KEY " + op);
    };
    if (found == null) {
      set("23");
      return;
    }
    posKey = found;
    posInclusive = true;
    eof = false;
    set("00");
  }

  /* ---------------------------------------------------------------- WRITE / REWRITE / DELETE */

  /** WRITE of the record area; {@code len} is the length of the record named in the WRITE. */
  public void write(int len) {
    if (mode != Mode.OUTPUT && mode != Mode.EXTEND && !(mode == Mode.IO && org == Org.INDEXED)) {
      set("48");
      return;
    }
    final byte[] r = fromArea(len);
    if (org == Org.SEQUENTIAL) {
      recs.add(r);
      set("00");
      return;
    }
    final String k = key(r);
    if (access == Access.SEQUENTIAL && mode == Mode.OUTPUT && !map.isEmpty() && Ops.compareText(k, map.lastKey()) <= 0) {
      set(map.containsKey(k) ? "22" : "21");
      return;
    }
    if (map.containsKey(k)) {
      set("22");
      return;
    }
    map.put(k, r);
    set("00");
  }

  public void rewrite(int len) {
    if (mode != Mode.IO) {
      set("49");
      return;
    }
    final byte[] r = fromArea(len);
    if (org == Org.SEQUENTIAL) {
      if (lastRead < 0) {
        set("43");
        return;
      }
      recs.set(lastRead, r);
      lastRead = -1;
      set("00");
      return;
    }
    final String k = key(r);
    if (access == Access.SEQUENTIAL) {
      if (lastKey == null) {
        set("43");
        return;
      }
      if (!lastKey.equals(k)) {
        set("21");
        return;
      }
    }
    if (!map.containsKey(k)) {
      set("23");
      return;
    }
    map.put(k, r);
    lastKey = null;
    set("00");
  }

  public void delete() {
    if (mode != Mode.IO || org != Org.INDEXED) {
      set("49");
      return;
    }
    final String k = access == Access.SEQUENTIAL ? lastKey : areaKey();
    if (k == null) {
      set("43");
      return;
    }
    if (map.remove(k) == null) {
      set("23");
      return;
    }
    lastKey = null;
    set("00");
  }

  /** Writes back a file still open when the run unit ends (STOP RUN closes open files). */
  void closeAtEnd() {
    if (mode == null) return;
    try {
      flush();
    } catch (IOException e) {
      throw new CobolAbend("FILE", name + ": " + e.getMessage());
    } finally {
      mode = null;
    }
  }
}
