package revforge.cobol.testing;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HexFormat;
import revforge.cobol.CobolAbend;
import revforge.cobol.CobolFile;
import revforge.cobol.Cond88;
import revforge.cobol.Edit;
import revforge.cobol.Field;
import revforge.cobol.Fig;
import revforge.cobol.Ops;
import revforge.cobol.RunUnit;
import revforge.cobol.Storage;
import revforge.cobol.UnresolvedGapException;

/**
 * Unit tests of the runtime against COBOL language rules (expected values
 * from the language definition and the IBM data representations, not from
 * running the runtime): representations, MOVE, arithmetic, editing,
 * comparison, STRING, level-88 conditions and file status.
 */
public final class RuntimeTests {
  private RuntimeTests() {}

  static Field num(int digits, int scale, boolean signed, Field.Kind k) {
    final int len = k == Field.Kind.PACKED ? digits / 2 + 1 : k == Field.Kind.BINARY ? (digits <= 4 ? 2 : digits <= 9 ? 4 : 8) : digits;
    return new Field(new Storage("T", len), 0, len, k, digits, scale, signed, false, false, null, "T", new int[0], new int[0]);
  }

  static Field edited(String pic) {
    return new Field(new Storage("E", pic.length()), 0, pic.length(), Field.Kind.EDITED, 0, 0, false, false, false, pic, "E", new int[0], new int[0]);
  }

  static Field alnum(int n) {
    return Field.alnum(new Storage("A", n), 0, n, "A");
  }

  interface Check {
    void run() throws Exception;
  }

  static void t(Report r, String id, Check c) {
    try {
      c.run();
      r.result("RT " + id, "PASS", null, null);
    } catch (AssertionError | Exception e) {
      r.result("RT " + id, "FAIL", null, String.valueOf(e.getMessage()));
    }
  }

  static void eq(Object want, Object got) {
    if (!want.equals(got)) throw new AssertionError("expected [" + want + "] got [" + got + "]");
  }

