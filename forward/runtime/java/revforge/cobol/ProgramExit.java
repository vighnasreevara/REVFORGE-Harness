package revforge.cobol;

/** GOBACK / EXIT PROGRAM (return to the caller) or STOP RUN (end of the run unit). */
public final class ProgramExit extends RuntimeException {
  private static final long serialVersionUID = 1L;
  final boolean stopRun;

  ProgramExit(boolean stopRun) {
    super(stopRun ? "STOP RUN" : "GOBACK", null, false, false);
    this.stopRun = stopRun;
  }

  public boolean isStopRun() {
    return stopRun;
  }
}
