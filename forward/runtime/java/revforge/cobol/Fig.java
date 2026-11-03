package revforge.cobol;

/** Figurative constants, including ALL literal. */
public final class Fig {
  public static final Fig SPACE = new Fig("SPACE", " ");
  public static final Fig ZERO = new Fig("ZERO", "0");
  public static final Fig HIGH_VALUE = new Fig("HIGH-VALUE", "ÿ");
  public static final Fig LOW_VALUE = new Fig("LOW-VALUE", "\u0000");
  public static final Fig QUOTE = new Fig("QUOTE", "\"");

  final String name;
  final String unit;

  private Fig(String name, String unit) {
    this.name = name;
    this.unit = unit;
  }

  /** ALL literal. */
  public static Fig all(String lit) {
    return new Fig("ALL", lit);
  }

  /** The constant repeated to {@code n} characters. */
  public String repeat(int n) {
    final StringBuilder b = new StringBuilder(n);
    while (b.length() < n) b.append(unit);
    return b.substring(0, n);
  }

  @Override
  public String toString() {
    return name;
  }
}
