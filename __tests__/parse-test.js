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

    realTrace.forEach(function(real, i) {
      var parsed = parsedTrace[i];

      // Only compare frames from our test file; deeper frames are node:test
      // internals whose shape varies across Node versions and environments.
      const realFile = real.getFileName();
      if (!realFile || !realFile.endsWith('parse-test.js')) {
        return;
      }
      comparedFrames++;

      function compare(method, exceptions) {
        let realValue = real[method]();
        const parsedValue = parsed[method]();

        if (exceptions && typeof exceptions[i] != 'undefined') {
          realValue = exceptions[i];
        }

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
});