  public static void run(Report r) {
    performTests(r);
    t(r, "zoned S9(4) +12 is 001B", () -> {
      final Field f = num(4, 0, true, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("12"), f);
      eq("001B", f.raw());
    });
    t(r, "zoned S9(4) -12 is 001K", () -> {
      final Field f = num(4, 0, true, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("-12"), f);
      eq("001K", f.raw());
      eq(0, new BigDecimal("-12").compareTo(f.value()));
    });
    t(r, "zoned unsigned drops the sign", () -> {
      final Field f = num(3, 0, false, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("-7"), f);
      eq("007", f.raw());
    });
    t(r, "MOVE truncates high-order digits", () -> {
      final Field f = num(3, 0, false, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("12345"), f);
      eq("345", f.raw());
    });
    t(r, "MOVE truncates low-order decimals", () -> {
      final Field f = num(3, 2, false, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("1.239"), f);
      eq("123", f.raw());
    });
    t(r, "packed S9(5) -123 is 00123D", () -> {
      final Field f = num(5, 0, true, Field.Kind.PACKED);
      Ops.move(new BigDecimal("-123"), f);
      eq("00123d", HexFormat.of().formatHex(f.bytes()));
    });
    t(r, "binary S9(4) -2 is FFFE", () -> {
      final Field f = num(4, 0, true, Field.Kind.BINARY);
      Ops.move(new BigDecimal("-2"), f);
      eq("fffe", HexFormat.of().formatHex(f.bytes()));
    });
    t(r, "binary beyond PIC digits is TRUNC dependent", () -> {
      final Field f = num(4, 0, true, Field.Kind.BINARY);
      try {
        Ops.move(new BigDecimal("12345"), f);
        throw new AssertionError("no gap");
      } catch (UnresolvedGapException e) {
        eq("RUNTIME-TRUNC", e.gapId());
      }
    });
    t(r, "alphanumeric MOVE pads and truncates", () -> {
      final Field a = alnum(5);
      Ops.move("AB", a);
      eq("AB   ", a.raw());
      Ops.move("ABCDEFG", a);
      eq("ABCDE", a.raw());
    });
    t(r, "numeric to alphanumeric moves unsigned digits", () -> {
      final Field n = num(4, 0, true, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("-42"), n);
      final Field a = alnum(6);
      Ops.move(n, a);
      eq("0042  ", a.raw());
    });
    t(r, "alphanumeric digits to numeric are an unsigned integer", () -> {
      final Field n = num(5, 0, false, Field.Kind.DISPLAY);
      Ops.move("00123", n);
      eq(0, new BigDecimal("123").compareTo(n.value()));
    });
    t(r, "alphanumeric non-digits to numeric are a gap", () -> {
      final Field n = num(5, 0, false, Field.Kind.DISPLAY);
      try {
        Ops.move("1.5", n, "GAP-T-0001");
        throw new AssertionError("no gap");
      } catch (UnresolvedGapException e) {
        eq("GAP-T-0001", e.gapId());
      }
    });
    t(r, "LOW-VALUES numeric is S0C7", () -> {
      final Field n = num(3, 0, false, Field.Kind.DISPLAY);
      try {
        n.value();
        throw new AssertionError("no abend");
      } catch (CobolAbend e) {
        eq("S0C7", e.code());
      }
    });
    t(r, "ROUNDED is half away from zero", () -> {
      final Field f = num(3, 2, true, Field.Kind.DISPLAY);
      Ops.store(f, new BigDecimal("2.345"), true, false);
      eq(0, new BigDecimal("2.35").compareTo(f.value()));
      Ops.store(f, new BigDecimal("-2.345"), true, false);
      eq(0, new BigDecimal("-2.35").compareTo(f.value()));
      Ops.store(f, new BigDecimal("2.349"), false, false);
      eq(0, new BigDecimal("2.34").compareTo(f.value()));
    });
    t(r, "SIZE ERROR leaves the receiver unchanged", () -> {
      final Field f = num(2, 0, false, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("7"), f);
      eq(false, Ops.store(f, new BigDecimal("100"), false, true));
      eq("07", f.raw());
    });
    t(r, "size error without the phrase blocks", () -> {
      final Field f = num(2, 0, false, Field.Kind.DISPLAY);
      try {
        Ops.store(f, new BigDecimal("100"), false, false);
        throw new AssertionError("no gap");
      } catch (UnresolvedGapException e) {
        eq("RUNTIME-SIZE-ERROR", e.gapId());
      }
    });
    t(r, "division by zero takes ON SIZE ERROR", () -> {
      final Field f = num(2, 0, false, Field.Kind.DISPLAY);
      eq(false, Ops.store(f, Ops.div(BigDecimal.ONE, BigDecimal.ZERO), false, true));
    });
    t(r, "DIVIDE REMAINDER uses the stored quotient", () -> {
      final Field q = num(3, 0, false, Field.Kind.DISPLAY);
      final Field rem = num(3, 0, false, Field.Kind.DISPLAY);
      Ops.store(q, Ops.div(new BigDecimal("17"), new BigDecimal("5")), false, false);
      Ops.remainder(rem, new BigDecimal("17"), new BigDecimal("5"), q, false);
      eq("003", q.raw());
      eq("002", rem.raw());
    });
    t(r, "edit ZZZ,ZZ9", () -> {
      eq("  1,234", Edit.format(new BigDecimal("1234"), "ZZZ,ZZ9", 7));
      eq("      0", Edit.format(BigDecimal.ZERO, "ZZZ,ZZ9", 7));
    });
    t(r, "edit floating $", () -> eq("  $1,234,567", Edit.format(new BigDecimal("1234567"), "$$$$,$$$,$$9", 12)));
    t(r, "edit fixed signs", () -> {
      eq("-007", Edit.format(new BigDecimal("-7"), "-999", 4));
      eq(" 007", Edit.format(new BigDecimal("7"), "-999", 4));
      eq("+  5", Edit.format(new BigDecimal("5"), "+ZZ9", 4));
      eq("-  5", Edit.format(new BigDecimal("-5"), "+ZZ9", 4));
    });
    t(r, "edit with decimals", () -> eq("  12.50", Edit.format(new BigDecimal("12.5"), "ZZZZ.99", 7)));
    t(r, "EBCDIC collation: space < letters < digits", () -> {
      eq(true, Ops.compareText(" ", "A") < 0);
      eq(true, Ops.compareText("A", "1") < 0);
      eq(true, Ops.compareText("Z", "0") < 0);
      eq(true, Ops.compareText("a", "A") < 0);
    });
    t(r, "comparison pads with spaces", () -> eq(0, Ops.compare(alnumOf("AB   "), "AB")));
    t(r, "numeric comparison by value", () -> {
      final Field n = num(5, 2, false, Field.Kind.DISPLAY);
      Ops.move(new BigDecimal("1.5"), n);
      eq(0, Ops.compare(n, new BigDecimal("1.50")));
      eq(true, Ops.compare(n, Fig.ZERO) > 0);
    });
    t(r, "STRING DELIMITED BY SPACE with POINTER", () -> {
      final Field into = alnum(10);
      Ops.move(Fig.SPACE, into);
      final Field ptr = num(2, 0, false, Field.Kind.DISPLAY);
      Ops.move(BigDecimal.ONE, ptr);
      final boolean ov = Ops.string(into, ptr, new Object[] {"AB CD", "-", "XYZ"}, new Object[] {" ", null, null});
      eq(false, ov);
      eq("AB-XYZ    ", into.raw());
      eq(0, new BigDecimal("7").compareTo(ptr.value()));
    });
    t(r, "STRING overflow", () -> {
      final Field into = alnum(3);
      Ops.move(Fig.SPACE, into);
      eq(true, Ops.string(into, null, new Object[] {"ABCDE"}, new Object[] {null}));
      eq("ABC", into.raw());
    });
    t(r, "88 with THRU and SET TRUE", () -> {
      final Field v = num(2, 0, false, Field.Kind.DISPLAY);
      final Cond88 c = new Cond88("C", v, new Object[] {new BigDecimal("10"), new BigDecimal("50")}, new Object[] {new BigDecimal("20"), null});
      Ops.move(new BigDecimal("15"), v);
      eq(true, c.isTrue());
      Ops.move(new BigDecimal("21"), v);
      eq(false, c.isTrue());
      c.setTrue();
      eq("10", v.raw());
    });
    t(r, "INITIALIZE", () -> {
      final Field a = alnum(3);
      final Field n = num(3, 0, false, Field.Kind.DISPLAY);
      Ops.initialize(a, n);
      eq("   ", a.raw());
      eq("000", n.raw());
    });
    t(r, "indexed file status codes", () -> {
      final Path dir = Files.createTempDirectory("revforge-rt-");
      final RunUnit ru = new RunUnit();
      ru.datasets.put("KSDS", dir.resolve("ksds"));
      final Storage area = new Storage("REC", 6);
      final Field rec = Field.alnum(area, 0, 6, "REC");
      final CobolFile f = new CobolFile(ru, "F", "KSDS", CobolFile.Org.INDEXED, CobolFile.Access.DYNAMIC, area, 6, false, 0, 2);
      f.open(CobolFile.Mode.INPUT);
      eq("35", f.fileStatus());
      f.open(CobolFile.Mode.OUTPUT);
      rec.setRaw("B2bbbb");
      f.write(6);
      rec.setRaw("A1aaaa");
      f.write(6);
      eq("00", f.fileStatus());
      rec.setRaw("A1zzzz");
      f.write(6);
      eq("22", f.fileStatus());
      f.close();
      f.open(CobolFile.Mode.IO);
      rec.setRaw("C3");
      f.read();
      eq("23", f.fileStatus());
      rec.setRaw("A1");
      f.start(">=");
      f.readNext();
      eq("A1aaaa", rec.raw());
      f.readNext();
      eq("B2bbbb", rec.raw());
      f.readNext();
      eq("10", f.fileStatus());
      rec.setRaw("A1AAAA");
      f.rewrite(6);
      eq("00", f.fileStatus());
      f.close();
      eq("A1AAAAB2bbbb", Files.readString(dir.resolve("ksds"), StandardCharsets.ISO_8859_1));
    });
    t(r, "sequential file end of file", () -> {
      final Path dir = Files.createTempDirectory("revforge-rt-");
      Files.writeString(dir.resolve("seq"), "abcdef", StandardCharsets.ISO_8859_1);
      final RunUnit ru = new RunUnit();
      ru.datasets.put("SEQ", dir.resolve("seq"));
      final Storage area = new Storage("REC", 3);
      final Field rec = Field.alnum(area, 0, 3, "REC");
      final CobolFile f = new CobolFile(ru, "F", "SEQ", CobolFile.Org.SEQUENTIAL, CobolFile.Access.SEQUENTIAL, area, 3, false, 0, 0);
      f.open(CobolFile.Mode.INPUT);
      f.readNext();
      eq("abc", rec.raw());
      f.readNext();
      f.readNext();
      eq("10", f.fileStatus());
      f.readNext();
      eq("46", f.fileStatus());
      f.close();
      eq("00", f.fileStatus());
      f.close();
      eq("42", f.fileStatus());
    });
  }

