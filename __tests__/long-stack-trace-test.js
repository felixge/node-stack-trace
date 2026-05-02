import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from "../index.js";

// Previously this test used the unmaintained 'long-stack-traces' package
// (https://github.com/tlrobinson/long-stack-traces) which monkeypatched
// async APIs to insert dashed separator lines into Error#stack across event
// loop boundaries. That package (and its suggested replacement 'longjohn')
// are both unmaintained and incompatible with modern Node.js ESM.
//
// The parser behavior is preserved: parse() detects lines matching /^\s*[-]{4,}$/
// and returns a CallSite with getFileName() === the dashed line. This test
// validates that behavior deterministically using a synthetic stack string.

describe("long stack trace", () => {
  it("parses event loop boundary markers", () => {
    const err = {
      stack:
        'Error: oh no\n' +
        '    at badFn (/path/to/file.js:10:5)\n' +
        '    ----------------------------------------\n' +
        '    at setTimeout\n' +
        '    at Object.<anonymous> (/path/to/file.js:20:3)'
    };

    const trace = parse(err);

    const boundary = trace.find((site) => {
      const fileName = site.getFileName();
      return typeof fileName === 'string' && fileName.match(/-----/);
    });

    assert.notStrictEqual(boundary, undefined);
    assert.match(boundary.getFileName(), /-----/);
  });
});