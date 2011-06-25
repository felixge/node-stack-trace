# stack-trace

Get v8 stack traces as an array of CallSite objects.

## Install

``` bash
npm install stack-trace
```

## Usage

``` javascript
var stackTrace = require('stack-trace');
var trace = stackTrace.get();

require('assert').strictEqual(trace[0].getFileName(), __filename);
```

## API

### stackTrace.get([belowFn])

Returns an array of `CallSite` objects, where element `0` is the current call
site.

When passing a function on the current stack as the `belowFn` parameter, the
returned array will only include `CallSite` objects below this function.

### CallSite

The official v8 CallSite object API can be found [here][v8stackapi]. A quick
excerpt:

> A CallSite object defines the following methods:
>
> * **getThis**: returns the value of this
> * **getTypeName**: returns the type of this as a string. This is the name of the function stored in the constructor field of this, if available, otherwise the object's [[Class]] internal property.
> * **getFunction**: returns the current function
> * **getFunctionName**: returns the name of the current function, typically its name property. If a name property is not available an attempt will be made to try to infer a name from the function's context.
> * **getMethodName**: returns the name of the property of this or one of its prototypes that holds the current function
> * **getFileName**: if this function was defined in a script returns the name of the script
> * **getLineNumber**: if this function was defined in a script returns the current line number
> * **getColumnNumber**: if this function was defined in a script returns the current column number
> * **getEvalOrigin**: if this function was created using a call to eval returns a CallSite object representing the location where eval was called
> * **isToplevel**: is this a toplevel invocation, that is, is this the global object?
> * **isEval**: does this call take place in code defined by a call to eval?
> * **isNative**: is this call in native V8 code?
> * **isConstructor**: is this a constructor call?

[v8stackapi]: http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi

## License

stack-trace is licensed under the MIT license.
