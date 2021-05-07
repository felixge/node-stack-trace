import { parse } from "../index.js";
const _ = require('long-stack-traces');

describe("long stack trace", () => {
  test("basic", (done) => {
    function badFn() {
      var err = new Error('oh no');
      var trace = parse(err);

      for (var i in trace) {
        var filename = trace[i].getFileName();
        if (typeof filename === 'string' && filename.match(/-----/)) {
          done();
          return;
        }
      }
      expect.fail();
    }

    setTimeout(badFn, 10);
  });
});