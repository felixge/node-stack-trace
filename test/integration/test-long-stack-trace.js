var common = require('../common');

require('long-stack-traces');
var assert = common.assert;
var stackTrace = require(common.dir.lib + '/stack-trace');

function badFn() {
  var err = new Error('oh no');
  var trace = stackTrace.parse(err);

  for (var i in trace) {
    var filename = trace[i].getFileName();
    if (typeof filename === 'string' && filename.match(/-----/)) {
      assert.ok(true)
      return;
    }
  }
  assert.fail();
};

setTimeout(badFn, 10);
