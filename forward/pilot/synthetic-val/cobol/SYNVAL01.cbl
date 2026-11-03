      *================================================================*
      * Program Name: SYNVAL01                                         *
      * SYNTHETIC PROGRAM - REVFORGE STEP 15 converter fixture.        *
      * An order-entry validation subroutine written for the converter *
      * tests. Not taken from, derived from or equivalent to any       *
      * program of the portfolio being modernised.                     *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID. SYNVAL01.

       ENVIRONMENT DIVISION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
           COPY SYNVALC.

       LINKAGE SECTION.
       01  OV-REQUEST.
           05  OV-KIND             PIC X(1).
               88  OV-KIND-CODE        VALUE 'C'.
               88  OV-KIND-QTY         VALUE 'Q'.
               88  OV-KIND-STATUS      VALUE 'S'.
               88  OV-KIND-PRICE       VALUE 'P'.
           05  OV-VALUE            PIC X(12).
           05  OV-RC               PIC S9(4) COMP.
           05  OV-MESSAGE          PIC X(30).

       PROCEDURE DIVISION USING OV-REQUEST.
       0000-MAIN.
           INITIALIZE OV-WORK

           EVALUATE TRUE
               WHEN OV-KIND-CODE
                   PERFORM 1000-CHECK-CODE
               WHEN OV-KIND-QTY
                   PERFORM 2000-CHECK-QTY
               WHEN OV-KIND-STATUS
                   PERFORM 3000-CHECK-STATUS
               WHEN OV-KIND-PRICE
                   PERFORM 4000-CHECK-PRICE
               WHEN OTHER
                   MOVE OV-BAD-REQUEST TO OV-RC
                   MOVE 'Unknown request kind' TO OV-MESSAGE
           END-EVALUATE

           GOBACK
           .

       1000-CHECK-CODE.
      * Code: the prefix 'ORD-' followed by three digits.
           IF OV-VALUE(1:4) NOT = OV-CODE-PREFIX
               MOVE OV-BAD-CODE TO OV-RC
               MOVE OV-MSG-CODE TO OV-MESSAGE
               EXIT PARAGRAPH
           END-IF

           MOVE OV-VALUE(5:3) TO OV-DIGITS
           IF OV-DIGITS IS NOT NUMERIC
               MOVE OV-BAD-CODE TO OV-RC
               MOVE OV-MSG-CODE TO OV-MESSAGE
               EXIT PARAGRAPH
           END-IF

           MOVE OV-OK TO OV-RC
           MOVE SPACES TO OV-MESSAGE
           .

       2000-CHECK-QTY.
      * Quantity: four digits, not all zero.
           IF OV-VALUE(1:4) IS NOT NUMERIC
           OR OV-VALUE(1:4) = ZEROS
               MOVE OV-BAD-QTY TO OV-RC
               MOVE OV-MSG-QTY TO OV-MESSAGE
               EXIT PARAGRAPH
           END-IF

           MOVE OV-OK TO OV-RC
           MOVE SPACES TO OV-MESSAGE
           .

       3000-CHECK-STATUS.
      * Status: exactly NEW, HLD or CAN.
           IF OV-VALUE NOT = 'NEW'
              AND NOT = 'HLD'
              AND NOT = 'CAN'
               MOVE OV-BAD-STATUS TO OV-RC
               MOVE OV-MSG-STATUS TO OV-MESSAGE
               EXIT PARAGRAPH
           END-IF

           MOVE OV-OK TO OV-RC
           MOVE SPACES TO OV-MESSAGE
           .

       4000-CHECK-PRICE.
      * Price: the first seven characters as whole currency units.
           MOVE OV-VALUE(1:7) TO OV-PRICE

           IF OV-PRICE < OV-MIN-PRICE
           OR OV-PRICE > OV-MAX-PRICE
               MOVE OV-BAD-PRICE TO OV-RC
               MOVE OV-MSG-PRICE TO OV-MESSAGE
               EXIT PARAGRAPH
           END-IF

           MOVE OV-OK TO OV-RC
           MOVE SPACES TO OV-MESSAGE
           .
