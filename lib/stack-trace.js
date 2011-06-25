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
