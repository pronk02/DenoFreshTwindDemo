/**
 * The default other handler for the router
 */ export function defaultOtherHandler(_req) {
    return new Response(null, {
        status: 404
    });
}
/**
 * The default error handler for the router
 */ export function defaultErrorHandler(_req, _ctx, err) {
    console.error(err);
    return new Response(null, {
        status: 500
    });
}
/**
 * The default unknown method handler for the router
 */ export function defaultUnknownMethodHandler(_req, _ctx, knownMethods) {
    return new Response(null, {
        status: 405,
        headers: {
            Accept: knownMethods.join(", ")
        }
    });
}
export const METHODS = [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS",
    "PATCH", 
];
const methodRegex = new RegExp(`(?<=^(?:${METHODS.join("|")}))@`);
/**
 * A simple and tiny router for deno
 *
 * ```
 * import { serve } from "https://deno.land/std/http/server.ts";
 * import { router } from "https://crux.land/router@0.0.9";
 *
 * await serve(
 *   router({
 *     "/": (_req) => new Response("Hello world!", { status: 200 }),
 *   }),
 * );
 * ```
 *
 * @param routes A record of all routes and their corresponding handler functions
 * @param other An optional parameter which contains a handler for anything that
 * doesn't match the `routes` parameter
 * @param error An optional parameter which contains a handler for any time it
 * fails to run the default request handling code
 * @param unknownMethod An optional parameter which contains a handler for any time a method
 * that is not defined is used
 * @returns A deno std compatible request handler
 */ export function router(routes, other = defaultOtherHandler, error = defaultErrorHandler, unknownMethod = defaultUnknownMethodHandler) {
    const internalRoutes = {};
    for (const [route, handler] of Object.entries(routes)){
        let [methodOrPath, path] = route.split(methodRegex);
        let method = methodOrPath;
        if (!path) {
            path = methodOrPath;
            method = "any";
        }
        const r = internalRoutes[path] ?? {
            pattern: new URLPattern({
                pathname: path
            }),
            methods: {}
        };
        r.methods[method] = handler;
        internalRoutes[path] = r;
    }
    return async (req, ctx)=>{
        try {
            for (const { pattern , methods  } of Object.values(internalRoutes)){
                const res = pattern.exec(req.url);
                if (res !== null) {
                    for (const [method, handler] of Object.entries(methods)){
                        if (req.method === method) {
                            return await handler(req, ctx, res.pathname.groups);
                        }
                    }
                    if (methods["any"]) {
                        return await methods["any"](req, ctx, res.pathname.groups);
                    } else {
                        return await unknownMethod(req, ctx, Object.keys(methods));
                    }
                }
            }
            return await other(req, ctx);
        } catch (err) {
            return error(req, ctx, err);
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vY3J1eC5sYW5kL2FwaS9nZXQvdVlRRy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAyMiBkZW5vc2F1cnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IENvbm5JbmZvIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOC4wL2h0dHAvc2VydmVyLnRzXCI7XG5cbnR5cGUgSGFuZGxlckNvbnRleHQ8VCA9IHVua25vd24+ID0gVCAmIENvbm5JbmZvO1xuXG5leHBvcnQgdHlwZSBIYW5kbGVyPFQgPSB1bmtub3duPiA9IChcbiAgcmVxOiBSZXF1ZXN0LFxuICBjdHg6IEhhbmRsZXJDb250ZXh0PFQ+LFxuKSA9PiBSZXNwb25zZSB8IFByb21pc2U8UmVzcG9uc2U+O1xuXG4vKipcbiAqIEEgaGFuZGxlciB0eXBlIGZvciBhbnl0aW1lIHRoZSBgTWF0Y2hIYW5kbGVyYCBvciBgb3RoZXJgIHBhcmFtZXRlciBoYW5kbGVyXG4gKiBmYWlsc1xuICovXG5leHBvcnQgdHlwZSBFcnJvckhhbmRsZXI8VCA9IHVua25vd24+ID0gKFxuICByZXE6IFJlcXVlc3QsXG4gIGN0eDogSGFuZGxlckNvbnRleHQ8VD4sXG4gIGVycjogdW5rbm93bixcbikgPT4gUmVzcG9uc2UgfCBQcm9taXNlPFJlc3BvbnNlPjtcblxuLyoqXG4gKiBBIGhhbmRsZXIgdHlwZSBmb3IgYW55dGltZSBhIG1ldGhvZCBpcyByZWNlaXZlZCB0aGF0IGlzIG5vdCBkZWZpbmVkXG4gKi9cbmV4cG9ydCB0eXBlIFVua25vd25NZXRob2RIYW5kbGVyPFQgPSB1bmtub3duPiA9IChcbiAgcmVxOiBSZXF1ZXN0LFxuICBjdHg6IEhhbmRsZXJDb250ZXh0PFQ+LFxuICBrbm93bk1ldGhvZHM6IHN0cmluZ1tdLFxuKSA9PiBSZXNwb25zZSB8IFByb21pc2U8UmVzcG9uc2U+O1xuXG4vKipcbiAqIEEgaGFuZGxlciB0eXBlIGZvciBhIHJvdXRlciBwYXRoIG1hdGNoIHdoaWNoIGdldHMgcGFzc2VkIHRoZSBtYXRjaGVkIHZhbHVlc1xuICovXG5leHBvcnQgdHlwZSBNYXRjaEhhbmRsZXI8VCA9IHVua25vd24+ID0gKFxuICByZXE6IFJlcXVlc3QsXG4gIGN0eDogSGFuZGxlckNvbnRleHQ8VD4sXG4gIG1hdGNoOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuKSA9PiBSZXNwb25zZSB8IFByb21pc2U8UmVzcG9uc2U+O1xuXG4vKipcbiAqIEEgcmVjb3JkIG9mIHJvdXRlIHBhdGhzIGFuZCBgTWF0Y2hIYW5kbGVyYHMgd2hpY2ggYXJlIGNhbGxlZCB3aGVuIGEgbWF0Y2ggaXNcbiAqIGZvdW5kIGFsb25nIHdpdGggaXQncyB2YWx1ZXMuXG4gKlxuICogVGhlIHJvdXRlIHBhdGhzIGZvbGxvdyB0aGUgcGF0aC10by1yZWdleHAgZm9ybWF0IHdpdGggdGhlIGFkZGl0aW9uIG9mIGJlaW5nIGFibGVcbiAqIHRvIHByZWZpeCBhIHJvdXRlIHdpdGggYSBtZXRob2QgbmFtZSBhbmQgdGhlIGBAYCBzaWduLiBGb3IgZXhhbXBsZSBhIHJvdXRlIG9ubHlcbiAqIGFjY2VwdGluZyBgR0VUYCByZXF1ZXN0cyB3b3VsZCBsb29rIGxpa2U6IGBHRVRAL2AuXG4gKi9cbi8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG5leHBvcnQgdHlwZSBSb3V0ZXM8VCA9IHt9PiA9IFJlY29yZDxzdHJpbmcsIE1hdGNoSGFuZGxlcjxUPj47XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgb3RoZXIgaGFuZGxlciBmb3IgdGhlIHJvdXRlclxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVmYXVsdE90aGVySGFuZGxlcihfcmVxOiBSZXF1ZXN0KTogUmVzcG9uc2Uge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHtcbiAgICBzdGF0dXM6IDQwNCxcbiAgfSk7XG59XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgZXJyb3IgaGFuZGxlciBmb3IgdGhlIHJvdXRlclxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVmYXVsdEVycm9ySGFuZGxlcihcbiAgX3JlcTogUmVxdWVzdCxcbiAgX2N0eDogSGFuZGxlckNvbnRleHQsXG4gIGVycjogdW5rbm93bixcbik6IFJlc3BvbnNlIHtcbiAgY29uc29sZS5lcnJvcihlcnIpO1xuXG4gIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwge1xuICAgIHN0YXR1czogNTAwLFxuICB9KTtcbn1cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCB1bmtub3duIG1ldGhvZCBoYW5kbGVyIGZvciB0aGUgcm91dGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0VW5rbm93bk1ldGhvZEhhbmRsZXIoXG4gIF9yZXE6IFJlcXVlc3QsXG4gIF9jdHg6IEhhbmRsZXJDb250ZXh0LFxuICBrbm93bk1ldGhvZHM6IHN0cmluZ1tdLFxuKTogUmVzcG9uc2Uge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHtcbiAgICBzdGF0dXM6IDQwNSxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBBY2NlcHQ6IGtub3duTWV0aG9kcy5qb2luKFwiLCBcIiksXG4gICAgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBjb25zdCBNRVRIT0RTID0gW1xuICBcIkdFVFwiLFxuICBcIkhFQURcIixcbiAgXCJQT1NUXCIsXG4gIFwiUFVUXCIsXG4gIFwiREVMRVRFXCIsXG4gIFwiT1BUSU9OU1wiLFxuICBcIlBBVENIXCIsXG5dIGFzIGNvbnN0O1xuXG5jb25zdCBtZXRob2RSZWdleCA9IG5ldyBSZWdFeHAoYCg/PD1eKD86JHtNRVRIT0RTLmpvaW4oXCJ8XCIpfSkpQGApO1xuXG4vKipcbiAqIEEgc2ltcGxlIGFuZCB0aW55IHJvdXRlciBmb3IgZGVub1xuICpcbiAqIGBgYFxuICogaW1wb3J0IHsgc2VydmUgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkL2h0dHAvc2VydmVyLnRzXCI7XG4gKiBpbXBvcnQgeyByb3V0ZXIgfSBmcm9tIFwiaHR0cHM6Ly9jcnV4LmxhbmQvcm91dGVyQDAuMC45XCI7XG4gKlxuICogYXdhaXQgc2VydmUoXG4gKiAgIHJvdXRlcih7XG4gKiAgICAgXCIvXCI6IChfcmVxKSA9PiBuZXcgUmVzcG9uc2UoXCJIZWxsbyB3b3JsZCFcIiwgeyBzdGF0dXM6IDIwMCB9KSxcbiAqICAgfSksXG4gKiApO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHJvdXRlcyBBIHJlY29yZCBvZiBhbGwgcm91dGVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIGhhbmRsZXIgZnVuY3Rpb25zXG4gKiBAcGFyYW0gb3RoZXIgQW4gb3B0aW9uYWwgcGFyYW1ldGVyIHdoaWNoIGNvbnRhaW5zIGEgaGFuZGxlciBmb3IgYW55dGhpbmcgdGhhdFxuICogZG9lc24ndCBtYXRjaCB0aGUgYHJvdXRlc2AgcGFyYW1ldGVyXG4gKiBAcGFyYW0gZXJyb3IgQW4gb3B0aW9uYWwgcGFyYW1ldGVyIHdoaWNoIGNvbnRhaW5zIGEgaGFuZGxlciBmb3IgYW55IHRpbWUgaXRcbiAqIGZhaWxzIHRvIHJ1biB0aGUgZGVmYXVsdCByZXF1ZXN0IGhhbmRsaW5nIGNvZGVcbiAqIEBwYXJhbSB1bmtub3duTWV0aG9kIEFuIG9wdGlvbmFsIHBhcmFtZXRlciB3aGljaCBjb250YWlucyBhIGhhbmRsZXIgZm9yIGFueSB0aW1lIGEgbWV0aG9kXG4gKiB0aGF0IGlzIG5vdCBkZWZpbmVkIGlzIHVzZWRcbiAqIEByZXR1cm5zIEEgZGVubyBzdGQgY29tcGF0aWJsZSByZXF1ZXN0IGhhbmRsZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJvdXRlcjxUID0gdW5rbm93bj4oXG4gIHJvdXRlczogUm91dGVzPFQ+LFxuICBvdGhlcjogSGFuZGxlcjxUPiA9IGRlZmF1bHRPdGhlckhhbmRsZXIsXG4gIGVycm9yOiBFcnJvckhhbmRsZXI8VD4gPSBkZWZhdWx0RXJyb3JIYW5kbGVyLFxuICB1bmtub3duTWV0aG9kOiBVbmtub3duTWV0aG9kSGFuZGxlcjxUPiA9IGRlZmF1bHRVbmtub3duTWV0aG9kSGFuZGxlcixcbik6IEhhbmRsZXI8VD4ge1xuICBjb25zdCBpbnRlcm5hbFJvdXRlczogUmVjb3JkPHN0cmluZywgeyBwYXR0ZXJuOiBVUkxQYXR0ZXJuLCBtZXRob2RzOiBSZWNvcmQ8c3RyaW5nLCBNYXRjaEhhbmRsZXI8VD4+IH0+ID0ge307XG4gIGZvciAoY29uc3QgW3JvdXRlLCBoYW5kbGVyXSBvZiBPYmplY3QuZW50cmllcyhyb3V0ZXMpKSB7XG4gICAgbGV0IFttZXRob2RPclBhdGgsIHBhdGhdID0gcm91dGUuc3BsaXQobWV0aG9kUmVnZXgpO1xuICAgIGxldCBtZXRob2QgPSBtZXRob2RPclBhdGg7XG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICBwYXRoID0gbWV0aG9kT3JQYXRoO1xuICAgICAgbWV0aG9kID0gXCJhbnlcIjtcbiAgICB9XG4gICAgY29uc3QgciA9IGludGVybmFsUm91dGVzW3BhdGhdID8/IHtcbiAgICAgIHBhdHRlcm46IG5ldyBVUkxQYXR0ZXJuKHsgcGF0aG5hbWU6IHBhdGggfSksXG4gICAgICBtZXRob2RzOiB7fVxuICAgIH07XG4gICAgci5tZXRob2RzW21ldGhvZF0gPSBoYW5kbGVyO1xuICAgIGludGVybmFsUm91dGVzW3BhdGhdID0gcjtcbiAgfVxuXG4gIHJldHVybiBhc3luYyAocmVxLCBjdHgpID0+IHtcbiAgICB0cnkge1xuICAgICAgZm9yIChjb25zdCB7IHBhdHRlcm4sIG1ldGhvZHMgfSBvZiBPYmplY3QudmFsdWVzKGludGVybmFsUm91dGVzKSkge1xuICAgICAgICBjb25zdCByZXMgPSBwYXR0ZXJuLmV4ZWMocmVxLnVybCk7XG4gICAgICAgIGlmIChyZXMgIT09IG51bGwpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IFttZXRob2QsIGhhbmRsZXJdIG9mIE9iamVjdC5lbnRyaWVzKG1ldGhvZHMpKSB7XG4gICAgICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gbWV0aG9kKSB7XG4gICAgICAgICAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVyKFxuICAgICAgICAgICAgICAgIHJlcSxcbiAgICAgICAgICAgICAgICBjdHgsXG4gICAgICAgICAgICAgICAgcmVzLnBhdGhuYW1lLmdyb3VwcyxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG1ldGhvZHNbXCJhbnlcIl0pIHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBtZXRob2RzW1wiYW55XCJdKFxuICAgICAgICAgICAgICByZXEsXG4gICAgICAgICAgICAgIGN0eCxcbiAgICAgICAgICAgICAgcmVzLnBhdGhuYW1lLmdyb3VwcyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB1bmtub3duTWV0aG9kKFxuICAgICAgICAgICAgICByZXEsXG4gICAgICAgICAgICAgIGN0eCxcbiAgICAgICAgICAgICAgT2JqZWN0LmtleXMobWV0aG9kcyksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXdhaXQgb3RoZXIocmVxLCBjdHgpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmV0dXJuIGVycm9yKHJlcSwgY3R4LCBlcnIpO1xuICAgIH1cbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFrREE7O0dBRUcsQ0FDSCxPQUFPLFNBQVMsbUJBQW1CLENBQUMsSUFBYSxFQUFZO0lBQzNELE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFO1FBQ3hCLE1BQU0sRUFBRSxHQUFHO0tBQ1osQ0FBQyxDQUFDO0NBQ0o7QUFFRDs7R0FFRyxDQUNILE9BQU8sU0FBUyxtQkFBbUIsQ0FDakMsSUFBYSxFQUNiLElBQW9CLEVBQ3BCLEdBQVksRUFDRjtJQUNWLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFFbkIsT0FBTyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVB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