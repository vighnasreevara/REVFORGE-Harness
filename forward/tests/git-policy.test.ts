/**
 * Git tracking policy: the hand-written Java runtime is tracked; generated
 * Java, Java outside the runtime package and compilation output never are.
 * Positive and negative cases on the pure classifier, and the policy applied
 * to the real repository (read only).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { describe, test } from 'node:test';
import { HANDWRITTEN_JAVA_ROOT, javaTrackingViolation, javaTrackingViolations, trackedJava } from './helpers/gitpolicy';
import { FORWARD_DIR } from './helpers/fixture';

const REPO = path.resolve(FORWARD_DIR, '..');
const runtimeFile = (pkg: string) => `package ${pkg};\n\npublic final class X {}\n`;

describe('git policy - Java tracking classifier', () => {
  test('the hand-written runtime is allowed when its package matches its directory', () => {
    assert.equal(javaTrackingViolation(`${HANDWRITTEN_JAVA_ROOT}Area.java`, runtimeFile('revforge.cobol')), null);
    assert.equal(javaTrackingViolation(`${HANDWRITTEN_JAVA_ROOT}batch/JobRunner.java`, runtimeFile('revforge.cobol.batch')), null);
    assert.equal(javaTrackingViolation(`${HANDWRITTEN_JAVA_ROOT}testing/RuntimeTests.java`, runtimeFile('revforge.cobol.testing')), null);
  });

  test('generated programs, Java elsewhere and mislabelled packages are violations', () => {
    assert.equal(javaTrackingViolation('forward/generated/java/PORTREAD/java/src/revforge/app/portread/Portread.java', runtimeFile('revforge.app.portread')), 'generated Java output');
    assert.equal(javaTrackingViolation('forward/generated/java/app/src/x.java', runtimeFile('revforge.cobol')), 'generated Java output');
    assert.match(javaTrackingViolation('forward/pilot/synthetic-rc/out/Gen.java', runtimeFile('revforge.cobol'))!, /outside the hand-written runtime/);
    assert.match(javaTrackingViolation('src/Main.java', runtimeFile('revforge.cobol'))!, /outside the hand-written runtime/);
    assert.match(javaTrackingViolation(`${HANDWRITTEN_JAVA_ROOT}generated/Gen.java`, runtimeFile('revforge.cobol.generated'))!, /generated Java output/);
    assert.match(javaTrackingViolation(`${HANDWRITTEN_JAVA_ROOT}Portread.java`, runtimeFile('revforge.app.portread'))!, /not the runtime package/, 'a generated program copied into the runtime directory');
    assert.match(javaTrackingViolation(`${HANDWRITTEN_JAVA_ROOT}batch/X.java`, runtimeFile('revforge.cobol'))!, /does not match its directory/);
    assert.match(javaTrackingViolation(`${HANDWRITTEN_JAVA_ROOT}X.java`, 'public class X {}')!, /package \(none\)/);
  });
});

describe('git policy - the real repository (read only)', () => {
  test('only the hand-written runtime is tracked, and all of it is', () => {
    assert.deepEqual(javaTrackingViolations(REPO), []);
    const tracked = trackedJava(REPO);
    const onDisk: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.java')) onDisk.push(path.relative(REPO, p).split(path.sep).join('/'));
      }
    };
    walk(path.join(REPO, HANDWRITTEN_JAVA_ROOT));
    assert.deepEqual([...tracked].sort(), onDisk.sort(), 'every hand-written runtime file is tracked (a fresh clone can build it)');
  });

  test('generated Java and compilation output stay ignored', () => {
    for (const p of ['forward/generated/java/PORTREAD/java/src/revforge/app/portread/Portread.java', 'forward/generated/java/app/classes/revforge/cobol/Area.class', 'forward/dist/runtime/src/cli.js']) {
      assert.equal(spawnSync('git', ['-C', REPO, 'check-ignore', '-q', p]).status, 0, `${p} must be ignored`);
    }
    assert.notEqual(spawnSync('git', ['-C', REPO, 'check-ignore', '-q', `${HANDWRITTEN_JAVA_ROOT}Area.java`]).status, 0, 'the hand-written runtime is not ignored');
    assert.equal(spawnSync('git', ['-C', REPO, 'ls-files', '*.class'], { encoding: 'utf8' }).stdout.trim(), '', 'no compiled class is tracked');
  });
});
