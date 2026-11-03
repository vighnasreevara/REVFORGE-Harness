package revforge.cobol;

/** A level-88 condition name: single values and THRU ranges of its conditional variable. */
public final class Cond88 {
  final Field var;
  final Object[] lo;
  final Object[] hi;
  public final String name;

  /** {@code hi[k]} is null for a single value. */
  public Cond88(String name, Field var, Object[] lo, Object[] hi) {
    this.name = name;
    this.var = var;
    this.lo = lo;
    this.hi = hi;
  }

  /** The condition of one element of a table. */
  public Cond88 at(int... idx) {
    return new Cond88(name, var.at(idx), lo, hi);
  }

  public boolean isTrue() {
    for (int k = 0; k < lo.length; k++) {
      if (hi[k] == null ? Ops.eq(var, lo[k]) : Ops.compare(var, lo[k]) >= 0 && Ops.compare(var, hi[k]) <= 0) return true;
    }
    return false;
  }

  /** SET ... TO TRUE: the first value is moved to the conditional variable. */
  public void setTrue() {
    Ops.move(lo[0], var);
  }

  /** SET ... TO FALSE needs a WHEN SET TO FALSE clause; without it the statement is not defined. */
  public void setFalse(Object falseValue) {
    if (falseValue == null) throw UnresolvedGapException.blocked("RUNTIME-SET-FALSE", "SET " + name + " TO FALSE without a WHEN SET TO FALSE value");
    Ops.move(falseValue, var);
  }
}
