package revforge.cobol;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * A run unit: one main program and the programs it calls, with the
 * environment the legacy runtime provided: console (DISPLAY), SYSIN (ACCEPT),
 * the clock (ACCEPT FROM DATE/TIME, FUNCTION CURRENT-DATE), datasets by DD
 * name, the RETURN-CODE special register and the called-program registry.
 */
public final class RunUnit {
  /** Clock used for dates and times; tests fix it. */
  public interface Clock {
    ZonedDateTime now();
  }

  private static final Map<String, Function<RunUnit, CobolProgram>> REGISTRY = new HashMap<>();

  /** Registers a converted program under its PROGRAM-ID. */
  public static void register(String programId, Function<RunUnit, CobolProgram> factory) {
    REGISTRY.put(programId, factory);
  }

  /** Empties the registry (tests run each program in isolation). */
  public static void unregisterAll() {
    REGISTRY.clear();
  }

  public static boolean isRegistered(String programId) {
    return REGISTRY.containsKey(programId);
  }

  public PrintStream out = System.out;
  public BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.ISO_8859_1));
  public Clock clock = ZonedDateTime::now;
  public final Map<String, Path> datasets = new LinkedHashMap<>();
  public final Field returnCode;
  private final Map<String, CobolProgram> loaded = new HashMap<>();
  private final List<CobolFile> open = new ArrayList<>();
  private final List<String> displayed = new ArrayList<>();
  /** COBOL statement lines executed in this run unit, per program (statement coverage for tests). */
  private final Map<String, java.util.BitSet> covered = new LinkedHashMap<>();

  public RunUnit() {
    returnCode = new Field(new Storage("RETURN-CODE", 2), 0, 2, Field.Kind.BINARY, 4, 0, true, false, false, null, "RETURN-CODE", new int[0], new int[0]);
    returnCode.store(java.math.BigDecimal.ZERO);
  }

  public Path dataset(String dd) {
    return datasets.get(dd);
  }

  void opened(CobolFile f) {
    open.add(f);
  }

  void closed(CobolFile f) {
    open.remove(f);
  }

  /* ---------------------------------------------------------------- console */

  public void display(boolean newline, Object... items) {
    final String s = Ops.display(items);
    displayed.add(s);
    if (newline) out.println(s);
    else out.print(s);
  }

  void cover(String programId, int line) {
    covered.computeIfAbsent(programId, k -> new java.util.BitSet()).set(line);
  }

  /** Executed COBOL statement lines per program. */
  public Map<String, java.util.BitSet> covered() {
    return covered;
  }

  /** Every DISPLAY line of this run unit, in order. */
  public List<String> displayed() {
    return displayed;
  }

  /** ACCEPT item (from SYSIN). The end of SYSIN is not defined by the source. */
  public void accept(Field target) {
    final String line;
    try {
      line = in.readLine();
    } catch (IOException e) {
      throw new CobolAbend("SYSIN", e.getMessage());
    }
    if (line == null) throw UnresolvedGapException.blocked("RUNTIME-ACCEPT-EOF", "ACCEPT " + target.name + " after the end of SYSIN");
    Ops.move(line, target);
  }

  /** ACCEPT ... FROM DATE [YYYYMMDD] | DAY [YYYYDDD] | TIME | DAY-OF-WEEK. */
  public void acceptFrom(Field target, String what) {
    final ZonedDateTime t = clock.now();
    final String v = switch (what) {
      case "DATE" -> String.format("%02d%02d%02d", t.getYear() % 100, t.getMonthValue(), t.getDayOfMonth());
      case "DATE YYYYMMDD" -> String.format("%04d%02d%02d", t.getYear(), t.getMonthValue(), t.getDayOfMonth());
      case "DAY" -> String.format("%02d%03d", t.getYear() % 100, t.getDayOfYear());
      case "DAY YYYYDDD" -> String.format("%04d%03d", t.getYear(), t.getDayOfYear());
      case "TIME" -> String.format("%02d%02d%02d%02d", t.getHour(), t.getMinute(), t.getSecond(), t.getNano() / 10_000_000);
      case "DAY-OF-WEEK" -> String.valueOf(t.getDayOfWeek().getValue());
      default -> throw UnresolvedGapException.blocked("RUNTIME-ACCEPT-FROM", "ACCEPT FROM " + what);
    };
    Ops.move(v, target);
  }

  /* ---------------------------------------------------------------- programs */

  /**
   * CALL program USING areas. Returns false when the program is not available
   * (the caller's ON EXCEPTION phrase applies; without it the path is blocked
   * by the caller).
   */
  public boolean call(String programId, Area... args) {
    CobolProgram p = loaded.get(programId);
    if (p == null) {
      final Function<RunUnit, CobolProgram> f = REGISTRY.get(programId);
      if (f == null) return false;
      p = f.apply(this);
      loaded.put(programId, p);
    }
    p.execute(args, true);
    return true;
  }

  /** CANCEL: the next CALL gets a fresh copy of the program. */
  public void cancel(String programId) {
    loaded.remove(programId);
  }

  /**
   * Runs a main program to the end of the run unit and returns RETURN-CODE.
   * Files still open are written back (STOP RUN closes them), also when the
   * run ends with an abend or a blocked gap, which is then rethrown.
   */
  public int runMain(String programId, Area... args) {
    final Function<RunUnit, CobolProgram> f = REGISTRY.get(programId);
    if (f == null) throw new CobolAbend("S806", "program " + programId + " is not available");
    final CobolProgram p = f.apply(this);
    loaded.put(programId, p);
    try {
      p.execute(args, false);
    } catch (ProgramExit e) {
      // STOP RUN from any program of the run unit.
    } finally {
      for (CobolFile c : new ArrayList<>(open)) c.closeAtEnd();
      open.clear();
    }
    return returnCode.value().intValue();
  }

  /** Loads (or returns the loaded) instance of a program without running it. */
  public CobolProgram load(String programId) {
    CobolProgram p = loaded.get(programId);
    if (p == null) {
      final Function<RunUnit, CobolProgram> f = REGISTRY.get(programId);
      if (f == null) throw new CobolAbend("S806", "program " + programId + " is not available");
      p = f.apply(this);
      loaded.put(programId, p);
    }
    return p;
  }

  /** Runs an already loaded program as the main program (see {@link #runMain}). */
  public int runLoaded(String programId, Area... args) {
    final CobolProgram p = load(programId);
    try {
      p.execute(args, false);
    } catch (ProgramExit e) {
      // STOP RUN from any program of the run unit.
    } finally {
      for (CobolFile c : new ArrayList<>(open)) c.closeAtEnd();
      open.clear();
    }
    return returnCode.value().intValue();
  }

  /** Ends the run unit after CALLs from a test driver: files still open are written back, as at STOP RUN. */
  public void end() {
    for (CobolFile c : new ArrayList<>(open)) c.closeAtEnd();
    open.clear();
  }

  /** The loaded instance of a program (for tests and paragraph-level probes). */
  public CobolProgram instance(String programId) {
    return loaded.get(programId);
  }
}
