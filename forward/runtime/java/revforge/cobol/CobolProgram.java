package revforge.cobol;

import java.util.Map;

/**
 * Base of every converted program. Paragraphs are numbered in source order;
 * {@link #paragraph(int)} runs one and returns -1 to continue with the next
 * paragraph in sequence, or the number of a paragraph to GO TO. PERFORM runs a
 * paragraph range with COBOL fall-through semantics.
 */
public abstract class CobolProgram {
  protected final RunUnit ru;
  private boolean called;

  protected CobolProgram(RunUnit ru) {
    this.ru = ru;
  }

  /** PROGRAM-ID. */
  public abstract String programId();

  protected abstract int paragraph(int i);

  protected abstract int paragraphCount();

  /** Binds LINKAGE records (PROCEDURE DIVISION USING) to the caller's arguments. */
  protected abstract void bind(Area[] args);

  /** The program's own LINKAGE records named in PROCEDURE DIVISION USING (tests call it with them). */
  public Area[] ownLinkage() {
    return new Area[0];
  }

  /** COBOL source location (file:line) of a gap site, or null. */
  public String gapSite(String gapId) {
    return null;
  }

  /** Every named data item and level-88 condition, for tests. */
  public abstract Map<String, Object> items();

  final void execute(Area[] args, boolean asCalled) {
    bind(args);
    final boolean was = called;
    called = asCalled;
    try {
      perform(0, paragraphCount() - 1);
    } catch (ProgramExit e) {
      if (e.stopRun) throw e;
    } finally {
      called = was;
    }
  }

  /** PERFORM from THRU thru (paragraph numbers). */
  protected final void perform(int from, int thru) {
    // A PERFORM that executes itself recursively (its range is still active) has no defined result in standard
    // COBOL: the path is blocked, never run as Java recursion and never bounded by an invented limit.
    final long range = ((long) from << 32) | (thru & 0xffffffffL);
    if (active.contains(range))
      throw UnresolvedGapException.blocked("RUNTIME-RECURSIVE-PERFORM", "PERFORM of paragraph range " + from + " THRU " + thru + " while the same range is still active (recursive PERFORM)");
    active.add(range);
    try {
      int p = from;
      while (true) {
        final int r = paragraph(p);
        if (r >= 0) {
          p = r;
          continue;
        }
        if (p == thru) return;
        p++;
        if (p >= paragraphCount()) throw new ProgramExit(false);
      }
    } finally {
      active.remove(range);
    }
  }

  private final java.util.Set<Long> active = new java.util.HashSet<>();

  /** Runs one paragraph range for tests (as a PERFORM from outside). */
  public final void performForTest(int from, int thru) {
    perform(from, thru);
  }

  /** Records that the COBOL statement at {@code line} is executed (statement coverage). */
  protected final void c(int line) {
    ru.cover(programId(), line);
  }

  protected final RuntimeException goback() {
    throw new ProgramExit(false);
  }

  protected final RuntimeException stopRun() {
    throw new ProgramExit(true);
  }

  /** EXIT PROGRAM: returns from a called program; no effect in a main program. */
  protected final void exitProgram() {
    if (called) throw new ProgramExit(false);
  }

  protected final boolean isCalled() {
    return called;
  }
}
