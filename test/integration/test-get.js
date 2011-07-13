var common = require('../common');
var assert = common.assert;
var stackTrace = require(common.dir.lib + '/stack-trace');

(function testBasic() {
  var trace = stackTrace.get();

  assert.strictEqual(trace[0].getFunction(), testBasic);
  assert.strictEqual(trace[0].getFileName(), __filename);
})();

(function testWrapper() {
  (function testBelowFn() {
    var trace = stackTrace.get(testBelowFn);
    assert.strictEqual(trace[0].getFunction(), testWrapper);
  })();
})();
