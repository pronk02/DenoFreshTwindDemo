import { extname, fromFileUrl, mediaTypeLookup, router, toFileUrl, walk } from "./deps.ts";
import { h } from "preact";
import { Bundler } from "./bundle.ts";
import { ALIVE_URL, BUILD_ID, JS_PREFIX, REFRESH_JS_URL } from "./constants.ts";
import DefaultErrorHandler from "./default_error_page.tsx";
import { render as internalRender } from "./render.tsx";
import { SELF } from "../runtime/csp.ts";
import { ASSET_CACHE_BUST_KEY, INTERNAL_PREFIX } from "../runtime/utils.ts";
export class ServerContext {
    #dev;
    #routes;
    #islands;
    #staticFiles;
    #bundler;
    #renderFn;
    #middlewares;
    #app;
    #notFound;
    #error;
    constructor(routes, islands, staticFiles, renderfn, middlewares, app, notFound, error, importMapURL){
        this.#routes = routes;
        this.#islands = islands;
        this.#staticFiles = staticFiles;
        this.#renderFn = renderfn;
        this.#middlewares = middlewares;
        this.#app = app;
        this.#notFound = notFound;
        this.#error = error;
        this.#bundler = new Bundler(this.#islands, importMapURL);
        this.#dev = typeof Deno.env.get("DENO_DEPLOYMENT_ID") !== "string"; // Env var is only set in prod (on Deploy).
    }
    /**
   * Process the manifest into individual components and pages.
   */ static async fromManifest(manifest, opts) {
        // Get the manifest' base URL.
        const baseUrl = new URL("./", manifest.baseUrl).href;
        const importMapURL = new URL("./import_map.json", manifest.baseUrl);
        // Extract all routes, and prepare them into the `Page` structure.
        const routes = [];
        const islands = [];
        const middlewares = [];
        let app = DEFAULT_APP;
        let notFound = DEFAULT_NOT_FOUND;
        let error = DEFAULT_ERROR;
        for (const [self, module] of Object.entries(manifest.routes)){
            const url = new URL(self, baseUrl).href;
            if (!url.startsWith(baseUrl)) {
                throw new TypeError("Page is not a child of the basepath.");
            }
            const path = url.substring(baseUrl.length).substring("routes".length);
            const baseRoute = path.substring(1, path.length - extname(path).length);
            const name = baseRoute.replace("/", "-");
            const isMiddleware = path.endsWith("/_middleware.tsx") || path.endsWith("/_middleware.ts") || path.endsWith("/_middleware.jsx") || path.endsWith("/_middleware.js");
            if (!path.startsWith("/_") && !isMiddleware) {
                const { default: component , config  } = module;
                let pattern = pathToPattern(baseRoute);
                if (config?.routeOverride) {
                    pattern = String(config.routeOverride);
                }
                let { handler  } = module;
                handler ??= {};
                if (component && typeof handler === "object" && handler.GET === undefined) {
                    handler.GET = (_req, { render  })=>render();
                }
                const route = {
                    pattern,
                    url,
                    name,
                    component,
                    handler,
                    csp: Boolean(config?.csp ?? false)
                };
                routes.push(route);
            } else if (isMiddleware) {
                middlewares.push({
                    ...middlewarePathToPattern(baseRoute),
                    ...module
                });
            } else if (path === "/_app.tsx" || path === "/_app.ts" || path === "/_app.jsx" || path === "/_app.js") {
                app = module;
            } else if (path === "/_404.tsx" || path === "/_404.ts" || path === "/_404.jsx" || path === "/_404.js") {
                const { default: component1 , config: config1  } = module;
                let { handler: handler1  } = module;
                if (component1 && handler1 === undefined) {
                    handler1 = (_req, { render  })=>render();
                }
                notFound = {
                    pattern: pathToPattern(baseRoute),
                    url,
                    name,
                    component: component1,
                    handler: handler1 ?? ((req)=>router.defaultOtherHandler(req)),
                    csp: Boolean(config1?.csp ?? false)
                };
            } else if (path === "/_500.tsx" || path === "/_500.ts" || path === "/_500.jsx" || path === "/_500.js") {
                const { default: component2 , config: config2  } = module;
                let { handler: handler2  } = module;
                if (component2 && handler2 === undefined) {
                    handler2 = (_req, { render  })=>render();
                }
                error = {
                    pattern: pathToPattern(baseRoute),
                    url,
                    name,
                    component: component2,
                    handler: handler2 ?? ((req, ctx)=>router.defaultErrorHandler(req, ctx, ctx.error)),
                    csp: Boolean(config2?.csp ?? false)
                };
            }
        }
        sortRoutes(routes);
        sortRoutes(middlewares);
        for (const [self1, module1] of Object.entries(manifest.islands)){
            const url1 = new URL(self1, baseUrl).href;
            if (!url1.startsWith(baseUrl)) {
                throw new TypeError("Island is not a child of the basepath.");
            }
            const path1 = url1.substring(baseUrl.length).substring("islands".length);
            const baseRoute1 = path1.substring(1, path1.length - extname(path1).length);
            const name1 = baseRoute1.replace("/", "");
            const id = name1.toLowerCase();
            if (typeof module1.default !== "function") {
                throw new TypeError(`Islands must default export a component ('${self1}').`);
            }
            islands.push({
                id,
                name: name1,
                url: url1,
                component: module1.default
            });
        }
        const staticFiles = [];
        try {
            const staticFolder = new URL("./static", manifest.baseUrl);
            // TODO(lucacasonato): remove the extranious Deno.readDir when
            // https://github.com/denoland/deno_std/issues/1310 is fixed.
            for await (const _ of Deno.readDir(fromFileUrl(staticFolder))){
            // do nothing
            }
            const entires = walk(fromFileUrl(staticFolder), {
                includeFiles: true,
                includeDirs: false,
                followSymlinks: false
            });
            const encoder = new TextEncoder();
            for await (const entry of entires){
                const localUrl = toFileUrl(entry.path);
                const path2 = localUrl.href.substring(staticFolder.href.length);
                const stat = await Deno.stat(localUrl);
                const contentType = mediaTypeLookup(extname(path2)) ?? "application/octet-stream";
                const etag = await crypto.subtle.digest("SHA-1", encoder.encode(BUILD_ID + path2)).then((hash)=>Array.from(new Uint8Array(hash)).map((byte)=>byte.toString(16).padStart(2, "0")).join(""));
                const staticFile = {
                    localUrl,
                    path: path2,
                    size: stat.size,
                    contentType,
                    etag
                };
                staticFiles.push(staticFile);
            }
        } catch (err) {
            if (err instanceof Deno.errors.NotFound) {
            // Do nothing.
            } else {
                throw err;
            }
        }
        return new ServerContext(routes, islands, staticFiles, opts.render ?? DEFAULT_RENDER_FN, middlewares, app, notFound, error, importMapURL);
    }
    /**
   * This functions returns a request handler that handles all routes required
   * by fresh, including static files.
   */ handler() {
        const inner = router.router(...this.#handlers());
        const withMiddlewares = this.#composeMiddlewares(this.#middlewares);
        return function handler(req, connInfo) {
            // Redirect requests that end with a trailing slash
            // to their non-trailing slash counterpart.
            // Ex: /about/ -> /about
            const url = new URL(req.url);
            if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
                url.pathname = url.pathname.slice(0, -1);
                return Response.redirect(url.href, 307);
            }
            return withMiddlewares(req, connInfo, inner);
        };
    }
    /**
   * Identify which middlewares should be applied for a request,
   * chain them and return a handler response
   */  #composeMiddlewares(middlewares) {
        return (req, connInfo, inner)=>{
            // identify middlewares to apply, if any.
            // middlewares should be already sorted from deepest to shallow layer
            const mws = selectMiddlewares(req.url, middlewares);
            const handlers = [];
            const ctx = {
                next () {
                    const handler = handlers.shift();
                    return Promise.resolve(handler());
                },
                ...connInfo,
                state: {}
            };
            for (const mw of mws){
                handlers.push(()=>mw.handler(req, ctx));
            }
            handlers.push(()=>inner(req, ctx));
            const handler = handlers.shift();
            return handler();
        };
    }
    /**
   * This function returns all routes required by fresh as an extended
   * path-to-regex, to handler mapping.
   */  #handlers() {
        const routes = {};
        routes[`${INTERNAL_PREFIX}${JS_PREFIX}/${BUILD_ID}/:path*`] = this.#bundleAssetRoute();
        if (this.#dev) {
            routes[REFRESH_JS_URL] = ()=>{
                const js = `let reloading = false; const buildId = "${BUILD_ID}"; new EventSource("${ALIVE_URL}").addEventListener("message", (e) => { if (e.data !== buildId && !reloading) { reloading = true; location.reload(); } });`;
                return new Response(new TextEncoder().encode(js), {
                    headers: {
                        "content-type": "application/javascript; charset=utf-8"
                    }
                });
            };
            routes[ALIVE_URL] = ()=>{
                let timerId = undefined;
                const body = new ReadableStream({
                    start (controller) {
                        controller.enqueue(`data: ${BUILD_ID}\nretry: 100\n\n`);
                        timerId = setInterval(()=>{
                            controller.enqueue(`data: ${BUILD_ID}\n\n`);
                        }, 1000);
                    },
                    cancel () {
                        if (timerId !== undefined) {
                            clearInterval(timerId);
                        }
                    }
                });
                return new Response(body.pipeThrough(new TextEncoderStream()), {
                    headers: {
                        "content-type": "text/event-stream"
                    }
                });
            };
        }
        // Add the static file routes.
        // each files has 2 static routes:
        // - one serving the file at its location without a "cache bursting" mechanism
        // - one containing the BUILD_ID in the path that can be cached
        for (const { localUrl , path , size , contentType , etag  } of this.#staticFiles){
            const route = sanitizePathToRegex(path);
            routes[`GET@${route}`] = this.#staticFileHandler(localUrl, size, contentType, etag);
        }
        const genRender = (route, status)=>{
            const imports = [];
            if (this.#dev) {
                imports.push(REFRESH_JS_URL);
            }
            return (req, params, error)=>{
                return async (data)=>{
                    if (route.component === undefined) {
                        throw new Error("This page does not have a component to render.");
                    }
                    const preloads = [];
                    const resp = await internalRender({
                        route,
                        islands: this.#islands,
                        app: this.#app,
                        imports,
                        preloads,
                        renderFn: this.#renderFn,
                        url: new URL(req.url),
                        params,
                        data,
                        error
                    });
                    const headers = {
                        "content-type": "text/html; charset=utf-8"
                    };
                    const [body, csp] = resp;
                    if (csp) {
                        if (this.#dev) {
                            csp.directives.connectSrc = [
                                ...csp.directives.connectSrc ?? [],
                                SELF, 
                            ];
                        }
                        const directive = serializeCSPDirectives(csp.directives);
                        if (csp.reportOnly) {
                            headers["content-security-policy-report-only"] = directive;
                        } else {
                            headers["content-security-policy"] = directive;
                        }
                    }
                    return new Response(body, {
                        status,
                        headers
                    });
                };
            };
        };
        for (const route1 of this.#routes){
            const createRender = genRender(route1, 200);
            if (typeof route1.handler === "function") {
                routes[route1.pattern] = (req, ctx, params)=>route1.handler(req, {
                        ...ctx,
                        params,
                        render: createRender(req, params)
                    });
            } else {
                for (const [method, handler] of Object.entries(route1.handler)){
                    routes[`${method}@${route1.pattern}`] = (req, ctx, params)=>handler(req, {
                            ...ctx,
                            params,
                            render: createRender(req, params)
                        });
                }
            }
        }
        const unknownHandlerRender = genRender(this.#notFound, 404);
        const unknownHandler = (req, ctx)=>this.#notFound.handler(req, {
                ...ctx,
                render: unknownHandlerRender(req, {})
            });
        const errorHandlerRender = genRender(this.#error, 500);
        const errorHandler = (req, ctx, error)=>{
            console.error("%cAn error occured during route handling or page rendering.", "color:red", error);
            return this.#error.handler(req, {
                ...ctx,
                error,
                render: errorHandlerRender(req, {}, error)
            });
        };
        return [
            routes,
            unknownHandler,
            errorHandler
        ];
    }
     #staticFileHandler(localUrl1, size1, contentType1, etag1) {
        return async (req)=>{
            const url = new URL(req.url);
            const key = url.searchParams.get(ASSET_CACHE_BUST_KEY);
            if (key !== null && BUILD_ID !== key) {
                url.searchParams.delete(ASSET_CACHE_BUST_KEY);
                const location = url.pathname + url.search;
                return new Response("", {
                    status: 307,
                    headers: {
                        "content-type": "text/plain",
                        location
                    }
                });
            }
            const headers = new Headers({
                "content-type": contentType1,
                etag: etag1,
                vary: "If-None-Match"
            });
            if (key !== null) {
                headers.set("Cache-Control", "public, max-age=31536000, immutable");
            }
            const ifNoneMatch = req.headers.get("if-none-match");
            if (ifNoneMatch === etag1 || ifNoneMatch === "W/" + etag1) {
                return new Response(null, {
                    status: 304,
                    headers
                });
            } else {
                const file = await Deno.open(localUrl1);
                headers.set("content-length", String(size1));
                return new Response(file.readable, {
                    headers
                });
            }
        };
    }
    /**
   * Returns a router that contains all fresh routes. Should be mounted at
   * constants.INTERNAL_PREFIX
   */ #bundleAssetRoute = ()=>{
        return async (_req, _ctx, params)=>{
            const path = `/${params.path}`;
            const file = await this.#bundler.get(path);
            let res;
            if (file) {
                const headers = new Headers({
                    "Cache-Control": "public, max-age=604800, immutable"
                });
                const contentType = mediaTypeLookup(path);
                if (contentType) {
                    headers.set("Content-Type", contentType);
                }
                res = new Response(file, {
                    status: 200,
                    headers
                });
            }
            return res ?? new Response(null, {
                status: 404
            });
        };
    };
}
const DEFAULT_RENDER_FN = (_ctx, render)=>{
    render();
};
const DEFAULT_APP = {
    default: ({ Component  })=>h(Component, {})
};
const DEFAULT_NOT_FOUND = {
    pattern: "",
    url: "",
    name: "_404",
    handler: (req)=>router.defaultOtherHandler(req),
    csp: false
};
const DEFAULT_ERROR = {
    pattern: "",
    url: "",
    name: "_500",
    component: DefaultErrorHandler,
    handler: (_req, ctx)=>ctx.render(),
    csp: false
};
/**
 * Return a list of middlewares that needs to be applied for request url
 * @param url the request url
 * @param middlewares Array of middlewares handlers and their routes as path-to-regexp style
 */ export function selectMiddlewares(url, middlewares) {
    const selectedMws = [];
    const reqURL = new URL(url);
    for (const { compiledPattern , handler  } of middlewares){
        const res = compiledPattern.exec(reqURL);
        if (res) {
            selectedMws.push({
                handler
            });
        }
    }
    return selectedMws;
}
/**
 * Sort pages by their relative routing priority, based on the parts in the
 * route matcher
 */ function sortRoutes(routes) {
    routes.sort((a, b)=>{
        const partsA = a.pattern.split("/");
        const partsB = b.pattern.split("/");
        for(let i = 0; i < Math.max(partsA.length, partsB.length); i++){
            const partA = partsA[i];
            const partB = partsB[i];
            if (partA === undefined) return -1;
            if (partB === undefined) return 1;
            if (partA === partB) continue;
            const priorityA = partA.startsWith(":") ? partA.endsWith("*") ? 0 : 1 : 2;
            const priorityB = partB.startsWith(":") ? partB.endsWith("*") ? 0 : 1 : 2;
            return Math.max(Math.min(priorityB - priorityA, 1), -1);
        }
        return 0;
    });
}
/** Transform a filesystem URL path to a `path-to-regex` style matcher. */ function pathToPattern(path) {
    const parts = path.split("/");
    if (parts[parts.length - 1] === "index") {
        parts.pop();
    }
    const route = "/" + parts.map((part)=>{
        if (part.startsWith("[...") && part.endsWith("]")) {
            return `:${part.slice(4, part.length - 1)}*`;
        }
        if (part.startsWith("[") && part.endsWith("]")) {
            return `:${part.slice(1, part.length - 1)}`;
        }
        return part;
    }).join("/");
    return route;
}
// Normalize a path for use in a URL. Returns null if the path is unparsable.
export function normalizeURLPath(path) {
    try {
        const pathUrl = new URL("file:///");
        pathUrl.pathname = path;
        return pathUrl.pathname;
    } catch  {
        return null;
    }
}
function sanitizePathToRegex(path) {
    return path.replaceAll("\*", "\\*").replaceAll("\+", "\\+").replaceAll("\?", "\\?").replaceAll("\{", "\\{").replaceAll("\}", "\\}").replaceAll("\(", "\\(").replaceAll("\)", "\\)").replaceAll("\:", "\\:");
}
function serializeCSPDirectives(csp) {
    return Object.entries(csp).filter(([_key, value])=>value !== undefined).map(([k, v])=>{
        // Turn camel case into snake case.
        const key = k.replace(/[A-Z]/g, (m)=>`-${m.toLowerCase()}`);
        const value = Array.isArray(v) ? v.join(" ") : v;
        return `${key} ${value}`;
    }).join("; ");
}
export function middlewarePathToPattern(baseRoute) {
    baseRoute = baseRoute.slice(0, -"_middleware".length);
    let pattern = pathToPattern(baseRoute);
    if (pattern.endsWith("/")) {
        pattern = pattern.slice(0, -1) + "{/*}?";
    }
    const compiledPattern = new URLPattern({
        pathname: pattern
    });
    return {
        pattern,
        compiledPattern
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvZnJlc2hAMS4wLjEvc3JjL3NlcnZlci9jb250ZXh0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENvbm5JbmZvLFxuICBleHRuYW1lLFxuICBmcm9tRmlsZVVybCxcbiAgbWVkaWFUeXBlTG9va3VwLFxuICBSZXF1ZXN0SGFuZGxlcixcbiAgcm91dGVyLFxuICB0b0ZpbGVVcmwsXG4gIHdhbGssXG59IGZyb20gXCIuL2RlcHMudHNcIjtcbmltcG9ydCB7IGggfSBmcm9tIFwicHJlYWN0XCI7XG5pbXBvcnQgeyBNYW5pZmVzdCB9IGZyb20gXCIuL21vZC50c1wiO1xuaW1wb3J0IHsgQnVuZGxlciB9IGZyb20gXCIuL2J1bmRsZS50c1wiO1xuaW1wb3J0IHsgQUxJVkVfVVJMLCBCVUlMRF9JRCwgSlNfUFJFRklYLCBSRUZSRVNIX0pTX1VSTCB9IGZyb20gXCIuL2NvbnN0YW50cy50c1wiO1xuaW1wb3J0IERlZmF1bHRFcnJvckhhbmRsZXIgZnJvbSBcIi4vZGVmYXVsdF9lcnJvcl9wYWdlLnRzeFwiO1xuaW1wb3J0IHtcbiAgQXBwTW9kdWxlLFxuICBFcnJvclBhZ2UsXG4gIEVycm9yUGFnZU1vZHVsZSxcbiAgRnJlc2hPcHRpb25zLFxuICBIYW5kbGVyLFxuICBJc2xhbmQsXG4gIE1pZGRsZXdhcmUsXG4gIE1pZGRsZXdhcmVNb2R1bGUsXG4gIE1pZGRsZXdhcmVSb3V0ZSxcbiAgUmVuZGVyRnVuY3Rpb24sXG4gIFJvdXRlLFxuICBSb3V0ZU1vZHVsZSxcbiAgVW5rbm93blBhZ2UsXG4gIFVua25vd25QYWdlTW9kdWxlLFxufSBmcm9tIFwiLi90eXBlcy50c1wiO1xuaW1wb3J0IHsgcmVuZGVyIGFzIGludGVybmFsUmVuZGVyIH0gZnJvbSBcIi4vcmVuZGVyLnRzeFwiO1xuaW1wb3J0IHsgQ29udGVudFNlY3VyaXR5UG9saWN5RGlyZWN0aXZlcywgU0VMRiB9IGZyb20gXCIuLi9ydW50aW1lL2NzcC50c1wiO1xuaW1wb3J0IHsgQVNTRVRfQ0FDSEVfQlVTVF9LRVksIElOVEVSTkFMX1BSRUZJWCB9IGZyb20gXCIuLi9ydW50aW1lL3V0aWxzLnRzXCI7XG5cbmludGVyZmFjZSBSb3V0ZXJTdGF0ZSB7XG4gIHN0YXRlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbn1cblxuaW50ZXJmYWNlIFN0YXRpY0ZpbGUge1xuICAvKiogVGhlIFVSTCB0byB0aGUgc3RhdGljIGZpbGUgb24gZGlzay4gKi9cbiAgbG9jYWxVcmw6IFVSTDtcbiAgLyoqIFRoZSBwYXRoIHRvIHRoZSBmaWxlIGFzIGl0IHdvdWxkIGJlIGluIHRoZSBpbmNvbWluZyByZXF1ZXN0LiAqL1xuICBwYXRoOiBzdHJpbmc7XG4gIC8qKiBUaGUgc2l6ZSBvZiB0aGUgZmlsZS4gKi9cbiAgc2l6ZTogbnVtYmVyO1xuICAvKiogVGhlIGNvbnRlbnQtdHlwZSBvZiB0aGUgZmlsZS4gKi9cbiAgY29udGVudFR5cGU6IHN0cmluZztcbiAgLyoqIEhhc2ggb2YgdGhlIGZpbGUgY29udGVudHMuICovXG4gIGV0YWc6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFNlcnZlckNvbnRleHQge1xuICAjZGV2OiBib29sZWFuO1xuICAjcm91dGVzOiBSb3V0ZVtdO1xuICAjaXNsYW5kczogSXNsYW5kW107XG4gICNzdGF0aWNGaWxlczogU3RhdGljRmlsZVtdO1xuICAjYnVuZGxlcjogQnVuZGxlcjtcbiAgI3JlbmRlckZuOiBSZW5kZXJGdW5jdGlvbjtcbiAgI21pZGRsZXdhcmVzOiBNaWRkbGV3YXJlUm91dGVbXTtcbiAgI2FwcDogQXBwTW9kdWxlO1xuICAjbm90Rm91bmQ6IFVua25vd25QYWdlO1xuICAjZXJyb3I6IEVycm9yUGFnZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICByb3V0ZXM6IFJvdXRlW10sXG4gICAgaXNsYW5kczogSXNsYW5kW10sXG4gICAgc3RhdGljRmlsZXM6IFN0YXRpY0ZpbGVbXSxcbiAgICByZW5kZXJmbjogUmVuZGVyRnVuY3Rpb24sXG4gICAgbWlkZGxld2FyZXM6IE1pZGRsZXdhcmVSb3V0ZVtdLFxuICAgIGFwcDogQXBwTW9kdWxlLFxuICAgIG5vdEZvdW5kOiBVbmtub3duUGFnZSxcbiAgICBlcnJvcjogRXJyb3JQYWdlLFxuICAgIGltcG9ydE1hcFVSTDogVVJMLFxuICApIHtcbiAgICB0aGlzLiNyb3V0ZXMgPSByb3V0ZXM7XG4gICAgdGhpcy4jaXNsYW5kcyA9IGlzbGFuZHM7XG4gICAgdGhpcy4jc3RhdGljRmlsZXMgPSBzdGF0aWNGaWxlcztcbiAgICB0aGlzLiNyZW5kZXJGbiA9IHJlbmRlcmZuO1xuICAgIHRoaXMuI21pZGRsZXdhcmVzID0gbWlkZGxld2FyZXM7XG4gICAgdGhpcy4jYXBwID0gYXBwO1xuICAgIHRoaXMuI25vdEZvdW5kID0gbm90Rm91bmQ7XG4gICAgdGhpcy4jZXJyb3IgPSBlcnJvcjtcbiAgICB0aGlzLiNidW5kbGVyID0gbmV3IEJ1bmRsZXIodGhpcy4jaXNsYW5kcywgaW1wb3J0TWFwVVJMKTtcbiAgICB0aGlzLiNkZXYgPSB0eXBlb2YgRGVuby5lbnYuZ2V0KFwiREVOT19ERVBMT1lNRU5UX0lEXCIpICE9PSBcInN0cmluZ1wiOyAvLyBFbnYgdmFyIGlzIG9ubHkgc2V0IGluIHByb2QgKG9uIERlcGxveSkuXG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgbWFuaWZlc3QgaW50byBpbmRpdmlkdWFsIGNvbXBvbmVudHMgYW5kIHBhZ2VzLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGZyb21NYW5pZmVzdChcbiAgICBtYW5pZmVzdDogTWFuaWZlc3QsXG4gICAgb3B0czogRnJlc2hPcHRpb25zLFxuICApOiBQcm9taXNlPFNlcnZlckNvbnRleHQ+IHtcbiAgICAvLyBHZXQgdGhlIG1hbmlmZXN0JyBiYXNlIFVSTC5cbiAgICBjb25zdCBiYXNlVXJsID0gbmV3IFVSTChcIi4vXCIsIG1hbmlmZXN0LmJhc2VVcmwpLmhyZWY7XG4gICAgY29uc3QgaW1wb3J0TWFwVVJMID0gbmV3IFVSTChcIi4vaW1wb3J0X21hcC5qc29uXCIsIG1hbmlmZXN0LmJhc2VVcmwpO1xuXG4gICAgLy8gRXh0cmFjdCBhbGwgcm91dGVzLCBhbmQgcHJlcGFyZSB0aGVtIGludG8gdGhlIGBQYWdlYCBzdHJ1Y3R1cmUuXG4gICAgY29uc3Qgcm91dGVzOiBSb3V0ZVtdID0gW107XG4gICAgY29uc3QgaXNsYW5kczogSXNsYW5kW10gPSBbXTtcbiAgICBjb25zdCBtaWRkbGV3YXJlczogTWlkZGxld2FyZVJvdXRlW10gPSBbXTtcbiAgICBsZXQgYXBwOiBBcHBNb2R1bGUgPSBERUZBVUxUX0FQUDtcbiAgICBsZXQgbm90Rm91bmQ6IFVua25vd25QYWdlID0gREVGQVVMVF9OT1RfRk9VTkQ7XG4gICAgbGV0IGVycm9yOiBFcnJvclBhZ2UgPSBERUZBVUxUX0VSUk9SO1xuICAgIGZvciAoY29uc3QgW3NlbGYsIG1vZHVsZV0gb2YgT2JqZWN0LmVudHJpZXMobWFuaWZlc3Qucm91dGVzKSkge1xuICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChzZWxmLCBiYXNlVXJsKS5ocmVmO1xuICAgICAgaWYgKCF1cmwuc3RhcnRzV2l0aChiYXNlVXJsKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUGFnZSBpcyBub3QgYSBjaGlsZCBvZiB0aGUgYmFzZXBhdGguXCIpO1xuICAgICAgfVxuICAgICAgY29uc3QgcGF0aCA9IHVybC5zdWJzdHJpbmcoYmFzZVVybC5sZW5ndGgpLnN1YnN0cmluZyhcInJvdXRlc1wiLmxlbmd0aCk7XG4gICAgICBjb25zdCBiYXNlUm91dGUgPSBwYXRoLnN1YnN0cmluZygxLCBwYXRoLmxlbmd0aCAtIGV4dG5hbWUocGF0aCkubGVuZ3RoKTtcbiAgICAgIGNvbnN0IG5hbWUgPSBiYXNlUm91dGUucmVwbGFjZShcIi9cIiwgXCItXCIpO1xuICAgICAgY29uc3QgaXNNaWRkbGV3YXJlID0gcGF0aC5lbmRzV2l0aChcIi9fbWlkZGxld2FyZS50c3hcIikgfHxcbiAgICAgICAgcGF0aC5lbmRzV2l0aChcIi9fbWlkZGxld2FyZS50c1wiKSB8fCBwYXRoLmVuZHNXaXRoKFwiL19taWRkbGV3YXJlLmpzeFwiKSB8fFxuICAgICAgICBwYXRoLmVuZHNXaXRoKFwiL19taWRkbGV3YXJlLmpzXCIpO1xuICAgICAgaWYgKCFwYXRoLnN0YXJ0c1dpdGgoXCIvX1wiKSAmJiAhaXNNaWRkbGV3YXJlKSB7XG4gICAgICAgIGNvbnN0IHsgZGVmYXVsdDogY29tcG9uZW50LCBjb25maWcgfSA9IChtb2R1bGUgYXMgUm91dGVNb2R1bGUpO1xuICAgICAgICBsZXQgcGF0dGVybiA9IHBhdGhUb1BhdHRlcm4oYmFzZVJvdXRlKTtcbiAgICAgICAgaWYgKGNvbmZpZz8ucm91dGVPdmVycmlkZSkge1xuICAgICAgICAgIHBhdHRlcm4gPSBTdHJpbmcoY29uZmlnLnJvdXRlT3ZlcnJpZGUpO1xuICAgICAgICB9XG4gICAgICAgIGxldCB7IGhhbmRsZXIgfSA9IChtb2R1bGUgYXMgUm91dGVNb2R1bGUpO1xuICAgICAgICBoYW5kbGVyID8/PSB7fTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGNvbXBvbmVudCAmJlxuICAgICAgICAgIHR5cGVvZiBoYW5kbGVyID09PSBcIm9iamVjdFwiICYmIGhhbmRsZXIuR0VUID09PSB1bmRlZmluZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgaGFuZGxlci5HRVQgPSAoX3JlcSwgeyByZW5kZXIgfSkgPT4gcmVuZGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgcm91dGU6IFJvdXRlID0ge1xuICAgICAgICAgIHBhdHRlcm4sXG4gICAgICAgICAgdXJsLFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgY29tcG9uZW50LFxuICAgICAgICAgIGhhbmRsZXIsXG4gICAgICAgICAgY3NwOiBCb29sZWFuKGNvbmZpZz8uY3NwID8/IGZhbHNlKSxcbiAgICAgICAgfTtcbiAgICAgICAgcm91dGVzLnB1c2gocm91dGUpO1xuICAgICAgfSBlbHNlIGlmIChpc01pZGRsZXdhcmUpIHtcbiAgICAgICAgbWlkZGxld2FyZXMucHVzaCh7XG4gICAgICAgICAgLi4ubWlkZGxld2FyZVBhdGhUb1BhdHRlcm4oYmFzZVJvdXRlKSxcbiAgICAgICAgICAuLi5tb2R1bGUgYXMgTWlkZGxld2FyZU1vZHVsZSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBwYXRoID09PSBcIi9fYXBwLnRzeFwiIHx8IHBhdGggPT09IFwiL19hcHAudHNcIiB8fFxuICAgICAgICBwYXRoID09PSBcIi9fYXBwLmpzeFwiIHx8IHBhdGggPT09IFwiL19hcHAuanNcIlxuICAgICAgKSB7XG4gICAgICAgIGFwcCA9IG1vZHVsZSBhcyBBcHBNb2R1bGU7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBwYXRoID09PSBcIi9fNDA0LnRzeFwiIHx8IHBhdGggPT09IFwiL180MDQudHNcIiB8fFxuICAgICAgICBwYXRoID09PSBcIi9fNDA0LmpzeFwiIHx8IHBhdGggPT09IFwiL180MDQuanNcIlxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IHsgZGVmYXVsdDogY29tcG9uZW50LCBjb25maWcgfSA9IChtb2R1bGUgYXMgVW5rbm93blBhZ2VNb2R1bGUpO1xuICAgICAgICBsZXQgeyBoYW5kbGVyIH0gPSAobW9kdWxlIGFzIFVua25vd25QYWdlTW9kdWxlKTtcbiAgICAgICAgaWYgKGNvbXBvbmVudCAmJiBoYW5kbGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBoYW5kbGVyID0gKF9yZXEsIHsgcmVuZGVyIH0pID0+IHJlbmRlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgbm90Rm91bmQgPSB7XG4gICAgICAgICAgcGF0dGVybjogcGF0aFRvUGF0dGVybihiYXNlUm91dGUpLFxuICAgICAgICAgIHVybCxcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGNvbXBvbmVudCxcbiAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyID8/ICgocmVxKSA9PiByb3V0ZXIuZGVmYXVsdE90aGVySGFuZGxlcihyZXEpKSxcbiAgICAgICAgICBjc3A6IEJvb2xlYW4oY29uZmlnPy5jc3AgPz8gZmFsc2UpLFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgcGF0aCA9PT0gXCIvXzUwMC50c3hcIiB8fCBwYXRoID09PSBcIi9fNTAwLnRzXCIgfHxcbiAgICAgICAgcGF0aCA9PT0gXCIvXzUwMC5qc3hcIiB8fCBwYXRoID09PSBcIi9fNTAwLmpzXCJcbiAgICAgICkge1xuICAgICAgICBjb25zdCB7IGRlZmF1bHQ6IGNvbXBvbmVudCwgY29uZmlnIH0gPSAobW9kdWxlIGFzIEVycm9yUGFnZU1vZHVsZSk7XG4gICAgICAgIGxldCB7IGhhbmRsZXIgfSA9IChtb2R1bGUgYXMgRXJyb3JQYWdlTW9kdWxlKTtcbiAgICAgICAgaWYgKGNvbXBvbmVudCAmJiBoYW5kbGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBoYW5kbGVyID0gKF9yZXEsIHsgcmVuZGVyIH0pID0+IHJlbmRlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgZXJyb3IgPSB7XG4gICAgICAgICAgcGF0dGVybjogcGF0aFRvUGF0dGVybihiYXNlUm91dGUpLFxuICAgICAgICAgIHVybCxcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGNvbXBvbmVudCxcbiAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyID8/XG4gICAgICAgICAgICAoKHJlcSwgY3R4KSA9PiByb3V0ZXIuZGVmYXVsdEVycm9ySGFuZGxlcihyZXEsIGN0eCwgY3R4LmVycm9yKSksXG4gICAgICAgICAgY3NwOiBCb29sZWFuKGNvbmZpZz8uY3NwID8/IGZhbHNlKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgc29ydFJvdXRlcyhyb3V0ZXMpO1xuICAgIHNvcnRSb3V0ZXMobWlkZGxld2FyZXMpO1xuXG4gICAgZm9yIChjb25zdCBbc2VsZiwgbW9kdWxlXSBvZiBPYmplY3QuZW50cmllcyhtYW5pZmVzdC5pc2xhbmRzKSkge1xuICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChzZWxmLCBiYXNlVXJsKS5ocmVmO1xuICAgICAgaWYgKCF1cmwuc3RhcnRzV2l0aChiYXNlVXJsKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSXNsYW5kIGlzIG5vdCBhIGNoaWxkIG9mIHRoZSBiYXNlcGF0aC5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBwYXRoID0gdXJsLnN1YnN0cmluZyhiYXNlVXJsLmxlbmd0aCkuc3Vic3RyaW5nKFwiaXNsYW5kc1wiLmxlbmd0aCk7XG4gICAgICBjb25zdCBiYXNlUm91dGUgPSBwYXRoLnN1YnN0cmluZygxLCBwYXRoLmxlbmd0aCAtIGV4dG5hbWUocGF0aCkubGVuZ3RoKTtcbiAgICAgIGNvbnN0IG5hbWUgPSBiYXNlUm91dGUucmVwbGFjZShcIi9cIiwgXCJcIik7XG4gICAgICBjb25zdCBpZCA9IG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICh0eXBlb2YgbW9kdWxlLmRlZmF1bHQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBJc2xhbmRzIG11c3QgZGVmYXVsdCBleHBvcnQgYSBjb21wb25lbnQgKCcke3NlbGZ9JykuYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlzbGFuZHMucHVzaCh7IGlkLCBuYW1lLCB1cmwsIGNvbXBvbmVudDogbW9kdWxlLmRlZmF1bHQgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhdGljRmlsZXM6IFN0YXRpY0ZpbGVbXSA9IFtdO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdGF0aWNGb2xkZXIgPSBuZXcgVVJMKFwiLi9zdGF0aWNcIiwgbWFuaWZlc3QuYmFzZVVybCk7XG4gICAgICAvLyBUT0RPKGx1Y2FjYXNvbmF0byk6IHJlbW92ZSB0aGUgZXh0cmFuaW91cyBEZW5vLnJlYWREaXIgd2hlblxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm9fc3RkL2lzc3Vlcy8xMzEwIGlzIGZpeGVkLlxuICAgICAgZm9yIGF3YWl0IChjb25zdCBfIG9mIERlbm8ucmVhZERpcihmcm9tRmlsZVVybChzdGF0aWNGb2xkZXIpKSkge1xuICAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgICB9XG4gICAgICBjb25zdCBlbnRpcmVzID0gd2Fsayhmcm9tRmlsZVVybChzdGF0aWNGb2xkZXIpLCB7XG4gICAgICAgIGluY2x1ZGVGaWxlczogdHJ1ZSxcbiAgICAgICAgaW5jbHVkZURpcnM6IGZhbHNlLFxuICAgICAgICBmb2xsb3dTeW1saW5rczogZmFsc2UsXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgZW50aXJlcykge1xuICAgICAgICBjb25zdCBsb2NhbFVybCA9IHRvRmlsZVVybChlbnRyeS5wYXRoKTtcbiAgICAgICAgY29uc3QgcGF0aCA9IGxvY2FsVXJsLmhyZWYuc3Vic3RyaW5nKHN0YXRpY0ZvbGRlci5ocmVmLmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBEZW5vLnN0YXQobG9jYWxVcmwpO1xuICAgICAgICBjb25zdCBjb250ZW50VHlwZSA9IG1lZGlhVHlwZUxvb2t1cChleHRuYW1lKHBhdGgpKSA/P1xuICAgICAgICAgIFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCI7XG4gICAgICAgIGNvbnN0IGV0YWcgPSBhd2FpdCBjcnlwdG8uc3VidGxlLmRpZ2VzdChcbiAgICAgICAgICBcIlNIQS0xXCIsXG4gICAgICAgICAgZW5jb2Rlci5lbmNvZGUoQlVJTERfSUQgKyBwYXRoKSxcbiAgICAgICAgKS50aGVuKChoYXNoKSA9PlxuICAgICAgICAgIEFycmF5LmZyb20obmV3IFVpbnQ4QXJyYXkoaGFzaCkpXG4gICAgICAgICAgICAubWFwKChieXRlKSA9PiBieXRlLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCBcIjBcIikpXG4gICAgICAgICAgICAuam9pbihcIlwiKVxuICAgICAgICApO1xuICAgICAgICBjb25zdCBzdGF0aWNGaWxlOiBTdGF0aWNGaWxlID0ge1xuICAgICAgICAgIGxvY2FsVXJsLFxuICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgc2l6ZTogc3RhdC5zaXplLFxuICAgICAgICAgIGNvbnRlbnRUeXBlLFxuICAgICAgICAgIGV0YWcsXG4gICAgICAgIH07XG4gICAgICAgIHN0YXRpY0ZpbGVzLnB1c2goc3RhdGljRmlsZSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgICAgLy8gRG8gbm90aGluZy5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFNlcnZlckNvbnRleHQoXG4gICAgICByb3V0ZXMsXG4gICAgICBpc2xhbmRzLFxuICAgICAgc3RhdGljRmlsZXMsXG4gICAgICBvcHRzLnJlbmRlciA/PyBERUZBVUxUX1JFTkRFUl9GTixcbiAgICAgIG1pZGRsZXdhcmVzLFxuICAgICAgYXBwLFxuICAgICAgbm90Rm91bmQsXG4gICAgICBlcnJvcixcbiAgICAgIGltcG9ydE1hcFVSTCxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgZnVuY3Rpb25zIHJldHVybnMgYSByZXF1ZXN0IGhhbmRsZXIgdGhhdCBoYW5kbGVzIGFsbCByb3V0ZXMgcmVxdWlyZWRcbiAgICogYnkgZnJlc2gsIGluY2x1ZGluZyBzdGF0aWMgZmlsZXMuXG4gICAqL1xuICBoYW5kbGVyKCk6IFJlcXVlc3RIYW5kbGVyIHtcbiAgICBjb25zdCBpbm5lciA9IHJvdXRlci5yb3V0ZXI8Um91dGVyU3RhdGU+KC4uLnRoaXMuI2hhbmRsZXJzKCkpO1xuICAgIGNvbnN0IHdpdGhNaWRkbGV3YXJlcyA9IHRoaXMuI2NvbXBvc2VNaWRkbGV3YXJlcyh0aGlzLiNtaWRkbGV3YXJlcyk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZXIocmVxOiBSZXF1ZXN0LCBjb25uSW5mbzogQ29ubkluZm8pIHtcbiAgICAgIC8vIFJlZGlyZWN0IHJlcXVlc3RzIHRoYXQgZW5kIHdpdGggYSB0cmFpbGluZyBzbGFzaFxuICAgICAgLy8gdG8gdGhlaXIgbm9uLXRyYWlsaW5nIHNsYXNoIGNvdW50ZXJwYXJ0LlxuICAgICAgLy8gRXg6IC9hYm91dC8gLT4gL2Fib3V0XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwpO1xuICAgICAgaWYgKHVybC5wYXRobmFtZS5sZW5ndGggPiAxICYmIHVybC5wYXRobmFtZS5lbmRzV2l0aChcIi9cIikpIHtcbiAgICAgICAgdXJsLnBhdGhuYW1lID0gdXJsLnBhdGhuYW1lLnNsaWNlKDAsIC0xKTtcbiAgICAgICAgcmV0dXJuIFJlc3BvbnNlLnJlZGlyZWN0KHVybC5ocmVmLCAzMDcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHdpdGhNaWRkbGV3YXJlcyhyZXEsIGNvbm5JbmZvLCBpbm5lcik7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZGVudGlmeSB3aGljaCBtaWRkbGV3YXJlcyBzaG91bGQgYmUgYXBwbGllZCBmb3IgYSByZXF1ZXN0LFxuICAgKiBjaGFpbiB0aGVtIGFuZCByZXR1cm4gYSBoYW5kbGVyIHJlc3BvbnNlXG4gICAqL1xuICAjY29tcG9zZU1pZGRsZXdhcmVzKG1pZGRsZXdhcmVzOiBNaWRkbGV3YXJlUm91dGVbXSkge1xuICAgIHJldHVybiAoXG4gICAgICByZXE6IFJlcXVlc3QsXG4gICAgICBjb25uSW5mbzogQ29ubkluZm8sXG4gICAgICBpbm5lcjogcm91dGVyLkhhbmRsZXI8Um91dGVyU3RhdGU+LFxuICAgICkgPT4ge1xuICAgICAgLy8gaWRlbnRpZnkgbWlkZGxld2FyZXMgdG8gYXBwbHksIGlmIGFueS5cbiAgICAgIC8vIG1pZGRsZXdhcmVzIHNob3VsZCBiZSBhbHJlYWR5IHNvcnRlZCBmcm9tIGRlZXBlc3QgdG8gc2hhbGxvdyBsYXllclxuICAgICAgY29uc3QgbXdzID0gc2VsZWN0TWlkZGxld2FyZXMocmVxLnVybCwgbWlkZGxld2FyZXMpO1xuXG4gICAgICBjb25zdCBoYW5kbGVyczogKCgpID0+IFJlc3BvbnNlIHwgUHJvbWlzZTxSZXNwb25zZT4pW10gPSBbXTtcblxuICAgICAgY29uc3QgY3R4ID0ge1xuICAgICAgICBuZXh0KCkge1xuICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBoYW5kbGVycy5zaGlmdCgpITtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGhhbmRsZXIoKSk7XG4gICAgICAgIH0sXG4gICAgICAgIC4uLmNvbm5JbmZvLFxuICAgICAgICBzdGF0ZToge30sXG4gICAgICB9O1xuXG4gICAgICBmb3IgKGNvbnN0IG13IG9mIG13cykge1xuICAgICAgICBoYW5kbGVycy5wdXNoKCgpID0+IG13LmhhbmRsZXIocmVxLCBjdHgpKTtcbiAgICAgIH1cblxuICAgICAgaGFuZGxlcnMucHVzaCgoKSA9PiBpbm5lcihyZXEsIGN0eCkpO1xuXG4gICAgICBjb25zdCBoYW5kbGVyID0gaGFuZGxlcnMuc2hpZnQoKSE7XG4gICAgICByZXR1cm4gaGFuZGxlcigpO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBmdW5jdGlvbiByZXR1cm5zIGFsbCByb3V0ZXMgcmVxdWlyZWQgYnkgZnJlc2ggYXMgYW4gZXh0ZW5kZWRcbiAgICogcGF0aC10by1yZWdleCwgdG8gaGFuZGxlciBtYXBwaW5nLlxuICAgKi9cbiAgI2hhbmRsZXJzKCk6IFtcbiAgICByb3V0ZXIuUm91dGVzPFJvdXRlclN0YXRlPixcbiAgICByb3V0ZXIuSGFuZGxlcjxSb3V0ZXJTdGF0ZT4sXG4gICAgcm91dGVyLkVycm9ySGFuZGxlcjxSb3V0ZXJTdGF0ZT4sXG4gIF0ge1xuICAgIGNvbnN0IHJvdXRlczogcm91dGVyLlJvdXRlczxSb3V0ZXJTdGF0ZT4gPSB7fTtcblxuICAgIHJvdXRlc1tgJHtJTlRFUk5BTF9QUkVGSVh9JHtKU19QUkVGSVh9LyR7QlVJTERfSUR9LzpwYXRoKmBdID0gdGhpc1xuICAgICAgLiNidW5kbGVBc3NldFJvdXRlKCk7XG5cbiAgICBpZiAodGhpcy4jZGV2KSB7XG4gICAgICByb3V0ZXNbUkVGUkVTSF9KU19VUkxdID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBqcyA9XG4gICAgICAgICAgYGxldCByZWxvYWRpbmcgPSBmYWxzZTsgY29uc3QgYnVpbGRJZCA9IFwiJHtCVUlMRF9JRH1cIjsgbmV3IEV2ZW50U291cmNlKFwiJHtBTElWRV9VUkx9XCIpLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChlKSA9PiB7IGlmIChlLmRhdGEgIT09IGJ1aWxkSWQgJiYgIXJlbG9hZGluZykgeyByZWxvYWRpbmcgPSB0cnVlOyBsb2NhdGlvbi5yZWxvYWQoKTsgfSB9KTtgO1xuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShqcyksIHtcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2phdmFzY3JpcHQ7IGNoYXJzZXQ9dXRmLThcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICByb3V0ZXNbQUxJVkVfVVJMXSA9ICgpID0+IHtcbiAgICAgICAgbGV0IHRpbWVySWQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgYm9keSA9IG5ldyBSZWFkYWJsZVN0cmVhbSh7XG4gICAgICAgICAgc3RhcnQoY29udHJvbGxlcikge1xuICAgICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGBkYXRhOiAke0JVSUxEX0lEfVxcbnJldHJ5OiAxMDBcXG5cXG5gKTtcbiAgICAgICAgICAgIHRpbWVySWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShgZGF0YTogJHtCVUlMRF9JRH1cXG5cXG5gKTtcbiAgICAgICAgICAgIH0sIDEwMDApO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgY2FuY2VsKCkge1xuICAgICAgICAgICAgaWYgKHRpbWVySWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBjbGVhckludGVydmFsKHRpbWVySWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHkucGlwZVRocm91Z2gobmV3IFRleHRFbmNvZGVyU3RyZWFtKCkpLCB7XG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L2V2ZW50LXN0cmVhbVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIHN0YXRpYyBmaWxlIHJvdXRlcy5cbiAgICAvLyBlYWNoIGZpbGVzIGhhcyAyIHN0YXRpYyByb3V0ZXM6XG4gICAgLy8gLSBvbmUgc2VydmluZyB0aGUgZmlsZSBhdCBpdHMgbG9jYXRpb24gd2l0aG91dCBhIFwiY2FjaGUgYnVyc3RpbmdcIiBtZWNoYW5pc21cbiAgICAvLyAtIG9uZSBjb250YWluaW5nIHRoZSBCVUlMRF9JRCBpbiB0aGUgcGF0aCB0aGF0IGNhbiBiZSBjYWNoZWRcbiAgICBmb3IgKFxuICAgICAgY29uc3QgeyBsb2NhbFVybCwgcGF0aCwgc2l6ZSwgY29udGVudFR5cGUsIGV0YWcgfSBvZiB0aGlzLiNzdGF0aWNGaWxlc1xuICAgICkge1xuICAgICAgY29uc3Qgcm91dGUgPSBzYW5pdGl6ZVBhdGhUb1JlZ2V4KHBhdGgpO1xuICAgICAgcm91dGVzW2BHRVRAJHtyb3V0ZX1gXSA9IHRoaXMuI3N0YXRpY0ZpbGVIYW5kbGVyKFxuICAgICAgICBsb2NhbFVybCxcbiAgICAgICAgc2l6ZSxcbiAgICAgICAgY29udGVudFR5cGUsXG4gICAgICAgIGV0YWcsXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGdlblJlbmRlciA9IDxEYXRhID0gdW5kZWZpbmVkPihcbiAgICAgIHJvdXRlOiBSb3V0ZTxEYXRhPiB8IFVua25vd25QYWdlIHwgRXJyb3JQYWdlLFxuICAgICAgc3RhdHVzOiBudW1iZXIsXG4gICAgKSA9PiB7XG4gICAgICBjb25zdCBpbXBvcnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgaWYgKHRoaXMuI2Rldikge1xuICAgICAgICBpbXBvcnRzLnB1c2goUkVGUkVTSF9KU19VUkwpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgcmVxOiBSZXF1ZXN0LFxuICAgICAgICBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gICAgICAgIGVycm9yPzogdW5rbm93bixcbiAgICAgICkgPT4ge1xuICAgICAgICByZXR1cm4gYXN5bmMgKGRhdGE/OiBEYXRhKSA9PiB7XG4gICAgICAgICAgaWYgKHJvdXRlLmNvbXBvbmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIHBhZ2UgZG9lcyBub3QgaGF2ZSBhIGNvbXBvbmVudCB0byByZW5kZXIuXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBwcmVsb2Fkczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgaW50ZXJuYWxSZW5kZXIoe1xuICAgICAgICAgICAgcm91dGUsXG4gICAgICAgICAgICBpc2xhbmRzOiB0aGlzLiNpc2xhbmRzLFxuICAgICAgICAgICAgYXBwOiB0aGlzLiNhcHAsXG4gICAgICAgICAgICBpbXBvcnRzLFxuICAgICAgICAgICAgcHJlbG9hZHMsXG4gICAgICAgICAgICByZW5kZXJGbjogdGhpcy4jcmVuZGVyRm4sXG4gICAgICAgICAgICB1cmw6IG5ldyBVUkwocmVxLnVybCksXG4gICAgICAgICAgICBwYXJhbXMsXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgZXJyb3IsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L2h0bWw7IGNoYXJzZXQ9dXRmLThcIixcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgW2JvZHksIGNzcF0gPSByZXNwO1xuICAgICAgICAgIGlmIChjc3ApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLiNkZXYpIHtcbiAgICAgICAgICAgICAgY3NwLmRpcmVjdGl2ZXMuY29ubmVjdFNyYyA9IFtcbiAgICAgICAgICAgICAgICAuLi4oY3NwLmRpcmVjdGl2ZXMuY29ubmVjdFNyYyA/PyBbXSksXG4gICAgICAgICAgICAgICAgU0VMRixcbiAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdGl2ZSA9IHNlcmlhbGl6ZUNTUERpcmVjdGl2ZXMoY3NwLmRpcmVjdGl2ZXMpO1xuICAgICAgICAgICAgaWYgKGNzcC5yZXBvcnRPbmx5KSB7XG4gICAgICAgICAgICAgIGhlYWRlcnNbXCJjb250ZW50LXNlY3VyaXR5LXBvbGljeS1yZXBvcnQtb25seVwiXSA9IGRpcmVjdGl2ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGhlYWRlcnNbXCJjb250ZW50LXNlY3VyaXR5LXBvbGljeVwiXSA9IGRpcmVjdGl2ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7IHN0YXR1cywgaGVhZGVycyB9KTtcbiAgICAgICAgfTtcbiAgICAgIH07XG4gICAgfTtcblxuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgdGhpcy4jcm91dGVzKSB7XG4gICAgICBjb25zdCBjcmVhdGVSZW5kZXIgPSBnZW5SZW5kZXIocm91dGUsIDIwMCk7XG4gICAgICBpZiAodHlwZW9mIHJvdXRlLmhhbmRsZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICByb3V0ZXNbcm91dGUucGF0dGVybl0gPSAocmVxLCBjdHgsIHBhcmFtcykgPT5cbiAgICAgICAgICAocm91dGUuaGFuZGxlciBhcyBIYW5kbGVyKShyZXEsIHtcbiAgICAgICAgICAgIC4uLmN0eCxcbiAgICAgICAgICAgIHBhcmFtcyxcbiAgICAgICAgICAgIHJlbmRlcjogY3JlYXRlUmVuZGVyKHJlcSwgcGFyYW1zKSxcbiAgICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAoY29uc3QgW21ldGhvZCwgaGFuZGxlcl0gb2YgT2JqZWN0LmVudHJpZXMocm91dGUuaGFuZGxlcikpIHtcbiAgICAgICAgICByb3V0ZXNbYCR7bWV0aG9kfUAke3JvdXRlLnBhdHRlcm59YF0gPSAocmVxLCBjdHgsIHBhcmFtcykgPT5cbiAgICAgICAgICAgIGhhbmRsZXIocmVxLCB7XG4gICAgICAgICAgICAgIC4uLmN0eCxcbiAgICAgICAgICAgICAgcGFyYW1zLFxuICAgICAgICAgICAgICByZW5kZXI6IGNyZWF0ZVJlbmRlcihyZXEsIHBhcmFtcyksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHVua25vd25IYW5kbGVyUmVuZGVyID0gZ2VuUmVuZGVyKHRoaXMuI25vdEZvdW5kLCA0MDQpO1xuICAgIGNvbnN0IHVua25vd25IYW5kbGVyOiByb3V0ZXIuSGFuZGxlcjxSb3V0ZXJTdGF0ZT4gPSAoXG4gICAgICByZXEsXG4gICAgICBjdHgsXG4gICAgKSA9PlxuICAgICAgdGhpcy4jbm90Rm91bmQuaGFuZGxlcihcbiAgICAgICAgcmVxLFxuICAgICAgICB7XG4gICAgICAgICAgLi4uY3R4LFxuICAgICAgICAgIHJlbmRlcjogdW5rbm93bkhhbmRsZXJSZW5kZXIocmVxLCB7fSksXG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgY29uc3QgZXJyb3JIYW5kbGVyUmVuZGVyID0gZ2VuUmVuZGVyKHRoaXMuI2Vycm9yLCA1MDApO1xuICAgIGNvbnN0IGVycm9ySGFuZGxlcjogcm91dGVyLkVycm9ySGFuZGxlcjxSb3V0ZXJTdGF0ZT4gPSAoXG4gICAgICByZXEsXG4gICAgICBjdHgsXG4gICAgICBlcnJvcixcbiAgICApID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIFwiJWNBbiBlcnJvciBvY2N1cmVkIGR1cmluZyByb3V0ZSBoYW5kbGluZyBvciBwYWdlIHJlbmRlcmluZy5cIixcbiAgICAgICAgXCJjb2xvcjpyZWRcIixcbiAgICAgICAgZXJyb3IsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRoaXMuI2Vycm9yLmhhbmRsZXIoXG4gICAgICAgIHJlcSxcbiAgICAgICAge1xuICAgICAgICAgIC4uLmN0eCxcbiAgICAgICAgICBlcnJvcixcbiAgICAgICAgICByZW5kZXI6IGVycm9ySGFuZGxlclJlbmRlcihyZXEsIHt9LCBlcnJvciksXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH07XG5cbiAgICByZXR1cm4gW3JvdXRlcywgdW5rbm93bkhhbmRsZXIsIGVycm9ySGFuZGxlcl07XG4gIH1cblxuICAjc3RhdGljRmlsZUhhbmRsZXIoXG4gICAgbG9jYWxVcmw6IFVSTCxcbiAgICBzaXplOiBudW1iZXIsXG4gICAgY29udGVudFR5cGU6IHN0cmluZyxcbiAgICBldGFnOiBzdHJpbmcsXG4gICk6IHJvdXRlci5NYXRjaEhhbmRsZXIge1xuICAgIHJldHVybiBhc3luYyAocmVxOiBSZXF1ZXN0KSA9PiB7XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwpO1xuICAgICAgY29uc3Qga2V5ID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoQVNTRVRfQ0FDSEVfQlVTVF9LRVkpO1xuICAgICAgaWYgKGtleSAhPT0gbnVsbCAmJiBCVUlMRF9JRCAhPT0ga2V5KSB7XG4gICAgICAgIHVybC5zZWFyY2hQYXJhbXMuZGVsZXRlKEFTU0VUX0NBQ0hFX0JVU1RfS0VZKTtcbiAgICAgICAgY29uc3QgbG9jYXRpb24gPSB1cmwucGF0aG5hbWUgKyB1cmwuc2VhcmNoO1xuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHtcbiAgICAgICAgICBzdGF0dXM6IDMwNyxcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBcImNvbnRlbnQtdHlwZVwiOiBcInRleHQvcGxhaW5cIixcbiAgICAgICAgICAgIGxvY2F0aW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKHtcbiAgICAgICAgXCJjb250ZW50LXR5cGVcIjogY29udGVudFR5cGUsXG4gICAgICAgIGV0YWcsXG4gICAgICAgIHZhcnk6IFwiSWYtTm9uZS1NYXRjaFwiLFxuICAgICAgfSk7XG4gICAgICBpZiAoa2V5ICE9PSBudWxsKSB7XG4gICAgICAgIGhlYWRlcnMuc2V0KFwiQ2FjaGUtQ29udHJvbFwiLCBcInB1YmxpYywgbWF4LWFnZT0zMTUzNjAwMCwgaW1tdXRhYmxlXCIpO1xuICAgICAgfVxuICAgICAgY29uc3QgaWZOb25lTWF0Y2ggPSByZXEuaGVhZGVycy5nZXQoXCJpZi1ub25lLW1hdGNoXCIpO1xuICAgICAgaWYgKGlmTm9uZU1hdGNoID09PSBldGFnIHx8IGlmTm9uZU1hdGNoID09PSBcIlcvXCIgKyBldGFnKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwgeyBzdGF0dXM6IDMwNCwgaGVhZGVycyB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBEZW5vLm9wZW4obG9jYWxVcmwpO1xuICAgICAgICBoZWFkZXJzLnNldChcImNvbnRlbnQtbGVuZ3RoXCIsIFN0cmluZyhzaXplKSk7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoZmlsZS5yZWFkYWJsZSwgeyBoZWFkZXJzIH0pO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIHJvdXRlciB0aGF0IGNvbnRhaW5zIGFsbCBmcmVzaCByb3V0ZXMuIFNob3VsZCBiZSBtb3VudGVkIGF0XG4gICAqIGNvbnN0YW50cy5JTlRFUk5BTF9QUkVGSVhcbiAgICovXG4gICNidW5kbGVBc3NldFJvdXRlID0gKCk6IHJvdXRlci5NYXRjaEhhbmRsZXIgPT4ge1xuICAgIHJldHVybiBhc3luYyAoX3JlcSwgX2N0eCwgcGFyYW1zKSA9PiB7XG4gICAgICBjb25zdCBwYXRoID0gYC8ke3BhcmFtcy5wYXRofWA7XG4gICAgICBjb25zdCBmaWxlID0gYXdhaXQgdGhpcy4jYnVuZGxlci5nZXQocGF0aCk7XG4gICAgICBsZXQgcmVzO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKHtcbiAgICAgICAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJwdWJsaWMsIG1heC1hZ2U9NjA0ODAwLCBpbW11dGFibGVcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY29udGVudFR5cGUgPSBtZWRpYVR5cGVMb29rdXAocGF0aCk7XG4gICAgICAgIGlmIChjb250ZW50VHlwZSkge1xuICAgICAgICAgIGhlYWRlcnMuc2V0KFwiQ29udGVudC1UeXBlXCIsIGNvbnRlbnRUeXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcyA9IG5ldyBSZXNwb25zZShmaWxlLCB7XG4gICAgICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXMgPz8gbmV3IFJlc3BvbnNlKG51bGwsIHtcbiAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICB9KTtcbiAgICB9O1xuICB9O1xufVxuXG5jb25zdCBERUZBVUxUX1JFTkRFUl9GTjogUmVuZGVyRnVuY3Rpb24gPSAoX2N0eCwgcmVuZGVyKSA9PiB7XG4gIHJlbmRlcigpO1xufTtcblxuY29uc3QgREVGQVVMVF9BUFA6IEFwcE1vZHVsZSA9IHtcbiAgZGVmYXVsdDogKHsgQ29tcG9uZW50IH0pID0+IGgoQ29tcG9uZW50LCB7fSksXG59O1xuXG5jb25zdCBERUZBVUxUX05PVF9GT1VORDogVW5rbm93blBhZ2UgPSB7XG4gIHBhdHRlcm46IFwiXCIsXG4gIHVybDogXCJcIixcbiAgbmFtZTogXCJfNDA0XCIsXG4gIGhhbmRsZXI6IChyZXEpID0+IHJvdXRlci5kZWZhdWx0T3RoZXJIYW5kbGVyKHJlcSksXG4gIGNzcDogZmFsc2UsXG59O1xuXG5jb25zdCBERUZBVUxUX0VSUk9SOiBFcnJvclBhZ2UgPSB7XG4gIHBhdHRlcm46IFwiXCIsXG4gIHVybDogXCJcIixcbiAgbmFtZTogXCJfNTAwXCIsXG4gIGNvbXBvbmVudDogRGVmYXVsdEVycm9ySGFuZGxlcixcbiAgaGFuZGxlcjogKF9yZXEsIGN0eCkgPT4gY3R4LnJlbmRlcigpLFxuICBjc3A6IGZhbHNlLFxufTtcblxuLyoqXG4gKiBSZXR1cm4gYSBsaXN0IG9mIG1pZGRsZXdhcmVzIHRoYXQgbmVlZHMgdG8gYmUgYXBwbGllZCBmb3IgcmVxdWVzdCB1cmxcbiAqIEBwYXJhbSB1cmwgdGhlIHJlcXVlc3QgdXJsXG4gKiBAcGFyYW0gbWlkZGxld2FyZXMgQXJyYXkgb2YgbWlkZGxld2FyZXMgaGFuZGxlcnMgYW5kIHRoZWlyIHJvdXRlcyBhcyBwYXRoLXRvLXJlZ2V4cCBzdHlsZVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VsZWN0TWlkZGxld2FyZXModXJsOiBzdHJpbmcsIG1pZGRsZXdhcmVzOiBNaWRkbGV3YXJlUm91dGVbXSkge1xuICBjb25zdCBzZWxlY3RlZE13czogTWlkZGxld2FyZVtdID0gW107XG4gIGNvbnN0IHJlcVVSTCA9IG5ldyBVUkwodXJsKTtcblxuICBmb3IgKGNvbnN0IHsgY29tcGlsZWRQYXR0ZXJuLCBoYW5kbGVyIH0gb2YgbWlkZGxld2FyZXMpIHtcbiAgICBjb25zdCByZXMgPSBjb21waWxlZFBhdHRlcm4uZXhlYyhyZXFVUkwpO1xuICAgIGlmIChyZXMpIHtcbiAgICAgIHNlbGVjdGVkTXdzLnB1c2goeyBoYW5kbGVyIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBzZWxlY3RlZE13cztcbn1cblxuLyoqXG4gKiBTb3J0IHBhZ2VzIGJ5IHRoZWlyIHJlbGF0aXZlIHJvdXRpbmcgcHJpb3JpdHksIGJhc2VkIG9uIHRoZSBwYXJ0cyBpbiB0aGVcbiAqIHJvdXRlIG1hdGNoZXJcbiAqL1xuZnVuY3Rpb24gc29ydFJvdXRlczxUIGV4dGVuZHMgeyBwYXR0ZXJuOiBzdHJpbmcgfT4ocm91dGVzOiBUW10pIHtcbiAgcm91dGVzLnNvcnQoKGEsIGIpID0+IHtcbiAgICBjb25zdCBwYXJ0c0EgPSBhLnBhdHRlcm4uc3BsaXQoXCIvXCIpO1xuICAgIGNvbnN0IHBhcnRzQiA9IGIucGF0dGVybi5zcGxpdChcIi9cIik7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1heChwYXJ0c0EubGVuZ3RoLCBwYXJ0c0IubGVuZ3RoKTsgaSsrKSB7XG4gICAgICBjb25zdCBwYXJ0QSA9IHBhcnRzQVtpXTtcbiAgICAgIGNvbnN0IHBhcnRCID0gcGFydHNCW2ldO1xuICAgICAgaWYgKHBhcnRBID09PSB1bmRlZmluZWQpIHJldHVybiAtMTtcbiAgICAgIGlmIChwYXJ0QiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gMTtcbiAgICAgIGlmIChwYXJ0QSA9PT0gcGFydEIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcHJpb3JpdHlBID0gcGFydEEuc3RhcnRzV2l0aChcIjpcIikgPyBwYXJ0QS5lbmRzV2l0aChcIipcIikgPyAwIDogMSA6IDI7XG4gICAgICBjb25zdCBwcmlvcml0eUIgPSBwYXJ0Qi5zdGFydHNXaXRoKFwiOlwiKSA/IHBhcnRCLmVuZHNXaXRoKFwiKlwiKSA/IDAgOiAxIDogMjtcbiAgICAgIHJldHVybiBNYXRoLm1heChNYXRoLm1pbihwcmlvcml0eUIgLSBwcmlvcml0eUEsIDEpLCAtMSk7XG4gICAgfVxuICAgIHJldHVybiAwO1xuICB9KTtcbn1cblxuLyoqIFRyYW5zZm9ybSBhIGZpbGVzeXN0ZW0gVVJMIHBhdGggdG8gYSBgcGF0aC10by1yZWdleGAgc3R5bGUgbWF0Y2hlci4gKi9cbmZ1bmN0aW9uIHBhdGhUb1BhdHRlcm4ocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KFwiL1wiKTtcbiAgaWYgKHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID09PSBcImluZGV4XCIpIHtcbiAgICBwYXJ0cy5wb3AoKTtcbiAgfVxuICBjb25zdCByb3V0ZSA9IFwiL1wiICsgcGFydHNcbiAgICAubWFwKChwYXJ0KSA9PiB7XG4gICAgICBpZiAocGFydC5zdGFydHNXaXRoKFwiWy4uLlwiKSAmJiBwYXJ0LmVuZHNXaXRoKFwiXVwiKSkge1xuICAgICAgICByZXR1cm4gYDoke3BhcnQuc2xpY2UoNCwgcGFydC5sZW5ndGggLSAxKX0qYDtcbiAgICAgIH1cbiAgICAgIGlmIChwYXJ0LnN0YXJ0c1dpdGgoXCJbXCIpICYmIHBhcnQuZW5kc1dpdGgoXCJdXCIpKSB7XG4gICAgICAgIHJldHVybiBgOiR7cGFydC5zbGljZSgxLCBwYXJ0Lmxlbmd0aCAtIDEpfWA7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFydDtcbiAgICB9KVxuICAgIC5qb2luKFwiL1wiKTtcbiAgcmV0dXJuIHJvdXRlO1xufVxuXG4vLyBOb3JtYWxpemUgYSBwYXRoIGZvciB1c2UgaW4gYSBVUkwuIFJldHVybnMgbnVsbCBpZiB0aGUgcGF0aCBpcyB1bnBhcnNhYmxlLlxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVVSTFBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIHRyeSB7XG4gICAgY29uc3QgcGF0aFVybCA9IG5ldyBVUkwoXCJmaWxlOi8vL1wiKTtcbiAgICBwYXRoVXJsLnBhdGhuYW1lID0gcGF0aDtcbiAgICByZXR1cm4gcGF0aFVybC5wYXRobmFtZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2FuaXRpemVQYXRoVG9SZWdleChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcGF0aFxuICAgIC5yZXBsYWNlQWxsKFwiXFwqXCIsIFwiXFxcXCpcIilcbiAgICAucmVwbGFjZUFsbChcIlxcK1wiLCBcIlxcXFwrXCIpXG4gICAgLnJlcGxhY2VBbGwoXCJcXD9cIiwgXCJcXFxcP1wiKVxuICAgIC5yZXBsYWNlQWxsKFwiXFx7XCIsIFwiXFxcXHtcIilcbiAgICAucmVwbGFjZUFsbChcIlxcfVwiLCBcIlxcXFx9XCIpXG4gICAgLnJlcGxhY2VBbGwoXCJcXChcIiwgXCJcXFxcKFwiKVxuICAgIC5yZXBsYWNlQWxsKFwiXFwpXCIsIFwiXFxcXClcIilcbiAgICAucmVwbGFjZUFsbChcIlxcOlwiLCBcIlxcXFw6XCIpO1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVDU1BEaXJlY3RpdmVzKGNzcDogQ29udGVudFNlY3VyaXR5UG9saWN5RGlyZWN0aXZlcyk6IHN0cmluZyB7XG4gIHJldHVybiBPYmplY3QuZW50cmllcyhjc3ApXG4gICAgLmZpbHRlcigoW19rZXksIHZhbHVlXSkgPT4gdmFsdWUgIT09IHVuZGVmaW5lZClcbiAgICAubWFwKChbaywgdl06IFtzdHJpbmcsIHN0cmluZyB8IHN0cmluZ1tdXSkgPT4ge1xuICAgICAgLy8gVHVybiBjYW1lbCBjYXNlIGludG8gc25ha2UgY2FzZS5cbiAgICAgIGNvbnN0IGtleSA9IGsucmVwbGFjZSgvW0EtWl0vZywgKG0pID0+IGAtJHttLnRvTG93ZXJDYXNlKCl9YCk7XG4gICAgICBjb25zdCB2YWx1ZSA9IEFycmF5LmlzQXJyYXkodikgPyB2LmpvaW4oXCIgXCIpIDogdjtcbiAgICAgIHJldHVybiBgJHtrZXl9ICR7dmFsdWV9YDtcbiAgICB9KVxuICAgIC5qb2luKFwiOyBcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtaWRkbGV3YXJlUGF0aFRvUGF0dGVybihiYXNlUm91dGU6IHN0cmluZykge1xuICBiYXNlUm91dGUgPSBiYXNlUm91dGUuc2xpY2UoMCwgLVwiX21pZGRsZXdhcmVcIi5sZW5ndGgpO1xuICBsZXQgcGF0dGVybiA9IHBhdGhUb1BhdHRlcm4oYmFzZVJvdXRlKTtcbiAgaWYgKHBhdHRlcm4uZW5kc1dpdGgoXCIvXCIpKSB7XG4gICAgcGF0dGVybiA9IHBhdHRlcm4uc2xpY2UoMCwgLTEpICsgXCJ7Lyp9P1wiO1xuICB9XG4gIGNvbnN0IGNvbXBpbGVkUGF0dGVybiA9IG5ldyBVUkxQYXR0ZXJuKHsgcGF0aG5hbWU6IHBhdHRlcm4gfSk7XG4gIHJldHVybiB7IHBhdHRlcm4sIGNvbXBpbGVkUGF0dGVybiB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBRUUsT0FBTyxFQUNQLFdBQVcsRUFDWCxlQUFlLEVBRWYsTUFBTSxFQUNOLFNBQVMsRUFDVCxJQUFJLFFBQ0MsV0FBVyxDQUFDO0FBQ25CLFNBQVMsQ0FBQyxRQUFRLFFBQVEsQ0FBQztBQUUzQixTQUFTLE9BQU8sUUFBUSxhQUFhLENBQUM7QUFDdEMsU0FBUyxTQUFTLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxjQUFjLFFBQVEsZ0JBQWdCLENBQUM7QUFDaEYsT0FBTyxtQkFBbUIsTUFBTSwwQkFBMEIsQ0FBQztBQWlCM0QsU0FBUyxNQUFNLElBQUksY0FBYyxRQUFRLGNBQWMsQ0FBQztBQUN4RCxTQUEwQyxJQUFJLFFBQVEsbUJBQW1CLENBQUM7QUFDMUUsU0FBUyxvQkFBb0IsRUFBRSxlQUFlLFFBQVEscUJBQXFCLENBQUM7QUFtQjVFLE9BQU8sTUFBTSxhQUFhO0lBQ3hCLENBQUMsR0FBRyxDQUFVO0lBQ2QsQ0FBQyxNQUFNLENBQVU7SUFDakIsQ0FBQyxPQUFPLENBQVc7SUFDbkIsQ0FBQyxXQUFXLENBQWU7SUFDM0IsQ0FBQyxPQUFPLENBQVU7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