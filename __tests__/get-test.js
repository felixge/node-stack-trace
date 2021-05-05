import { get } from "../index.js";

describe("get", () => {
  test("basic", () => {
    (function testBasic() {
      var trace = get();

      //expect(trace[0].getFunction()).toBe(testBasic);
      expect(trace[0].getFunctionName()).toBe('testBasic');
      expect(trace[0].getFileName()).toBe(__filename);
    })();
  });

  test("wrapper", () => {
    (function testWrapper() {
      (function testBelowFn() {
        var trace = get(testBelowFn);
        //expect(trace[0].getFunction()).toBe(testWrapper);
        expect(trace[0].getFunctionName()).toBe('testWrapper');
      })();
    })();
  });

  test("deep", () => {
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
                          expect(hasFirstCallSite).toBe(true);
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