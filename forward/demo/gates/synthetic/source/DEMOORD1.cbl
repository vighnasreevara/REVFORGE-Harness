      *================================================================*
      * DEMOORD1 - SYNTHETIC ORDER PRICING PROGRAM                     *
      * SYNTHETIC INTERVIEW DEMONSTRATION ONLY. Written for the        *
      * REVFORGE G0-G8 gate demonstration (MIT licensed, no restricted *
      * source). It is NOT part of the modernized application.         *
      *                                                                *
      * Prices one order of 1 to 5 lines. All amounts are integer      *
      * cents. Tier discount: GOLD/PLATINUM 5% from 10000 cents,       *
      * PLATINUM 15% from 50000 cents (truncated to whole cents).      *
      * Shipping 695 cents below a net of 7500 cents, otherwise free.  *
      * Return codes: 0 OK, 4 unknown tier, 8 line count not 1-5,      *
      * 12 a line with quantity zero (amounts are then zero).          *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID. DEMOORD1.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-WORK.
           05  WS-IDX                  PIC 9(2)      VALUE 0.
           05  WS-LINE-TOTAL           PIC 9(9)      VALUE 0.
           05  WS-NET                  PIC 9(9)      VALUE 0.
       LINKAGE SECTION.
       01  LS-ORDER.
           05  LS-TIER                 PIC X(1).
               88  TIER-STANDARD       VALUE 'S'.
               88  TIER-GOLD           VALUE 'G'.
               88  TIER-PLATINUM       VALUE 'P'.
           05  LS-LINE-COUNT           PIC 9(2).
           05  LS-LINE OCCURS 5 TIMES.
               10  LS-QTY              PIC 9(3).
               10  LS-UNIT-CENTS       PIC 9(5).
           05  LS-SUBTOTAL-CENTS       PIC 9(9).
           05  LS-DISCOUNT-CENTS       PIC 9(9).
           05  LS-SHIPPING-CENTS       PIC 9(5).
           05  LS-TOTAL-CENTS          PIC 9(9).
           05  LS-RETURN-CODE          PIC 9(2).
       PROCEDURE DIVISION USING LS-ORDER.
       0000-MAIN.
           MOVE 0 TO LS-SUBTOTAL-CENTS
           MOVE 0 TO LS-DISCOUNT-CENTS
           MOVE 0 TO LS-SHIPPING-CENTS
           MOVE 0 TO LS-TOTAL-CENTS
           MOVE 0 TO LS-RETURN-CODE
           IF LS-LINE-COUNT < 1 OR LS-LINE-COUNT > 5
               MOVE 8 TO LS-RETURN-CODE
               GOBACK
           END-IF
           IF NOT TIER-STANDARD AND NOT TIER-GOLD
              AND NOT TIER-PLATINUM
               MOVE 4 TO LS-RETURN-CODE
               GOBACK
           END-IF
           PERFORM 1000-PRICE-LINE
               VARYING WS-IDX FROM 1 BY 1
               UNTIL WS-IDX > LS-LINE-COUNT
           IF LS-RETURN-CODE NOT = 0
               MOVE 0 TO LS-SUBTOTAL-CENTS
               GOBACK
           END-IF
           PERFORM 2000-APPLY-DISCOUNT
           PERFORM 3000-APPLY-SHIPPING
           COMPUTE LS-TOTAL-CENTS = LS-SUBTOTAL-CENTS
                   - LS-DISCOUNT-CENTS + LS-SHIPPING-CENTS
           GOBACK.
       1000-PRICE-LINE.
           IF LS-QTY (WS-IDX) = 0
               MOVE 12 TO LS-RETURN-CODE
           ELSE
               COMPUTE WS-LINE-TOTAL =
                   LS-QTY (WS-IDX) * LS-UNIT-CENTS (WS-IDX)
               ADD WS-LINE-TOTAL TO LS-SUBTOTAL-CENTS
           END-IF.
       2000-APPLY-DISCOUNT.
           EVALUATE TRUE
               WHEN TIER-PLATINUM AND LS-SUBTOTAL-CENTS >= 50000
                   COMPUTE LS-DISCOUNT-CENTS =
                       LS-SUBTOTAL-CENTS * 15 / 100
               WHEN (TIER-GOLD OR TIER-PLATINUM)
                    AND LS-SUBTOTAL-CENTS >= 10000
                   COMPUTE LS-DISCOUNT-CENTS =
                       LS-SUBTOTAL-CENTS * 5 / 100
               WHEN OTHER
                   MOVE 0 TO LS-DISCOUNT-CENTS
           END-EVALUATE.
       3000-APPLY-SHIPPING.
           COMPUTE WS-NET = LS-SUBTOTAL-CENTS - LS-DISCOUNT-CENTS
           IF WS-NET >= 7500
               MOVE 0 TO LS-SHIPPING-CENTS
           ELSE
               MOVE 695 TO LS-SHIPPING-CENTS
           END-IF.
