exports.get = function(belowFn) {
  var oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;

  var dummyObject = {};
  Error.captureStackTrace(dummyObject, belowFn || exports.get);

  var v8Handler = Error.prepareStackTrace;
  Error.prepareStackTrace = function(dummyObject, v8StackTrace) {
    return v8StackTrace;
  };

  var v8StackTrace = dummyObject.stack;
  Error.prepareStackTrace = v8Handler;
  Error.stackTraceLimit = oldLimit;

  return v8StackTrace;
};

exports.parse = function(err) {
  var self = this;
  var lines = err.stack.split('\n').slice(1);

  return lines.map(function(line) {
    var lineMatch = line.match(/at ([^\s]+)\s+\((?:(.+?):(\d+):(\d+)|([^)]+))\)/);
    var methodMatch = lineMatch[1].match(/([^\.]+)(?:\.(.+))?/);
    var object = methodMatch[1];
    var method = methodMatch[2];

    var functionName = lineMatch[1];
    var methodName = null;
    var typeName = 'Object';
    var isNative = (lineMatch[5] === 'native');

    if (method) {
      typeName = object;
      methodName = method;
    }

    if (method === '<anonymous>') {
      methodName = null;
      functionName = '';
    }

    var properties = {
      fileName: lineMatch[2] || null,
      lineNumber: parseInt(lineMatch[3], 10) || null,
      functionName: functionName,
      typeName: typeName,
      methodName: methodName,
      columnNumber: parseInt(lineMatch[4], 10) || null,
      'native': isNative,
    };

    return self._createParsedCallSite(properties);
  });
};

exports._createParsedCallSite = function(properties) {
  var methods = {};
  for (var property in properties) {
    var prefix = 'get';
    if (property === 'native') {
      prefix = 'is';
    }
    var method = prefix + property.substr(0, 1).toUpperCase() + property.substr(1);

    (function(property) {
      methods[method] = function() {
        return properties[property];
      }
    })(property);
  }

  var callSite = Object.create(methods);
  for (var property in properties) {
    callSite[property] = properties[property];
  }

  return callSite;
};
