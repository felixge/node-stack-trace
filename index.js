export function get(belowFn) {
  const oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;

  const dummyObject = {};

  const v8Handler = Error.prepareStackTrace;
  Error.prepareStackTrace = function(dummyObject, v8StackTrace) {
    return v8StackTrace;
  };
  Error.captureStackTrace(dummyObject, belowFn || get);

  const v8StackTrace = dummyObject.stack;
  Error.prepareStackTrace = v8Handler;
  Error.stackTraceLimit = oldLimit;

  return v8StackTrace;
}

export function parse(err) {
  if (!err.stack) {
    return [];
  }

  const allLines = err.stack.split('\n');
  const frames = [];

  // Check if the first line is a source location rather than an error message.
  //
  // V8 prepends source location lines for CJS SyntaxError stacks (e.g. require()
  // on a file with a syntax error). The format is one of:
  //
  //   /path/to/file.cjs:lineNumber              (POSIX, Node 10+, verified Node 20/24/25)
  //   /path/to/file.cjs:lineNumber:columnNumber
  //   C:\path\to\file.cjs:lineNumber            (Windows drive-letter paths)
  //   file:///path/to/file.js:lineNumber        (defensive: file:// variant)
  //
  // ESM SyntaxErrors on Node 20+ do NOT produce a source location line; they emit
  // a standard "SyntaxError: message" first line identical to other error types.
  //
  // Detection uses two guards (both must be false to treat the line as a source loc):
  //   1. /:\s/  — error messages always contain ": " (colon+space). Source location
  //               lines like "/path/to/file.js:10" never do.
  //   2. /^(?:https?|ftp|data|blob):\/\//  — excludes network/data URL schemes.
  //               file:// is intentionally permitted (valid source location prefix).
  //               node: scheme paths (e.g. "node:internal/modules") don't use "://"
  //               so they are already excluded by guard #1 or by failing the regex.
  //
  // Tested on Node 24.x and 25.x (CI matrix). Verified against the
  // @exceptionless/node package test suite to confirm no regressions.
  const firstLine = allLines[0];
  const sourceLocMatch = firstLine && firstLine.match(/^(.+?):(\d+)(?::(\d+))?$/);
  if (sourceLocMatch && !firstLine.match(/:\s/) && !firstLine.match(/^(?:https?|ftp|data|blob):\/\//)) {
    frames.push(createParsedCallSite({
      fileName: sourceLocMatch[1],
      lineNumber: parseInt(sourceLocMatch[2], 10) || null,
      functionName: null,
      typeName: null,
      methodName: null,
      columnNumber: parseInt(sourceLocMatch[3], 10) || null,
      'native': false,
    }));
  }

  const lines = allLines.slice(1);
  lines.forEach(function(line) {
      if (line.match(/^\s*[-]{4,}$/)) {
        frames.push(createParsedCallSite({
          fileName: line,
          lineNumber: null,
          functionName: null,
          typeName: null,
          methodName: null,
          columnNumber: null,
          'native': null,
        }));
        return;
      }

      const lineMatch = line.match(/at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/);
      if (!lineMatch) {
        return;
      }

      let object = null;
      let method = null;
      let functionName = null;
      let typeName = null;
      let methodName = null;
      let isNative = (lineMatch[5] === 'native');

      if (lineMatch[1]) {
        functionName = lineMatch[1];
        let methodStart = functionName.lastIndexOf('.');
        if (functionName[methodStart-1] == '.')
          methodStart--;
        if (methodStart > 0) {
          object = functionName.substr(0, methodStart);
          method = functionName.substr(methodStart + 1);
          const objectEnd = object.indexOf('.Module');
          if (objectEnd > 0) {
            functionName = functionName.substr(objectEnd + 1);
            object = object.substr(0, objectEnd);
          }
        }
      }

      if (method) {
        typeName = object;
        methodName = method;
      }

      if (method === '<anonymous>') {
        methodName = null;
        functionName = null;
      }

      const properties = {
        fileName: lineMatch[2] || null,
        lineNumber: parseInt(lineMatch[3], 10) || null,
        functionName: functionName,
        typeName: typeName,
        methodName: methodName,
        columnNumber: parseInt(lineMatch[4], 10) || null,
        'native': isNative,
      };

      frames.push(createParsedCallSite(properties));
  });

  return frames;
}

function CallSite(properties) {
  for (const property in properties) {
    this[property] = properties[property];
  }
}

const strProperties = [
  'this',
  'typeName',
  'functionName',
  'methodName',
  'fileName',
  'lineNumber',
  'columnNumber',
  'function',
  'evalOrigin'
];

const boolProperties = [
  'topLevel',
  'eval',
  'native',
  'constructor'
];

strProperties.forEach(function (property) {
  CallSite.prototype[property] = null;
  CallSite.prototype['get' + property[0].toUpperCase() + property.substr(1)] = function () {
    return this[property];
  }
});

boolProperties.forEach(function (property) {
  CallSite.prototype[property] = false;
  CallSite.prototype['is' + property[0].toUpperCase() + property.substr(1)] = function () {
    return this[property];
  }
});

function createParsedCallSite(properties) {
  return new CallSite(properties);
}
