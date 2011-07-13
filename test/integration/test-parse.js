var common = require('../common');
var assert = common.assert;
var stackTrace = require(common.dir.lib + '/stack-trace');

(function testBasic() {
  var err = new Error('something went wrong');
  var trace = stackTrace.parse(err);

  assert.strictEqual(trace[0].getFileName(), __filename);
  assert.strictEqual(trace[0].getFunctionName(), 'testBasic');
})();

(function testWrapper() {
  (function testBelowFn() {
    var err = new Error('something went wrong');
    var trace = stackTrace.parse(err);
    assert.strictEqual(trace[0].getFunctionName(), 'testBelowFn');
    assert.strictEqual(trace[1].getFunctionName(), 'testWrapper');
  })();
})();

(function testSymmetry() {
    var realTrace = stackTrace.get(); var err = new Error('something went wrong');
    var parsedTrace = stackTrace.parse(err);

    realTrace.forEach(function(real, i) {
      var parsed = parsedTrace[i];

      function compare(method, exceptions) {
        var realValue = real[method]();
        var parsedValue = parsed[method]();

        if (exceptions && exceptions[i]) {
          realValue = exceptions[i];
        }

        var realJson = JSON.stringify(realValue);
        var parsedJson = JSON.stringify(parsedValue);

        var message =
          method + ': ' + realJson + ' != ' + parsedJson + ' (#' + i + ')';

        assert.strictEqual(realValue, parsedValue, message);
      }

      compare('getFileName');
      compare('getFunctionName', {
        3: 'Object..js',
        5: 'Function._load',
        6: 'Array.0',
        7: 'EventEmitter._tickCallback',
      });
      compare('getTypeName');
      compare('getMethodName');
      compare('getLineNumber');
      compare('getColumnNumber', {
        0: 49
      });
    });
})();