  /** A program whose paragraphs are given as actions; each receives the program to PERFORM other ranges. */
  interface Para {
    void run(Prog p);
  }

  static final class Prog extends revforge.cobol.CobolProgram {
    final Para[] paras;
    final java.util.List<Integer> trace = new java.util.ArrayList<>();

    Prog(Para... paras) {
      super(new revforge.cobol.RunUnit());
      this.paras = paras;
    }

    void doPerform(int from, int thru) {
      perform(from, thru);
    }

    @Override
    public String programId() {
      return "RTPROG";
    }

    @Override
    protected int paragraph(int i) {
      trace.add(i);
      paras[i].run(this);
      return -1;
    }

    @Override
    protected int paragraphCount() {
      return paras.length;
    }

    @Override
    protected void bind(revforge.cobol.Area[] args) {}

    @Override
    public java.util.Map<String, Object> items() {
      return java.util.Map.of();
    }
  }

  static void performTests(Report r) {
    t(r, "a PERFORM of its own active range is blocked (recursive PERFORM)", () -> {
      final int[] depth = {0};
      final Prog p = new Prog(x -> x.doPerform(1, 1), x -> {
        if (++depth[0] > 5) throw new AssertionError("recursion was executed");
        x.doPerform(1, 1);
      });
      try {
        p.performForTest(0, 0);
        throw new AssertionError("no gap raised");
      } catch (revforge.cobol.UnresolvedGapException e) {
        eq("RUNTIME-RECURSIVE-PERFORM", e.gapId());
        eq(1, depth[0]);
      }
    });
    t(r, "a nested PERFORM of a different range inside an active range runs normally", () -> {
      final Prog p = new Prog(x -> x.doPerform(1, 2), x -> x.doPerform(2, 2), x -> {});
      p.performForTest(0, 0);
      eq(java.util.List.of(0, 1, 2, 2), p.trace);
    });
    t(r, "a range can be performed again once its previous PERFORM has returned", () -> {
      final Prog p = new Prog(x -> {
        x.doPerform(1, 1);
        x.doPerform(1, 1);
      }, x -> {});
      p.performForTest(0, 0);
      eq(java.util.List.of(0, 1, 1), p.trace);
    });
  }

  static Field alnumOf(String s) {
    final Field f = alnum(s.length());
    f.setRaw(s);
    return f;
  }

  public static void main(String[] args) {
    final Report r = new Report(System.out);
    run(r);
    System.out.println("SUMMARY|" + r.pass + "|" + r.blocked + "|" + r.fail);
  }
}
