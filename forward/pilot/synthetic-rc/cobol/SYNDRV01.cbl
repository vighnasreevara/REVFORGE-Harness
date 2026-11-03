       IDENTIFICATION DIVISION.
       PROGRAM-ID. SYNDRV01.
      *****************************************************************
      * SYNTHETIC PILOT TEST DRIVER - REVFORGE STEP 11                 *
      * Reads one 24-character SYN-REQUEST image per input line,      *
      * calls SYNRC01 and displays the image after the call. Input    *
      * ends at a line starting with '*END'. Used only to capture a   *
      * COBOL reference run when a COBOL compiler is available.       *
      *****************************************************************
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-LINE                   PIC X(24).
       01  WS-DONE                   PIC X VALUE 'N'.
       01  WS-REQUEST                PIC X(24).
       PROCEDURE DIVISION.
           PERFORM UNTIL WS-DONE = 'Y'
              ACCEPT WS-LINE
              IF WS-LINE(1:4) = '*END'
                 MOVE 'Y' TO WS-DONE
              ELSE
                 MOVE WS-LINE TO WS-REQUEST
                 CALL 'SYNRC01' USING WS-REQUEST
                 DISPLAY WS-REQUEST
              END-IF
           END-PERFORM.
           STOP RUN.
