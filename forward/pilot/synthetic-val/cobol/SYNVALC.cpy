      *================================================================*
      * SYNTHETIC COPYBOOK - REVFORGE STEP 15 converter fixture.       *
      * Not taken from, derived from or equivalent to any portfolio    *
      * copybook.                                                      *
      *================================================================*
       01  OV-RESULT-CODES.
           05  OV-OK               PIC S9(4) VALUE +0.
           05  OV-BAD-CODE         PIC S9(4) VALUE +11.
           05  OV-BAD-QTY          PIC S9(4) VALUE +12.
           05  OV-BAD-STATUS       PIC S9(4) VALUE +13.
           05  OV-BAD-PRICE        PIC S9(4) VALUE +14.
           05  OV-BAD-REQUEST      PIC S9(4) VALUE +19.
       01  OV-MESSAGES.
           05  OV-MSG-CODE         PIC X(30) VALUE
               'Order code rejected'.
           05  OV-MSG-QTY          PIC X(30) VALUE 'Quantity rejected'.
           05  OV-MSG-STATUS       PIC X(30) VALUE 'Status rejected'.
           05  OV-MSG-PRICE        PIC X(30) VALUE 'Price out of range'.
       01  OV-LIMITS.
           05  OV-CODE-PREFIX      PIC X(4) VALUE 'ORD-'.
           05  OV-MIN-PRICE        PIC S9(7)V99 VALUE +1.00.
           05  OV-MAX-PRICE        PIC S9(7)V99 VALUE +5000.00.
       01  OV-WORK.
           05  OV-DIGITS           PIC X(3).
           05  OV-PRICE            PIC S9(7)V99.
           05  OV-QTY-COUNT        PIC 9(4).
