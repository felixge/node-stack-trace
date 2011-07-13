exports.get = function(belowFn) {
  var dummyObject = {};
  Error.captureStackTrace(dummyObject, belowFn || exports.get);

  var v8Handler = Error.prepareStackTrace;
  Error.prepareStackTrace = function(dummyObject, v8StackTrace) {
    return v8StackTrace;
  };

  var v8StackTrace = dummyObject.stack;
  Error.prepareStackTrace = v8Handler;

  return v8StackTrace;
};

exports.parse = function(err) {
  var self = this;
  var lines = err.stack.split('\n').slice(1);

  return lines.map(function(line) {
    var lineMatch = line.match(/at ([^\s]+)\s+\((.+?):(\d+):(\d+)\)/);
    var methodMatch = lineMatch[1].match(/([^\.]+)(?:\.(.+))?/);
    var object = methodMatch[1];
    var method = methodMatch[2];

    var functionName = lineMatch[1];
    var methodName = null;
    var typeName = 'Object';

    if (method) {
      typeName = object;
      methodName = method;
    }

    if (method === '<anonymous>') {
      methodName = null;
      functionName = '';
    }

    var properties = {
      fileName: lineMatch[2],
      lineNumber: parseInt(lineMatch[3], 10),
      functionName: functionName,
      typeName: typeName,
      methodName: methodName,
      columnNumber: parseInt(lineMatch[4], 10),
    };

    return self._createParsedCallSite(properties);
  });
};

exports._createParsedCallSite = function(properties) {
  var methods = {};
  for (var property in properties) {
    var method = 'get' + property.substr(0, 1).toUpperCase() + property.substr(1);

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
