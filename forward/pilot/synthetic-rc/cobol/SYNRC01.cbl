       IDENTIFICATION DIVISION.
       PROGRAM-ID. SYNRC01.
      *****************************************************************
      * SYNTHETIC PILOT PROGRAM - REVFORGE STEP 11                     *
      * Written for the conversion pilot only. It is not taken from,  *
      * not derived from and not equivalent to any program of the     *
      * portfolio being modernised. Its behaviour is fully specified  *
      * in ../SPEC.md.                                                 *
      *****************************************************************
       ENVIRONMENT DIVISION.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-EXT-RC                 PIC S9(4) SIGN LEADING SEPARATE.
       LINKAGE SECTION.
       01  SYN-REQUEST.
           05 SYN-ACTION             PIC X.
              88 SYN-ACT-RESET           VALUE 'R'.
              88 SYN-ACT-POST            VALUE 'P'.
              88 SYN-ACT-QUERY           VALUE 'Q'.
              88 SYN-ACT-PUBLISH         VALUE 'U'.
           05 SYN-INPUT-CODE         PIC S9(4) SIGN LEADING SEPARATE.
           05 SYN-LAST-CODE          PIC S9(4) SIGN LEADING SEPARATE.
           05 SYN-PEAK-CODE          PIC S9(4) SIGN LEADING SEPARATE.
           05 SYN-SEVERITY           PIC X.
              88 SYN-SEV-CLEAR           VALUE 'C'.
              88 SYN-SEV-NOTICE          VALUE 'N'.
              88 SYN-SEV-FAULT           VALUE 'T'.
              88 SYN-SEV-ABORT           VALUE 'A'.
           05 SYN-OUT-CODE           PIC S9(4) SIGN LEADING SEPARATE.
           05 SYN-RESULT             PIC 9(2).
       PROCEDURE DIVISION USING SYN-REQUEST.
           EVALUATE TRUE
               WHEN SYN-ACT-RESET
                    PERFORM A100-RESET THRU A100-EXIT
               WHEN SYN-ACT-POST
                    PERFORM A200-POST THRU A200-EXIT
               WHEN SYN-ACT-QUERY
                    PERFORM A300-QUERY THRU A300-EXIT
               WHEN SYN-ACT-PUBLISH
                    PERFORM A400-PUBLISH THRU A400-EXIT
               WHEN OTHER
                    MOVE 90 TO SYN-RESULT
           END-EVALUATE.
           GOBACK.
       A100-RESET.
           MOVE 0 TO SYN-LAST-CODE.
           MOVE 0 TO SYN-PEAK-CODE.
           MOVE 0 TO SYN-OUT-CODE.
           SET SYN-SEV-CLEAR TO TRUE.
           MOVE 0 TO SYN-RESULT.
       A100-EXIT.
           EXIT.
       A200-POST.
           IF SYN-INPUT-CODE < 0
              MOVE 20 TO SYN-RESULT
           ELSE
              MOVE SYN-INPUT-CODE TO SYN-LAST-CODE
              IF SYN-INPUT-CODE > SYN-PEAK-CODE
                 MOVE SYN-INPUT-CODE TO SYN-PEAK-CODE
              END-IF
              EVALUATE SYN-INPUT-CODE
                  WHEN 0
                       SET SYN-SEV-CLEAR TO TRUE
                  WHEN 1 THRU 3
                       SET SYN-SEV-NOTICE TO TRUE
                  WHEN 4 THRU 11
                       SET SYN-SEV-FAULT TO TRUE
                  WHEN OTHER
                       SET SYN-SEV-ABORT TO TRUE
              END-EVALUATE
              MOVE 0 TO SYN-RESULT
           END-IF.
       A200-EXIT.
           EXIT.
       A300-QUERY.
           MOVE SYN-PEAK-CODE TO SYN-OUT-CODE.
           MOVE 0 TO SYN-RESULT.
       A300-EXIT.
           EXIT.
       A400-PUBLISH.
           CALL 'SYNEXT01' USING SYN-PEAK-CODE WS-EXT-RC.
           IF WS-EXT-RC = 0
              MOVE 0 TO SYN-RESULT
           ELSE
              MOVE 30 TO SYN-RESULT
           END-IF.
       A400-EXIT.
           EXIT.
