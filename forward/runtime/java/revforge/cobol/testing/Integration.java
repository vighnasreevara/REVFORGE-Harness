package revforge.cobol.testing;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import revforge.cobol.CobolFile;
import revforge.cobol.RunUnit;
import revforge.cobol.batch.JobRunner;

/**
 * Integration tests of the assembled application: every converted program is
 * registered, so CALLs between programs run the converted callee.
 *   kind "call" / "main"   as in {@link Scenarios}, across programs
 *   kind "job"             a converted JCL job; datasets are keyed by DSN
 *                          ("dd" names the step DD whose file defines the record format)
 * Expected results are written from the COBOL and JCL sources.
 */
public final class Integration {
  private Integration() {}

  /** Arguments: fixtures directory. The program registry and job table are the generated application classes. */
  public static void main(String[] args) throws Exception {
    Class.forName("revforge.app.Programs").getMethod("registerAll").invoke(null);
    final Report r = new Report(System.out);
    final Path dir = Path.of(args[0]);
    if (Files.isDirectory(dir)) {
      try (Stream<Path> s = Files.list(dir)) {
        for (Path p : s.filter(x -> x.toString().endsWith(".json")).sorted().toList()) run(p, r);
      }
    }
    System.out.println("SUMMARY|" + r.pass + "|" + r.blocked + "|" + r.fail);
  }

  @SuppressWarnings("unchecked")
  static void run(Path fixtures, Report r) throws IOException {
    final Map<String, Object> fx = (Map<String, Object>) Json.parse(Files.readString(fixtures, StandardCharsets.UTF_8));
    for (Object o : (List<Object>) fx.get("scenarios")) {
      final Map<String, Object> sc = (Map<String, Object>) o;
      final String id = "INTEGRATION " + sc.get("id");
      try {
        if ("job".equals(sc.get("kind"))) job(sc, r, id);
        else {
          final String program = (String) sc.get("program");
          final Map<String, Object> one = new java.util.LinkedHashMap<>(sc);
          one.put("id", id);
          final Path tmp = Files.createTempFile("revforge-int-", ".json");
          Files.writeString(tmp, "{\"scenarios\": [" + toJson(one) + "]}", StandardCharsets.UTF_8);
          Scenarios.run(program, tmp, r);
        }
      } catch (RuntimeException | ReflectiveOperationException e) {
        r.result(id, "FAIL", null, "integration error: " + e);
      }
    }
  }

  @SuppressWarnings("unchecked")
  static void job(Map<String, Object> sc, Report r, String id) throws IOException, ReflectiveOperationException {
    final JobRunner.Job job = (JobRunner.Job) Class.forName("revforge.app.batch.Jobs").getMethod("get", String.class).invoke(null, sc.get("job"));
    final Path root = Files.createTempDirectory("revforge-job-");
    final Map<String, Object> ds = sc.get("datasets") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    for (Map.Entry<String, Object> e : ds.entrySet()) {
      final Map<String, Object> d = (Map<String, Object>) e.getValue();
      final CobolFile f = fileFor(job, (String) d.get("dd"));
      Files.write(root.resolve(e.getKey()), Scenarios.encode((List<String>) d.get("records"), f));
    }
    final RunUnit.Clock clock = sc.get("clock") instanceof String c ? () -> ZonedDateTime.parse(c) : null;
    final List<JobRunner.StepResult> res = JobRunner.run(job, root, clock);
    final Map<String, Object> ex = (Map<String, Object>) sc.get("expect");
    final List<String> problems = new ArrayList<>();
    if (ex.get("steps") instanceof List<?> steps) {
      for (int k = 0; k < steps.size(); k++) {
        final Map<String, Object> w = (Map<String, Object>) steps.get(k);
        if (k >= res.size()) {
          problems.add("missing step " + w.get("step"));
          continue;
        }
        final JobRunner.StepResult got = res.get(k);
        if (w.get("outcome") instanceof String o && !got.outcome().startsWith(o)) problems.add(got.step() + " outcome " + got.outcome() + " (expected " + o + ")");
        if (w.get("return_code") instanceof BigDecimal rc && (got.returnCode() == null || got.returnCode() != rc.intValue())) problems.add(got.step() + " RC " + got.returnCode() + " (expected " + rc + ")");
        if (w.get("display_contains") instanceof List<?> d) for (Object line : d) if (got.display().stream().map(Scenarios::rtrim).noneMatch(x -> x.equals(Scenarios.rtrim((String) line)))) problems.add(got.step() + " DISPLAY lacks '" + line + "'");
      }
    }
    if (ex.get("datasets") instanceof Map<?, ?> outs) {
      for (Map.Entry<String, Object> e : ((Map<String, Object>) outs).entrySet()) {
        final Map<String, Object> d = (Map<String, Object>) e.getValue();
        final CobolFile f = fileFor(job, (String) d.get("dd"));
        final Path p = root.resolve(e.getKey());
        final List<String> got = Files.exists(p) ? Scenarios.decode(Files.readAllBytes(p), f) : null;
        final List<String> want = new ArrayList<>();
        for (Object x : (List<Object>) d.get("records")) want.add(Scenarios.rtrim((String) x));
        if (got == null || !got.equals(want)) problems.add("dataset " + e.getKey() + " " + got + " (expected " + want + ")");
      }
    }
    final String last = res.isEmpty() ? "" : res.get(res.size() - 1).outcome();
    if (problems.isEmpty()) r.result(id, last.startsWith("BLOCKED") ? "BLOCKED_AS_EXPECTED" : "PASS", last.startsWith("BLOCKED ") ? last.substring(8).split(" ")[0] : null, null);
    else r.result(id, "FAIL", null, String.join("; ", problems) + " | steps " + res);
  }

  /** The file definition (record length, format) of the program that a job step's DD belongs to. */
  static CobolFile fileFor(JobRunner.Job job, String dd) {
    for (JobRunner.Step s : job.steps()) {
      if (s.dds().stream().noneMatch(d -> d.name().equals(dd)) || !RunUnit.isRegistered(s.pgm())) continue;
      return Scenarios.fileByDd(new RunUnit().load(s.pgm()).items(), dd);
    }
    throw new IllegalArgumentException("no converted step of " + job.name() + " has DD " + dd);
  }

  @SuppressWarnings("unchecked")
  static String toJson(Object o) {
    if (o == null) return "null";
    if (o instanceof String s) {
      final StringBuilder b = new StringBuilder("\"");
      for (char c : s.toCharArray()) {
        if (c == '"' || c == '\\') b.append('\\').append(c);
        else if (c < 0x20 || c > 0x7e) b.append(String.format("\\u%04x", (int) c));
        else b.append(c);
      }
      return b.append('"').toString();
    }
    if (o instanceof BigDecimal || o instanceof Boolean) return o.toString();
    if (o instanceof Map<?, ?> m) {
      final List<String> parts = new ArrayList<>();
      for (Map.Entry<String, Object> e : ((Map<String, Object>) m).entrySet()) parts.add(toJson(e.getKey()) + ": " + toJson(e.getValue()));
      return "{" + String.join(", ", parts) + "}";
    }
    final List<String> parts = new ArrayList<>();
    for (Object x : (List<Object>) o) parts.add(toJson(x));
    return "[" + String.join(", ", parts) + "]";
  }
}
