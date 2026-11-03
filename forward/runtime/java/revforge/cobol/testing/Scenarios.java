package revforge.cobol.testing;

import java.io.ByteArrayOutputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintStream;
import java.io.StringReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import revforge.cobol.Area;
import revforge.cobol.CobolAbend;
import revforge.cobol.CobolFile;
import revforge.cobol.CobolProgram;
import revforge.cobol.Cond88;
import revforge.cobol.Field;
import revforge.cobol.Ops;
import revforge.cobol.ProgramExit;
import revforge.cobol.RunUnit;
import revforge.cobol.Storage;
import revforge.cobol.UnresolvedGapException;

/**
 * Runs source-derived scenarios (JSON fixtures written from the COBOL source,
 * never from the generated Java) against a converted program:
 *   kind "call"  the program is CALLed with its own LINKAGE records after "set"
 *   kind "main"  the program runs as the main program of a run unit (PARM, SYSIN, datasets)
 * and compares the outcome, RETURN-CODE, items, DISPLAY lines and output datasets.
 */
public final class Scenarios {
  private Scenarios() {}

  @SuppressWarnings("unchecked")
  public static void run(String programId, Path fixtures, Report r) throws IOException {
    final Map<String, Object> fx = (Map<String, Object>) Json.parse(Files.readString(fixtures, StandardCharsets.UTF_8));
    for (Object o : (List<Object>) fx.get("scenarios")) {
      final Map<String, Object> sc = (Map<String, Object>) o;
      final String id = (String) sc.get("id");
      try {
        one(programId, sc, r, id);
      } catch (RuntimeException | IOException e) {
        r.result(id, "FAIL", null, "scenario error: " + e);
      }
    }
  }

