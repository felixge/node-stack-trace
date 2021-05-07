import { get, parse } from "../index.js";

describe("parse", () => {
  test("object in method name", () => {
    const err = {};
    err.stack =
      'Error: Foo\n' +
      '    at [object Object].global.every [as _onTimeout] (/Users/hoitz/develop/test.coffee:36:3)\n' +
      '    at Timer.listOnTimeout [as ontimeout] (timers.js:110:15)\n';

    const trace = parse(err);
    expect(trace[0].getFileName()).toBe("/Users/hoitz/develop/test.coffee");
    expect(trace[1].getFileName()).toBe("timers.js");
  });

  test("basic", () => {
    (function testBasic() {
      const err = new Error('something went wrong');
      const trace = parse(err);

      expect(trace[0].getFileName()).toBe(__filename);
      expect(trace[0].getFunctionName()).toBe('testBasic');
    })();
  });

  test("wrapper", () => {
    (function testWrapper() {
      (function testBelowFn() {
        const err = new Error('something went wrong');
        const trace = parse(err);
        expect(trace[0].getFunctionName()).toBe('testBelowFn');
        expect(trace[1].getFunctionName()).toBe('testWrapper');
      })();
    })();
  });

  test("no stack", () => {
    const err = { stack: undefined };
    const trace = parse(err);

    expect(trace).toStrictEqual([]);
  });

  test("test corrupt stack", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '    fuck' +
  '    at Test.run (/Users/felix/code/node-fast-or-slow/lib/test.js:45:10)\n' +
  'oh no' +
  '    at TestCase.run (/Users/felix/code/node-fast-or-slow/lib/test_case.js:61:8)\n';

    const trace = parse(err);
    expect(trace.length).toBe(2);
  });

  test("trace braces in path", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '    at Test.run (/Users/felix (something)/code/node-fast-or-slow/lib/test.js:45:10)\n' +
  '    at TestCase.run (/Users/felix (something)/code/node-fast-or-slow/lib/test_case.js:61:8)\n';

    const trace = parse(err);
    expect(trace.length).toBe(2);
    expect(trace[0].getFileName()).toBe('/Users/felix (something)/code/node-fast-or-slow/lib/test.js');
  });

  test("trace without column numbers", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '    at Test.fn (/Users/felix/code/node-fast-or-slow/test/fast/example/test-example.js:6)\n' +
  '    at Test.run (/Users/felix/code/node-fast-or-slow/lib/test.js:45)';

    const trace = parse(err);
    expect(trace[0].getFileName()).toBe("/Users/felix/code/node-fast-or-slow/test/fast/example/test-example.js");
    expect(trace[0].getLineNumber()).toBe(6);
    expect(trace[0].getColumnNumber()).toBeNull();
  });

  test("compare real with parsed stack trace", () => {
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

    realTrace.forEach(function(real, i) {
      var parsed = parsedTrace[i];

      function compare(method, exceptions) {
        let realValue = real[method]();
        const parsedValue = parsed[method]();

        if (exceptions && typeof exceptions[i] != 'undefined') {
          realValue = exceptions[i];
        }

        //const realJson = JSON.stringify(realValue);
        //const parsedJson = JSON.stringify(parsedValue);
        //console.log(method + ': ' + realJson + ' != ' + parsedJson + ' (#' + i + ')');
        expect(realValue).toBe(parsedValue);
      }

      compare('getFileName');
      compare('getFunctionName', {
        2: 'Object.asyncJestTest',
        4: 'new Promise'
      });
      compare('getTypeName', {
        7: null
      });
      compare('getMethodName', {
        2: 'asyncJestTest'
      });
      compare('getLineNumber', {
        0: 88,
        1: 92
      });
      compare('getColumnNumber', {
        0: 13
      });
      compare('isNative');
    });
  });

  test("stack with native call", () => {
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

    expect(nativeCallSite.getFileName()).toBeNull();
    expect(nativeCallSite.getFunctionName()).toBe('Array.0');
    expect(nativeCallSite.getTypeName()).toBe('Array');
    expect(nativeCallSite.getMethodName()).toBe('0');
    expect(nativeCallSite.getLineNumber()).toBeNull();
    expect(nativeCallSite.getColumnNumber()).toBeNull();
    expect(nativeCallSite.isNative()).toBe(true);
  });

  test("stack with file only", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\n' +
  '   at /Users/felix/code/node-fast-or-slow/lib/test_case.js:80:10';

    const trace = parse(err);
    var callSite = trace[0];

    expect(callSite.getFileName()).toBe('/Users/felix/code/node-fast-or-slow/lib/test_case.js');
    expect(callSite.getFunctionName()).toBeNull();
    expect(callSite.getTypeName()).toBeNull();
    expect(callSite.getMethodName()).toBeNull();
    expect(callSite.getLineNumber()).toBe(80);
    expect(callSite.getColumnNumber()).toBe(10);
    expect(callSite.isNative()).toBe(false);
  });

  test("stack with multiline message", () => {
    const err = {};
    err.stack =
  'AssertionError: true == false\nAnd some more shit\n' +
  '   at /Users/felix/code/node-fast-or-slow/lib/test_case.js:80:10';

    const trace = parse(err);
    var callSite = trace[0];

    expect(callSite.getFileName()).toBe('/Users/felix/code/node-fast-or-slow/lib/test_case.js');
  });

  test("stack with anonymous function call", () => {
    const err = {};
    err.stack =
  'AssertionError: expected [] to be arguments\n' +
  '    at Assertion.prop.(anonymous function) (/Users/den/Projects/should.js/lib/should.js:60:14)\n';

    const trace = parse(err);
    var callSite0 = trace[0];

    expect(callSite0.getFileName()).toBe('/Users/den/Projects/should.js/lib/should.js');
    expect(callSite0.getFunctionName()).toBe('Assertion.prop.(anonymous function)');
    expect(callSite0.getTypeName()).toBe("Assertion.prop");
    expect(callSite0.getMethodName()).toBe("(anonymous function)");
    expect(callSite0.getLineNumber()).toBe(60);
    expect(callSite0.getColumnNumber()).toBe(14);
    expect(callSite0.isNative()).toBe(false);
  });
});