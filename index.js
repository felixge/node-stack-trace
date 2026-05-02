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

  // If the first line looks like a source location (path:line or path:line:col)
  // rather than an error message, capture it as the first frame. V8 prepends
  // source locations for CJS SyntaxError stacks. Two guards prevent false positives:
  //   1. /:\s/ — error messages contain ": " (colon+space); source paths don't.
  //   2. Scheme exclusion — network URLs and node: specifiers are not file paths.
  //      file:// is intentionally allowed.
  const firstLine = allLines[0];
  const sourceLocMatch = firstLine && firstLine.match(/^(.+?):(\d+)(?::(\d+))?$/);
  if (sourceLocMatch && !firstLine.match(/:\s/) && !firstLine.match(/^(?:https?|ftp|data|blob):\/\//) && !firstLine.startsWith('node:')) {
    const parsedLine = parseInt(sourceLocMatch[2], 10);
    const parsedCol = parseInt(sourceLocMatch[3], 10);
    frames.push(createParsedCallSite({
      fileName: sourceLocMatch[1],
      lineNumber: Number.isNaN(parsedLine) ? null : parsedLine,
      functionName: null,
      typeName: null,
      methodName: null,
      columnNumber: Number.isNaN(parsedCol) ? null : parsedCol,
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

      const parsedLine = parseInt(lineMatch[3], 10);
      const parsedCol  = parseInt(lineMatch[4], 10);
      const properties = {
        fileName: lineMatch[2] || null,
        lineNumber: Number.isNaN(parsedLine) ? null : parsedLine,
        functionName: functionName,
        typeName: typeName,
        methodName: methodName,
        columnNumber: Number.isNaN(parsedCol) ? null : parsedCol,
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
