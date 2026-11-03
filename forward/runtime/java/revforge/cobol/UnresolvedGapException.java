package revforge.cobol;

/**
 * Thrown on any path that depends on a preserved gap (behaviour the source
 * does not define, or an external system that is not available). It is never
 * caught and turned into a default result.
 */
public final class UnresolvedGapException extends RuntimeException {
  private static final long serialVersionUID = 1L;
  private final String gapId;

  public UnresolvedGapException(String gapId, String context) {
    super(gapId + ": " + context + " is unresolved; this path is blocked");
    this.gapId = gapId;
  }

  public String gapId() {
    return gapId;
  }

  /** Blocks the current path. */
  public static RuntimeException blocked(String gapId, String context) {
    throw new UnresolvedGapException(gapId, context);
  }
}
