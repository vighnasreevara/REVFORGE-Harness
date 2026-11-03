package revforge.cobol.batch;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import revforge.cobol.Area;
import revforge.cobol.CobolAbend;
import revforge.cobol.RunUnit;
import revforge.cobol.Storage;
import revforge.cobol.UnresolvedGapException;

/**
 * Runs a batch job converted from JCL: steps in order, each a run unit of a
 * converted program with its DD statements mapped to datasets.
 *
 *   DSN=name        the dataset file {@code dataRoot/name} (catalogued data sets)
 *   SYSOUT=class    a spool file under {@code dataRoot/SYSOUT/}
 *   DUMMY           an empty dataset (reads end at once; writes are discarded)
 *   COND=(c,op[,step]) / EVEN / ONLY   the standard step-bypass test against earlier return codes
 * A step whose program is not a converted application program (a system
 * utility such as IDCAMS, SORT or IKJEFT01) is not emulated: the job stops
 * there with that step BLOCKED. A step that ends with a gap or an abend also
 * ends the job (later steps run only with COND=EVEN / ONLY).
 */
public final class JobRunner {
  private JobRunner() {}

  public record Dd(String name, String dsn, boolean sysout, boolean dummy) {}

  public record Step(String name, String pgm, String parm, String cond, List<Dd> dds) {}

  public record Job(String name, String source, List<Step> steps) {}

  public record StepResult(String step, String pgm, String outcome, Integer returnCode, List<String> display) {}

  public static List<StepResult> run(Job job, Path dataRoot, RunUnit.Clock clock) throws IOException {
    final List<StepResult> out = new ArrayList<>();
    boolean abended = false;
    for (Step s : job.steps()) {
      if (bypass(s.cond(), out, abended)) {
        out.add(new StepResult(s.name(), s.pgm(), "BYPASSED (COND)", null, List.of()));
        continue;
      }
      if (!RunUnit.isRegistered(s.pgm())) {
        out.add(new StepResult(s.name(), s.pgm(), "BLOCKED UTILITY " + s.pgm() + " (system utility, not converted)", null, List.of()));
        abended = true;
        continue;
      }
      final RunUnit ru = new RunUnit();
      final ByteArrayOutputStream console = new ByteArrayOutputStream();
      ru.out = new PrintStream(console, true, StandardCharsets.ISO_8859_1);
      if (clock != null) ru.clock = clock;
      for (Dd d : s.dds()) {
        if (d.dummy()) {
          final Path p = Files.createTempFile("revforge-dummy-", ".dat");
          ru.datasets.put(d.name(), p);
        } else if (d.sysout()) ru.datasets.put(d.name(), dataRoot.resolve("SYSOUT").resolve(job.name() + "." + s.name() + "." + d.name()));
        else if (d.dsn() != null) ru.datasets.put(d.name(), dataRoot.resolve(d.dsn()));
      }
      String outcome;
      Integer rc = null;
      try {
        rc = ru.runMain(s.pgm(), s.parm() == null ? new Area[0] : new Area[] {parm(s.parm())});
        outcome = "END";
      } catch (UnresolvedGapException g) {
        outcome = "BLOCKED " + g.gapId();
        abended = true;
      } catch (CobolAbend a) {
        outcome = "ABEND " + a.code();
        abended = true;
      }
      out.add(new StepResult(s.name(), s.pgm(), outcome, rc, ru.displayed()));
    }
    return out;
  }

  static Area parm(String text) {
    final Storage st = new Storage("PARM", text.length() + 2);
    final byte[] b = new byte[text.length() + 2];
    b[0] = (byte) (text.length() >> 8);
    b[1] = (byte) text.length();
    System.arraycopy(text.getBytes(StandardCharsets.ISO_8859_1), 0, b, 2, text.length());
    final Area a = st.area();
    a.put(b);
    return a;
  }

  /** COND: the step is bypassed when any test is true; without EVEN/ONLY it is also bypassed after an abend. */
  static boolean bypass(String cond, List<StepResult> prior, boolean abended) {
    if (cond == null || cond.isBlank()) return abended;
    final String c = cond.replaceAll("^\\(|\\)$", "").trim();
    if (c.equals("EVEN")) return false;
    if (c.equals("ONLY")) return !abended;
    if (abended) return true;
    final java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\(?(\\d+),(GT|GE|EQ|LT|LE|NE)(?:,([A-Z0-9#@$.]+))?\\)?").matcher(c);
    while (m.find()) {
      final int code = Integer.parseInt(m.group(1));
      for (StepResult r : prior) {
        if (r.returnCode() == null || (m.group(3) != null && !m.group(3).endsWith(r.step()))) continue;
        final int rc = r.returnCode();
        final boolean t = switch (m.group(2)) {
          case "GT" -> code > rc;
          case "GE" -> code >= rc;
          case "EQ" -> code == rc;
          case "LT" -> code < rc;
          case "LE" -> code <= rc;
          default -> code != rc;
        };
        if (t) return true;
      }
    }
    return false;
  }
}