  @SuppressWarnings("unchecked")
  private static void one(String programId, Map<String, Object> sc, Report r, String id) throws IOException {
    final RunUnit ru = new RunUnit();
    final ByteArrayOutputStream console = new ByteArrayOutputStream();
    ru.out = new PrintStream(console, true, StandardCharsets.ISO_8859_1);
    if (sc.get("clock") instanceof String c) {
      final ZonedDateTime t = ZonedDateTime.parse(c);
      ru.clock = () -> t;
    }
    final List<String> sysin = sc.get("sysin") instanceof List<?> l ? (List<String>) l : List.of();
    ru.in = new BufferedReader(new StringReader(String.join("\n", sysin) + (sysin.isEmpty() ? "" : "\n")));
    final Path dir = Files.createTempDirectory("revforge-scenario-");
    final CobolProgram prog = ru.load(programId);
    final Map<String, Object> items = prog.items();
    // Datasets: inputs are written with their records; outputs get a fresh path.
    final Map<String, Object> ds = sc.get("datasets") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    for (Map.Entry<String, Object> e : ds.entrySet()) {
      final Path p = dir.resolve(e.getKey());
      final CobolFile f = fileByDdOrNull(items, e.getKey());
      final List<String> recs = (List<String>) ((Map<String, Object>) e.getValue()).get("records");
      // A DD whose file could not be generated (no FD, no usable layout) gets the records as they are.
      Files.write(p, f == null ? String.join("", recs).getBytes(StandardCharsets.ISO_8859_1) : encode(recs, f));
      ru.datasets.put(e.getKey(), p);
    }
    if (sc.get("outputs") instanceof List<?> outs) for (Object dd : outs) ru.datasets.put((String) dd, dir.resolve((String) dd));
    final Map<String, Object> set = sc.get("set") instanceof Map<?, ?> m2 ? (Map<String, Object>) m2 : Map.of();
    for (Map.Entry<String, Object> e : set.entrySet()) assign(items, e.getKey(), e.getValue());
    final String kind = (String) sc.getOrDefault("kind", "call");
    String outcome;
    try {
      if (kind.equals("main")) {
        final Area[] args = sc.get("parm") instanceof String parm ? new Area[] {parmArea(parm)} : new Area[0];
        ru.runLoaded(programId, args);
        outcome = "END";
      } else {
        // "calls": earlier CALLs of the same program in the same run unit (WORKING-STORAGE persists between
        // CALLs, as in COBOL); each step sets the LINKAGE inputs of that call. The final call is the one judged.
        if (sc.get("calls") instanceof List<?> steps) {
          for (Object st : steps) {
            final Map<String, Object> m3 = (Map<String, Object>) st;
            if (m3.get("set") instanceof Map<?, ?> s3) for (Map.Entry<String, Object> e : ((Map<String, Object>) s3).entrySet()) assign(items, e.getKey(), e.getValue());
            ru.call(programId, prog.ownLinkage());
          }
          for (Map.Entry<String, Object> e : set.entrySet()) assign(items, e.getKey(), e.getValue());
        }
        ru.call(programId, prog.ownLinkage());
        outcome = "GOBACK";
      }
    } catch (UnresolvedGapException g) {
      outcome = "BLOCKED " + g.gapId();
    } catch (CobolAbend a) {
      outcome = "ABEND " + a.code();
    } catch (ProgramExit x) {
      outcome = x.isStopRun() ? "STOP_RUN" : "GOBACK";
    } finally {
      // The driver's run unit ends here: open files are written back before datasets are compared.
      ru.end();
    }
    final Map<String, Object> ex = (Map<String, Object>) sc.get("expect");
    final List<String> problems = new ArrayList<>();
    final String want = (String) ex.getOrDefault("outcome", kind.equals("main") ? "END" : "GOBACK");
    // "BLOCKED AT file:line" names a gap by its COBOL source location (stable across gap numbering).
    final String gotOutcome = want.startsWith("BLOCKED AT ") && outcome.startsWith("BLOCKED ") ? "BLOCKED AT " + prog.gapSite(outcome.substring(8)) : outcome;
    if (!want.equals(gotOutcome)) problems.add("outcome " + outcome + (gotOutcome.equals(outcome) ? "" : " = " + gotOutcome) + " (expected " + want + ")");
    if (ex.get("return_code") instanceof BigDecimal rc && ru.returnCode.value().compareTo(rc) != 0) problems.add("RETURN-CODE " + ru.returnCode.value() + " (expected " + rc + ")");
    if (ex.get("items") instanceof Map<?, ?> its) {
      for (Map.Entry<String, Object> e : ((Map<String, Object>) its).entrySet()) {
        final String p = check(items, e.getKey(), e.getValue());
        if (p != null) problems.add(p);
      }
    }
    if (ex.get("display") instanceof List<?> d) {
      final List<String> got = new ArrayList<>();
      for (String s : ru.displayed()) got.add(rtrim(s));
      final List<String> wantLines = new ArrayList<>();
      for (Object s : d) wantLines.add(rtrim((String) s));
      if (!got.equals(wantLines)) problems.add("DISPLAY " + got + " (expected " + wantLines + ")");
    }
    if (ex.get("display_contains") instanceof List<?> d) {
      final List<String> got = new ArrayList<>();
      for (String s : ru.displayed()) got.add(rtrim(s));
      for (Object line : d) if (!got.contains(rtrim((String) line))) problems.add("DISPLAY lacks '" + line + "' (got " + got + ")");
    }
    if (ex.get("datasets") instanceof Map<?, ?> outs) {
      for (Map.Entry<String, Object> e : ((Map<String, Object>) outs).entrySet()) {
        final Path p = ru.datasets.get(e.getKey());
        final CobolFile f = fileByDd(items, e.getKey());
        final List<String> got = p != null && Files.exists(p) ? decode(Files.readAllBytes(p), f) : null;
        final List<String> wantRecs = new ArrayList<>();
        for (Object x : (List<Object>) e.getValue()) wantRecs.add(rtrim((String) x));
        if (got == null || !got.equals(wantRecs)) problems.add("dataset " + e.getKey() + " " + got + " (expected " + wantRecs + ")");
      }
    }
    // Statement coverage of this scenario: COVER|id|status|PROGRAM:line,line,...
    final StringBuilder cov = new StringBuilder();
    for (Map.Entry<String, java.util.BitSet> e : ru.covered().entrySet()) cov.append(cov.length() > 0 ? ";" : "").append(e.getKey()).append(':').append(e.getValue().stream().mapToObj(Integer::toString).collect(java.util.stream.Collectors.joining(",")));
    final List<String> asserted = new ArrayList<>();
    if (ex.get("items") instanceof Map<?, ?> its2) for (Object k : its2.keySet()) asserted.add("item " + k);
    // An expected empty DISPLAY is not evidence of a rule's effect.
    if (ex.get("display") instanceof List<?> d2 && !d2.isEmpty()) asserted.add("display " + d2.size() + " line(s)");
    if (ex.get("display_contains") instanceof List<?> d3) asserted.add("display contains " + d3.size() + " line(s)");
    if (ex.get("datasets") instanceof Map<?, ?> ds2) for (Object k : ds2.keySet()) asserted.add("dataset " + k);
    if (ex.get("return_code") != null) asserted.add("RETURN-CODE");
    r.coverage(id, problems.isEmpty() ? "OK" : "FAIL", cov.toString() + "|" + String.join(",", asserted));
    final String gap = outcome.startsWith("BLOCKED ") ? outcome.substring(8) : null;
    if (problems.isEmpty()) r.result(id, gap != null ? "BLOCKED_AS_EXPECTED" : "PASS", gap, null);
    else r.result(id, "FAIL", gap, String.join("; ", problems));
  }

