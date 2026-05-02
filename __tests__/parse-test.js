import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { get, parse } from "../index.js";

describe("parse", () => {
  it("object in method name", () => {
    const err = {};
    err.stack =
      'Error: Foo\n' +
      '    at [object Object].global.every [as _onTimeout] (/Users/hoitz/develop/test.coffee:36:3)\n' +
      '    at Timer.listOnTimeout [as ontimeout] (timers.js:110:15)\n';

    const trace = parse(err);
    assert.strictEqual(trace[0].getFileName(), "/Users/hoitz/develop/test.coffee");
    assert.strictEqual(trace[1].getFileName(), "timers.js");
  });

  // Regression test for https://github.com/felixge/node-stack-trace/issues/13
  it("[object Object] as type name in function", () => {
    const err = {};
    err.stack =
      'Error: Could not do something\n' +
      '  at [object Object].foo.bar (foo.js:1:2)\n';

    const trace = parse(err);
    assert.strictEqual(trace[0].getFileName(), 'foo.js');
    assert.strictEqual(trace[0].getFunctionName(), '[object Object].foo.bar');
    assert.strictEqual(trace[0].getTypeName(), '[object Object].foo');
    assert.strictEqual(trace[0].getMethodName(), 'bar');
    assert.strictEqual(trace[0].getLineNumber(), 1);
    assert.strictEqual(trace[0].getColumnNumber(), 2);
    assert.strictEqual(trace[0].isNative(), false);
  });

  it("basic", () => {
    (function testBasic() {
      const err = new Error('something went wrong');
      const trace = parse(err);

      assert.strictEqual(trace[0].getFileName(), import.meta.url);
      assert.strictEqual(trace[0].getFunctionName(), 'testBasic');
    })();
  });

  it("wrapper", () => {
    (function testWrapper() {
      (function testBelowFn() {
        const err = new Error('something went wrong');
        const trace = parse(err);
        assert.strictEqual(trace[0].getFunctionName(), 'testBelowFn');
        assert.strictEqual(trace[1].getFunctionName(), 'testWrapper');
      })();
    })();
  });

  it("no stack", () => {
    const err = { stack: undefined };
    const trace = parse(err);

    assert.deepStrictEqual(trace, []);
  });

  it("test corrupt stack", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '    fuck' +
  '    at Test.run (/Users/felix/code/node-fast-or-slow/lib/test.js:45:10)\n' +
  'oh no' +
  '    at TestCase.run (/Users/felix/code/node-fast-or-slow/lib/test_case.js:61:8)\n';

    const trace = parse(err);
    assert.strictEqual(trace.length, 2);
  });

  it("trace braces in path", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '    at Test.run (/Users/felix (something)/code/node-fast-or-slow/lib/test.js:45:10)\n' +
  '    at TestCase.run (/Users/felix (something)/code/node-fast-or-slow/lib/test_case.js:61:8)\n';

    const trace = parse(err);
    assert.strictEqual(trace.length, 2);
    assert.strictEqual(trace[0].getFileName(), '/Users/felix (something)/code/node-fast-or-slow/lib/test.js');
  });

  it("trace without column numbers", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '    at Test.fn (/Users/felix/code/node-fast-or-slow/test/fast/example/test-example.js:6)\n' +
  '    at Test.run (/Users/felix/code/node-fast-or-slow/lib/test.js:45)';

    const trace = parse(err);
    assert.strictEqual(trace[0].getFileName(), "/Users/felix/code/node-fast-or-slow/test/fast/example/test-example.js");
    assert.strictEqual(trace[0].getLineNumber(), 6);
    assert.strictEqual(trace[0].getColumnNumber(), null);
  });

  it("compare real with parsed stack trace", () => {
    var realTrace, err;
    function TestClass() {
    }
    TestClass.prototype.testFunc = function () {
      realTrace = get();
      err = new Error('something went wrong');
    }

    var testObj = new TestClass();
    testObj.testFunc();
    var parsedTrace = parse(err);

    let comparedFrames = 0;
    let userFrames = 0;

    realTrace.forEach(function(real, i) {
      var parsed = parsedTrace[i];

      // Only compare frames from our test file; deeper frames are node:test
      // internals whose shape varies across Node versions and environments.
      const realFile = real.getFileName();
      if (!realFile || !realFile.endsWith('parse-test.js')) {
        return;
      }
      comparedFrames++;

      const realFunctionName = real.getFunctionName();
      const realMethodName = real.getMethodName();
      if (
        (typeof realFunctionName === 'string' && realFunctionName.includes('testFunc')) ||
        realMethodName === 'testFunc'
      ) {
        userFrames++;
      }

      function compare(method) {
        const realValue = real[method]();
        const parsedValue = parsed[method]();

        assert.strictEqual(realValue, parsedValue);
      }

      compare('getFileName');
      compare('getFunctionName');
      compare('getTypeName');
      compare('getMethodName');
      // Line/column numbers are not compared because get() and new Error()
      // capture their stack traces at different source positions within testFunc.
      compare('isNative');
    });

    // Ensure the filter above didn't silently skip all frames.
    assert(comparedFrames > 0, `Expected at least one frame to be compared`);
    assert(userFrames > 0, `Expected at least one user-code testFunc frame to be compared`);
  });

  it("stack with native call", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '    at Test.fn (/Users/felix/code/node-fast-or-slow/test/fast/example/test-example.js:6:10)\n' +
  '    at Test.run (/Users/felix/code/node-fast-or-slow/lib/test.js:45:10)\n' +
  '    at TestCase.runNext (/Users/felix/code/node-fast-or-slow/lib/test_case.js:73:8)\n' +
  '    at TestCase.run (/Users/felix/code/node-fast-or-slow/lib/test_case.js:61:8)\n' +
  '    at Array.0 (native)\n' +
  '    at EventEmitter._tickCallback (node.js:126:26)';

    const trace = parse(err);
    var nativeCallSite = trace[4];

    assert.strictEqual(nativeCallSite.getFileName(), null);
    assert.strictEqual(nativeCallSite.getFunctionName(), 'Array.0');
    assert.strictEqual(nativeCallSite.getTypeName(), 'Array');
    assert.strictEqual(nativeCallSite.getMethodName(), '0');
    assert.strictEqual(nativeCallSite.getLineNumber(), null);
    assert.strictEqual(nativeCallSite.getColumnNumber(), null);
    assert.strictEqual(nativeCallSite.isNative(), true);
  });

  it("stack with file only", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '   at /Users/felix/code/node-fast-or-slow/lib/test_case.js:80:10';

    const trace = parse(err);
    var callSite = trace[0];

    assert.strictEqual(callSite.getFileName(), '/Users/felix/code/node-fast-or-slow/lib/test_case.js');
    assert.strictEqual(callSite.getFunctionName(), null);
    assert.strictEqual(callSite.getTypeName(), null);
    assert.strictEqual(callSite.getMethodName(), null);
    assert.strictEqual(callSite.getLineNumber(), 80);
    assert.strictEqual(callSite.getColumnNumber(), 10);
    assert.strictEqual(callSite.isNative(), false);
  });

  it("stack with multiline message", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\nAnd some more shit\n' +
  '   at /Users/felix/code/node-fast-or-slow/lib/test_case.js:80:10';

    const trace = parse(err);
    var callSite = trace[0];

    assert.strictEqual(callSite.getFileName(), '/Users/felix/code/node-fast-or-slow/lib/test_case.js');
  });

  it("stack with anonymous function call", () => {
    const err = {};
    err.stack =
  'AssertionError: expected [] to be arguments\n' +
  '    at Assertion.prop.(anonymous function) (/Users/den/Projects/should.js/lib/should.js:60:14)\n';

    const trace = parse(err);
    var callSite0 = trace[0];

    assert.strictEqual(callSite0.getFileName(), '/Users/den/Projects/should.js/lib/should.js');
    assert.strictEqual(callSite0.getFunctionName(), 'Assertion.prop.(anonymous function)');
    assert.strictEqual(callSite0.getTypeName(), "Assertion.prop");
    assert.strictEqual(callSite0.getMethodName(), "(anonymous function)");
    assert.strictEqual(callSite0.getLineNumber(), 60);
    assert.strictEqual(callSite0.getColumnNumber(), 14);
    assert.strictEqual(callSite0.isNative(), false);
  });

  // ---------------------------------------------------------------------------
  // Issue #29: SyntaxError source location
  // ---------------------------------------------------------------------------
  // When Node.js encounters a SyntaxError in a CJS module (via require()),
  // V8 prepends the source location as the very first line of err.stack:
  //
  //   /path/to/file.cjs:1          <- first line: file:lineNumber
  //   const x = @invalid;          <- offending code
  //             ^                  <- pointer
  //                                <- blank line
  //   SyntaxError: Invalid or unexpected token
  //       at wrapSafe (node:internal/modules/cjs/loader:1762:18)
  //       at Module._compile (node:internal/modules/cjs/loader:1803:20)
  //
  // This format is produced by Node 20+ (verified on v25.9.0).
  // ESM SyntaxErrors produce a standard "SyntaxError: message" first line instead
  // (no prepended source location), so no change is needed for the ESM case.
  //
  // Tests marked [REQUIRES FIX] fail against the original parse() and pass
  // only after the source-location detection change in index.js.
  // Tests marked [REGRESSION] verify no existing behaviour was broken.

  // [REQUIRES FIX] CJS SyntaxError - fixture matches actual Node 20+ output
  it("SyntaxError CJS: source location captured as first frame", () => {
    // Fixture derived from real Node 20+/25 CJS SyntaxError stack:
    //   require('/path/to/bad.cjs') where bad.cjs contains "const x = @invalid;"
    const err = {};
    err.stack =
      '/path/to/bad.cjs:1\n' +
      'const x = @invalid;\n' +
      '          ^\n' +
      '\n' +
      'SyntaxError: Invalid or unexpected token\n' +
      '    at wrapSafe (node:internal/modules/cjs/loader:1762:18)\n' +
      '    at Module._compile (node:internal/modules/cjs/loader:1803:20)';

    const trace = parse(err);

    // Frame 0: the source location line
    assert.strictEqual(trace[0].getFileName(), '/path/to/bad.cjs');
    assert.strictEqual(trace[0].getLineNumber(), 1);
    assert.strictEqual(trace[0].getColumnNumber(), null);
    assert.strictEqual(trace[0].getFunctionName(), null);
    assert.strictEqual(trace[0].getTypeName(), null);
    assert.strictEqual(trace[0].getMethodName(), null);
    assert.strictEqual(trace[0].isNative(), false);

    // Frame 1+: normal at-frames
    assert.strictEqual(trace[1].getFunctionName(), 'wrapSafe');
    assert.strictEqual(trace[1].getFileName(), 'node:internal/modules/cjs/loader');
    assert.strictEqual(trace[1].getLineNumber(), 1762);
    assert.strictEqual(trace[1].getColumnNumber(), 18);
    assert.strictEqual(trace[2].getFunctionName(), 'Module._compile');
    assert.strictEqual(trace[2].getFileName(), 'node:internal/modules/cjs/loader');
    assert.strictEqual(trace[2].getLineNumber(), 1803);
  });

  // [REQUIRES FIX] CJS SyntaxError with column in source location
  it("SyntaxError CJS: source location with column number captured", () => {
    const err = {};
    err.stack =
      '/path/to/bad.cjs:22:5\n' +
      'unexpected code here\n' +
      '    ^\n' +
      '\n' +
      'SyntaxError: Unexpected identifier\n' +
      '    at wrapSafe (node:internal/modules/cjs/loader:1762:18)';

    const trace = parse(err);

    assert.strictEqual(trace[0].getFileName(), '/path/to/bad.cjs');
    assert.strictEqual(trace[0].getLineNumber(), 22);
    assert.strictEqual(trace[0].getColumnNumber(), 5);
    assert.strictEqual(trace[0].getFunctionName(), null);
    assert.strictEqual(trace[0].isNative(), false);

    assert.strictEqual(trace[1].getFunctionName(), 'wrapSafe');
    assert.strictEqual(trace[1].getLineNumber(), 1762);
  });

  // [REQUIRES FIX] CJS SyntaxError on Windows - drive letter path
  it("SyntaxError CJS: Windows drive-letter path captured", () => {
    // Windows CJS SyntaxError: C:\path\to\file.cjs:15
    const err = {};
    err.stack =
      'C:\\Users\\dev\\project\\index.cjs:15\n' +
      'const x = @invalid;\n' +
      '          ^\n' +
      '\n' +
      'SyntaxError: Invalid or unexpected token\n' +
      '    at wrapSafe (node:internal/modules/cjs/loader:1762:18)';

    const trace = parse(err);

    assert.strictEqual(trace[0].getFileName(), 'C:\\Users\\dev\\project\\index.cjs');
    assert.strictEqual(trace[0].getLineNumber(), 15);
    assert.strictEqual(trace[0].getColumnNumber(), null);
    assert.strictEqual(trace[0].getFunctionName(), null);

    assert.strictEqual(trace[1].getFunctionName(), 'wrapSafe');
  });

  // [REQUIRES FIX - defensive] file:// source location (possible in some environments)
  // Although Node 20+ CJS SyntaxErrors do not produce file:// first lines in practice,
  // the parser should handle this form correctly and not exclude it.
  it("file:// source location is captured correctly (defensive)", () => {
    const err = {};
    err.stack =
      'file:///path/to/bad.js:10\n' +
      'bad code;\n' +
      '^\n' +
      '\n' +
      'SyntaxError: Unexpected token\n' +
      '    at wrapSafe (node:internal/modules/cjs/loader:1762:18)';

    const trace = parse(err);

    assert.strictEqual(trace[0].getFileName(), 'file:///path/to/bad.js');
    assert.strictEqual(trace[0].getLineNumber(), 10);
    assert.strictEqual(trace[0].getColumnNumber(), null);
    assert.strictEqual(trace[0].getFunctionName(), null);
    assert.strictEqual(trace[0].isNative(), false);
    assert.strictEqual(trace[1].getFunctionName(), 'wrapSafe');
  });

  // [REGRESSION] ESM SyntaxError produces a standard first line — no source loc frame
  // Verified on Node 25.9: "import('/tmp/bad.mjs')" where bad.mjs has invalid syntax
  // produces: "SyntaxError: Invalid or unexpected token\n    at compileSourceTextModule..."
  // The parse() output should be the at-frames only, no prepended source loc frame.
  it("ESM SyntaxError: standard message first line, no source loc prepended", () => {
    // Actual ESM SyntaxError format from Node 20+ (no source location prefix line)
    const err = {};
    err.stack =
      'SyntaxError: Invalid or unexpected token\n' +
      '    at compileSourceTextModule (node:internal/modules/esm/utils:354:16)\n' +
      '    at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:91:18)';

    const trace = parse(err);

    // No source location frame — first frame is the first at-frame
    assert.strictEqual(trace.length, 2);
    assert.strictEqual(trace[0].getFunctionName(), 'compileSourceTextModule');
    assert.strictEqual(trace[0].getFileName(), 'node:internal/modules/esm/utils');
    assert.strictEqual(trace[0].getLineNumber(), 354);
    assert.strictEqual(trace[1].getFunctionName(), 'ModuleLoader.moduleStrategy');
  });

  // [REGRESSION] Normal errors are not affected
  it("normal Error stack is not affected by source location detection", () => {
    const err = {};
    err.stack =
      'Error: something went wrong\n' +
      '    at foo (/path/to/file.js:10:5)\n' +
      '    at bar (/path/to/file.js:20:3)';

    const trace = parse(err);

    assert.strictEqual(trace.length, 2);
    assert.strictEqual(trace[0].getFunctionName(), 'foo');
    assert.strictEqual(trace[0].getFileName(), '/path/to/file.js');
    assert.strictEqual(trace[1].getFunctionName(), 'bar');
  });

  // [REGRESSION] TypeError not affected
  it("TypeError stack is not affected by source location detection", () => {
    // Actual Node 20+ TypeError format
    const err = {};
    err.stack =
      'TypeError: Cannot read properties of null (reading \'x\')\n' +
      '    at Object.method (/app/index.js:5:10)';

    const trace = parse(err);

    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].getFunctionName(), 'Object.method');
  });

  // [REGRESSION] RangeError not affected
  it("RangeError stack is not affected by source location detection", () => {
    const err = {};
    err.stack =
      'RangeError: Maximum call stack size exceeded\n' +
      '    at recursive (/app/index.js:3:5)';

    const trace = parse(err);

    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].getFunctionName(), 'recursive');
  });

  // [REGRESSION] Custom exception types with messages containing colon+digits
  it("custom error type with message ending in digits is not treated as source loc", () => {
    // "MyException: /path:10" has ": " so guard correctly excludes it
    const err = {};
    err.stack =
      'MyException: /path/to/file.js:10\n' +
      '    at fn (file.js:1:2)';

    const trace = parse(err);
    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].getFunctionName(), 'fn');
  });

  // [REGRESSION] URL schemes excluded (http/https/ftp/data/blob)
  it("http URL is not treated as source loc", () => {
    const err = {};
    err.stack = 'http://localhost:3000\n    at fn (file.js:1:2)';
    const trace = parse(err);
    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].getFunctionName(), 'fn');
  });

  it("https URL is not treated as source loc", () => {
    const err = {};
    err.stack = 'https://example.com:443\n    at fn (file.js:1:2)';
    const trace = parse(err);
    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].getFunctionName(), 'fn');
  });

  it("error message with colon+digits is not treated as source loc", () => {
    const err = {};
    err.stack = 'MyFault: status:404\n    at fn (file.js:1:2)';
    const trace = parse(err);
    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].getFunctionName(), 'fn');
  });

  it("empty first line does not produce source loc frame", () => {
    const err = {};
    err.stack = '\n    at fn (file.js:1:2)';
    const trace = parse(err);
    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].getFunctionName(), 'fn');
  });

  // [REGRESSION] forEach+push is equivalent to map+filter: no falsy entries in output
  it("non-parseable lines produce no entries in output array", () => {
    // Ensures the forEach+push refactor correctly skips non-matching lines,
    // equivalent to the prior map().filter(Boolean) implementation.
    const err = {};
    err.stack =
      'Error: test\n' +
      '    some junk line\n' +
      '    more junk\n' +
      '    at fn (file.js:1:2)\n' +
      '    ~~~not valid~~~\n' +
      '    at bar (file.js:5:3)';

    const trace = parse(err);
    assert.strictEqual(trace.length, 2);
    assert.strictEqual(trace[0].getFunctionName(), 'fn');
    assert.strictEqual(trace[1].getFunctionName(), 'bar');
    trace.forEach(site => {
      assert.notStrictEqual(site, undefined);
      assert.notStrictEqual(site, null);
    });
  });

  it("returns a new array each call (no shared state)", () => {
    const err = { stack: 'Error: x\n    at fn (file.js:1:2)' };
    const trace1 = parse(err);
    const trace2 = parse(err);
    assert.notStrictEqual(trace1, trace2);
    assert.strictEqual(trace1.length, trace2.length);
  });

  // [SECURITY] ReDoS: both regexes must complete fast on adversarial input
  it("at-line regex does not hang on adversarial input", () => {
    // Stress /at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/
    const adversarial = '    at ' + 'a'.repeat(10000) + '(' + 'b'.repeat(10000) + ')';
    const err = { stack: 'Error: test\n' + adversarial };
    const start = performance.now();
    const trace = parse(err);
    const elapsed = performance.now() - start;
    assert(elapsed < 100, `parse took ${elapsed.toFixed(1)}ms on adversarial input — possible ReDoS`);
    assert.strictEqual(trace.length, 1);
  });

  it("source-loc regex does not hang on adversarial first line", () => {
    // Stress /^(.+?):(\d+)(?::(\d+))?$/ with a very long path
    const longPath = 'a'.repeat(50000);
    const err = { stack: longPath + ':1\n    at fn (file.js:1:2)' };
    const start = performance.now();
    const trace = parse(err);
    const elapsed = performance.now() - start;
    assert(elapsed < 100, `parse took ${elapsed.toFixed(1)}ms on adversarial source loc — possible ReDoS`);
    assert.strictEqual(trace[0].getFileName(), longPath);
    assert.strictEqual(trace[0].getLineNumber(), 1);
  });
});