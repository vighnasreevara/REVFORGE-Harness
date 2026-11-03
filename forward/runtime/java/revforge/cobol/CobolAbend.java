package revforge.cobol;

/**
 * A run-time condition that ends the run unit abnormally, as the legacy
 * runtime would: invalid numeric data (S0C7), division by zero (S0CB),
 * a subscript out of range, a size error the program does not handle, or a
 * LINKAGE mismatch. The code names the condition; nothing is defaulted.
 */
public final class CobolAbend extends RuntimeException {
  private static final long serialVersionUID = 1L;
  private final String code;

  public CobolAbend(String code, String detail) {
    super(code + ": " + detail);
    this.code = code;
  }

  public String code() {
    return code;
  }
}
