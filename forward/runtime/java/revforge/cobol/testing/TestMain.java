package revforge.cobol.testing;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Function;
import revforge.cobol.CobolProgram;
import revforge.cobol.RunUnit;

/**
 * Runs the tests of converted programs: TestMain (programClass [fixtures.json|-])...
 * Each program class is registered in the run-unit registry, its generated
 * checks (VALUE clauses, gap probes) run, then its source-derived scenarios.
 */
public final class TestMain {
  private TestMain() {}

  public static void main(String[] args) throws Exception {
    final Report r = new Report(System.out);
    // --isolated: each program runs its tests with only itself registered (as in its own conversion).
    final boolean isolated = args.length > 0 && args[0].equals("--isolated");
    if (isolated) args = java.util.Arrays.copyOfRange(args, 1, args.length);
    if (!isolated) for (int i = 0; i < args.length; i += 2) register(args[i]);
    for (int i = 0; i < args.length; i += 2) {
      if (isolated) {
        RunUnit.unregisterAll();
        register(args[i]);
      }
      final Class<?> c = Class.forName(args[i]);
      final String id = (String) c.getField("PROGRAM_ID").get(null);
      if (args.length > 2) r.prefix = id + ":";
      try {
        Class.forName(args[i] + "Tests").getMethod("run", Report.class).invoke(null, r);
      } catch (ReflectiveOperationException e) {
        r.result("TESTS " + id, "FAIL", null, String.valueOf(e.getCause() == null ? e : e.getCause()));
      }
      if (i + 1 < args.length && !args[i + 1].equals("-") && Files.exists(Path.of(args[i + 1]))) Scenarios.run(id, Path.of(args[i + 1]), r);
    }
    System.out.println("SUMMARY|" + r.pass + "|" + r.blocked + "|" + r.fail);
  }

  static void register(String className) throws ReflectiveOperationException {
    final Class<?> c = Class.forName(className);
    final String id = (String) c.getField("PROGRAM_ID").get(null);
    final java.lang.reflect.Constructor<?> k = c.getConstructor(RunUnit.class);
    final Function<RunUnit, CobolProgram> f = ru -> {
      try {
        return (CobolProgram) k.newInstance(ru);
      } catch (ReflectiveOperationException e) {
        throw new IllegalStateException(e);
      }
    };
    RunUnit.register(id, f);
  }
}
