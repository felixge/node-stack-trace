import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { get } from "../index.js";

describe("get", () => {
  it("basic", () => {
    (function testBasic() {
      var trace = get();

      assert.strictEqual(trace[0].getFunctionName(), 'testBasic');
      assert.strictEqual(trace[0].getFileName(), import.meta.url);
    })();
  });

  it("wrapper", () => {
    (function testWrapper() {
      (function testBelowFn() {
        var trace = get(testBelowFn);
        assert.strictEqual(trace[0].getFunctionName(), 'testWrapper');
      })();
    })();
  });

  it("deep", () => {
    (function deep1() {
      (function deep2() {
        (function deep3() {
          (function deep4() {
            (function deep5() {
              (function deep6() {
                (function deep7() {
                  (function deep8() {
                    (function deep9() {
                      (function deep10() {
                        (function deep10() {
                          const trace = get();
                          const hasFirstCallSite = trace.some(callSite => callSite.getFunctionName() === 'deep1');
                          assert.strictEqual(hasFirstCallSite, true);
                        })();
                      })();
                    })();
                  })();
                })();
              })();
            })();
          })();
        })();
      })();
    })();
  });
});