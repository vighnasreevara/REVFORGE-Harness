package revforge.cobol.testing;

import java.io.PrintStream;
import java.util.HexFormat;
import revforge.cobol.Field;
import revforge.cobol.UnresolvedGapException;

/** Test results as lines: CASE|id|status|gap|detail (status PASS, FAIL or BLOCKED_AS_EXPECTED). */
public final class Report {
  private final PrintStream out;
  public int pass;
  public int fail;
  public int blocked;
  /** Prefixed to case IDs (the program, when several programs report together). */
  public String prefix = "";

  public Report(PrintStream out) {
    this.out = out;
  }

  public void result(String id, String status, String gap, String detail) {
    switch (status) {
      case "PASS" -> pass++;
      case "BLOCKED_AS_EXPECTED" -> blocked++;
      default -> fail++;
    }
    out.println("CASE|" + prefix + id + "|" + status + "|" + (gap == null ? "-" : gap) + "|" + (detail == null ? "" : detail.replace('\n', ' ').replace('|', '/')));
  }

  /** Statement coverage of one scenario (not a test result). */
  public void coverage(String id, String status, String lines) {
    out.println("COVER|" + prefix + id + "|" + status + "|" + lines);
  }

  /** A level-88 condition: SET TO TRUE stores its first value (encoded independently) and the condition is then true. */
  public void cond(String id, String expectedHex, revforge.cobol.Cond88 c, Field var) {
    try {
      c.setTrue();
      final String actual = HexFormat.of().formatHex(var.bytes());
      if (!actual.equals(expectedHex)) result(id, "FAIL", null, "SET TO TRUE stored " + actual + ", expected " + expectedHex);
      else if (!c.isTrue()) result(id, "FAIL", null, "condition false after SET TO TRUE");
      else result(id, "PASS", null, null);
    } catch (RuntimeException e) {
      result(id, "FAIL", null, e.toString());
    }
  }

  /** The item's storage after initialisation equals the VALUE clause encoded independently of the runtime. */
  public void bytes(String id, String expectedHex, Field f) {
    final String actual = HexFormat.of().formatHex(f.bytes());
    if (actual.equals(expectedHex)) result(id, "PASS", null, null);
    else result(id, "FAIL", null, "expected " + expectedHex + " actual " + actual);
  }

  /** The Java site of a gap must throw UnresolvedGapException with exactly that gap ID. */
  public void gap(String id, String gapId, Runnable r) {
    try {
      r.run();
      result(id, "FAIL", gapId, "the gap site completed normally (missing behaviour was defaulted)");
    } catch (UnresolvedGapException e) {
      if (e.gapId().equals(gapId)) result(id, "BLOCKED_AS_EXPECTED", gapId, null);
      else result(id, "FAIL", e.gapId(), "blocked by " + e.gapId() + " instead of " + gapId);
    } catch (RuntimeException e) {
      result(id, "FAIL", gapId, e.getClass().getSimpleName() + ": " + e.getMessage());
    }
  }
}