  static CobolFile fileByDd(Map<String, Object> items, String dd) {
    final CobolFile f = fileByDdOrNull(items, dd);
    if (f == null) throw new IllegalArgumentException("no file is assigned to DD " + dd);
    return f;
  }

  static CobolFile fileByDdOrNull(Map<String, Object> items, String dd) {
    for (Object v : items.values()) if (v instanceof CobolFile f && f.dd.equals(dd)) return f;
    return null;
  }

  static byte[] encode(List<String> recs, CobolFile f) {
    final ByteArrayOutputStream o = new ByteArrayOutputStream();
    for (String s : recs) {
      final byte[] b = s.getBytes(StandardCharsets.ISO_8859_1);
      if (f.isVariable()) {
        o.write((b.length + 4) >> 8);
        o.write((b.length + 4) & 0xFF);
        o.write(0);
        o.write(0);
        o.writeBytes(b);
      } else {
        if (b.length > f.recordLength()) throw new IllegalArgumentException("record longer than " + f.recordLength() + ": " + s);
        o.writeBytes(b);
        for (int k = b.length; k < f.recordLength(); k++) o.write(' ');
      }
    }
    return o.toByteArray();
  }

  static List<String> decode(byte[] all, CobolFile f) {
    final List<String> out = new ArrayList<>();
    if (f.isVariable()) {
      for (int i = 0; i + 4 <= all.length; ) {
        final int n = ((all[i] & 0xFF) << 8) | (all[i + 1] & 0xFF);
        out.add(rtrim(new String(all, i + 4, n - 4, StandardCharsets.ISO_8859_1)));
        i += n;
      }
      return out;
    }
    for (int i = 0; i + f.recordLength() <= all.length; i += f.recordLength()) out.add(rtrim(new String(all, i, f.recordLength(), StandardCharsets.ISO_8859_1)));
    return out;
  }

  /** z/OS PARM: a halfword length followed by the text. */
  static Area parmArea(String parm) {
    final Storage st = new Storage("PARM", parm.length() + 2);
    final byte[] b = new byte[parm.length() + 2];
    b[0] = (byte) (parm.length() >> 8);
    b[1] = (byte) parm.length();
    System.arraycopy(parm.getBytes(StandardCharsets.ISO_8859_1), 0, b, 2, parm.length());
    final Area a = st.area();
    a.put(b);
    return a;
  }

  static String rtrim(String s) {
    int n = s.length();
    while (n > 0 && s.charAt(n - 1) == ' ') n--;
    return s.substring(0, n);
  }

  static Object item(Map<String, Object> items, String name) {
    final java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.*?)\\((\\d+(?:\\s*,\\s*\\d+)*)\\)$").matcher(name);
    if (m.matches() && items.containsKey(m.group(1).trim())) {
      final int[] idx = java.util.Arrays.stream(m.group(2).split(",")).map(String::trim).mapToInt(Integer::parseInt).toArray();
      final Object base = items.get(m.group(1).trim());
      if (base instanceof Field f) return f.at(idx);
      if (base instanceof Cond88 c) return c.at(idx);
    }
    final Object o = items.get(name);
    if (o == null) throw new IllegalArgumentException("no item " + name);
    return o;
  }

  static void assign(Map<String, Object> items, String name, Object v) {
    final Object o = item(items, name);
    if (o instanceof Cond88 c) {
      if (Boolean.TRUE.equals(v)) c.setTrue();
      else throw new IllegalArgumentException("a condition can only be set to true: " + name);
    } else if (o instanceof Field f) {
      if (f.isNumeric()) Ops.move(v instanceof BigDecimal d ? d : new BigDecimal((String) v), f);
      else f.setRaw((String) v);
    }
  }

  static String check(Map<String, Object> items, String name, Object v) {
    final Object o = item(items, name);
    try {
      if (o instanceof Cond88 c) return c.isTrue() == Boolean.TRUE.equals(v) ? null : name + " is " + c.isTrue() + " (expected " + v + ")";
      final Field f = (Field) o;
      if (f.isNumeric()) {
        final BigDecimal want = v instanceof BigDecimal d ? d : new BigDecimal((String) v);
        return f.value().compareTo(want) == 0 ? null : name + " = " + f.value() + " (expected " + want + ")";
      }
      return rtrim(f.raw()).equals(rtrim((String) v)) ? null : name + " = '" + rtrim(f.raw()) + "' (expected '" + v + "')";
    } catch (CobolAbend e) {
      return name + ": " + e.getMessage();
    }
  }
}
