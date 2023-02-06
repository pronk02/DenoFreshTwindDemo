/** @jsx h */ import { renderToString } from "preact-render-to-string";
import { h, options } from "preact";
import { HEAD_CONTEXT } from "../runtime/head.ts";
import { CSP_CONTEXT, nonce, NONE, UNSAFE_INLINE } from "../runtime/csp.ts";
import { bundleAssetUrl } from "./constants.ts";
import { assetHashingHook } from "../runtime/utils.ts";
export class RenderContext {
    #id;
    #state = new Map();
    #styles = [];
    #url;
    #route;
    #lang;
    constructor(id, url, route, lang){
        this.#id = id;
        this.#url = url;
        this.#route = route;
        this.#lang = lang;
    }
    /** A unique ID for this logical JIT render. */ get id() {
        return this.#id;
    }
    /**
   * State that is persisted between multiple renders with the same render
   * context. This is useful because one logical JIT render could have multiple
   * preact render passes due to suspense.
   */ get state() {
        return this.#state;
    }
    /**
   * All of the CSS style rules that should be inlined into the document.
   * Adding to this list across multiple renders is supported (even across
   * suspense!). The CSS rules will always be inserted on the client in the
   * order specified here.
   */ get styles() {
        return this.#styles;
    }
    /** The URL of the page being rendered. */ get url() {
        return this.#url;
    }
    /** The route matcher (e.g. /blog/:id) that the request matched for this page
   * to be rendered. */ get route() {
        return this.#route;
    }
    /** The language of the page being rendered. Defaults to "en". */ get lang() {
        return this.#lang;
    }
    set lang(lang) {
        this.#lang = lang;
    }
}
function defaultCsp() {
    return {
        directives: {
            defaultSrc: [
                NONE
            ],
            styleSrc: [
                UNSAFE_INLINE
            ]
        },
        reportOnly: false
    };
}
/**
 * This function renders out a page. Rendering is asynchronous, and streaming.
 * Rendering happens in multiple steps, because of the need to handle suspense.
 *
 * 1. The page's vnode tree is constructed.
 * 2. The page's vnode tree is passed to the renderer.
 *   - If the rendering throws a promise, the promise is awaited before
 *     continuing. This allows the renderer to handle async hooks.
 *   - Once the rendering throws no more promises, the initial render is
 *     complete and a body string is returned.
 *   - During rendering, every time a `<Suspense>` is rendered, it, and it's
 *     attached children are recorded for later rendering.
 * 3. Once the inital render is complete, the body string is fitted into the
 *    HTML wrapper template.
 * 4. The full inital render in the template is yielded to be sent to the
 *    client.
 * 5. Now the suspended vnodes are rendered. These are individually rendered
 *    like described in step 2 above. Once each node is done rendering, it
 *    wrapped in some boilderplate HTML, and suffixed with some JS, and then
 *    sent to the client. On the client the HTML will be slotted into the DOM
 *    at the location of the original `<Suspense>` node.
 */ export async function render(opts) {
    const props = {
        params: opts.params,
        url: opts.url,
        route: opts.route.pattern,
        data: opts.data
    };
    if (opts.error) {
        props.error = opts.error;
    }
    const csp = opts.route.csp ? defaultCsp() : undefined;
    const headComponents = [];
    const vnode = h(CSP_CONTEXT.Provider, {
        value: csp,
        children: h(HEAD_CONTEXT.Provider, {
            value: headComponents,
            children: h(opts.app.default, {
                Component () {
                    return h(opts.route.component, props);
                }
            })
        })
    });
    const ctx = new RenderContext(crypto.randomUUID(), opts.url, opts.route.pattern, opts.lang ?? "en");
    if (csp) {
        // Clear the csp
        const newCsp = defaultCsp();
        csp.directives = newCsp.directives;
        csp.reportOnly = newCsp.reportOnly;
    }
    // Clear the head components
    headComponents.splice(0, headComponents.length);
    // Setup the interesting VNode types
    ISLANDS.splice(0, ISLANDS.length, ...opts.islands);
    // Clear the encountered vnodes
    ENCOUNTERED_ISLANDS.clear();
    // Clear the island props
    ISLAND_PROPS = [];
    let bodyHtml = null;
    function render() {
        bodyHtml = renderToString(vnode);
        return bodyHtml;
    }
    await opts.renderFn(ctx, render);
    if (bodyHtml === null) {
        throw new Error("The `render` function was not called by the renderer.");
    }
    const imports = opts.imports.map((url)=>{
        const randomNonce = crypto.randomUUID().replace(/-/g, "");
        if (csp) {
            csp.directives.scriptSrc = [
                ...csp.directives.scriptSrc ?? [],
                nonce(randomNonce), 
            ];
        }
        return [
            url,
            randomNonce
        ];
    });
    if (ENCOUNTERED_ISLANDS.size > 0) {
        // Load the main.js script
        {
            const randomNonce = crypto.randomUUID().replace(/-/g, "");
            if (csp) {
                csp.directives.scriptSrc = [
                    ...csp.directives.scriptSrc ?? [],
                    nonce(randomNonce), 
                ];
            }
            const url = bundleAssetUrl("/main.js");
            imports.push([
                url,
                randomNonce
            ]);
        }
        // Prepare the inline script that loads and revives the islands
        let islandImports = "";
        let islandRegistry = "";
        for (const island of ENCOUNTERED_ISLANDS){
            const randomNonce1 = crypto.randomUUID().replace(/-/g, "");
            if (csp) {
                csp.directives.scriptSrc = [
                    ...csp.directives.scriptSrc ?? [],
                    nonce(randomNonce1), 
                ];
            }
            const url1 = bundleAssetUrl(`/island-${island.id}.js`);
            imports.push([
                url1,
                randomNonce1
            ]);
            islandImports += `\nimport ${island.name} from "${url1}";`;
            islandRegistry += `\n  ${island.id}: ${island.name},`;
        }
        const initCode = `import { revive } from "${bundleAssetUrl("/main.js")}";${islandImports}\nrevive({${islandRegistry}\n});`;
        // Append the inline script to the body
        const randomNonce2 = crypto.randomUUID().replace(/-/g, "");
        if (csp) {
            csp.directives.scriptSrc = [
                ...csp.directives.scriptSrc ?? [],
                nonce(randomNonce2), 
            ];
        }
        bodyHtml += `<script id="__FRSH_ISLAND_PROPS" type="application/json">${JSON.stringify(ISLAND_PROPS)}</script><script type="module" nonce="${randomNonce2}">${initCode}</script>`;
    }
    const html = template({
        bodyHtml,
        headComponents,
        imports,
        preloads: opts.preloads,
        styles: ctx.styles,
        lang: ctx.lang
    });
    return [
        html,
        csp
    ];
}
export function template(opts) {
    const page = /*#__PURE__*/ h("html", {
        lang: opts.lang
    }, /*#__PURE__*/ h("head", null, /*#__PURE__*/ h("meta", {
        charSet: "UTF-8"
    }), /*#__PURE__*/ h("meta", {
        "http-equiv": "X-UA-Compatible",
        content: "IE=edge"
    }), /*#__PURE__*/ h("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0"
    }), opts.preloads.map((src)=>/*#__PURE__*/ h("link", {
            rel: "modulepreload",
            href: src
        })), opts.imports.map(([src, nonce])=>/*#__PURE__*/ h("script", {
            src: src,
            nonce: nonce,
            type: "module"
        })), /*#__PURE__*/ h("style", {
        id: "__FRSH_STYLE",
        dangerouslySetInnerHTML: {
            __html: opts.styles.join("\n")
        }
    }), opts.headComponents), /*#__PURE__*/ h("body", {
        dangerouslySetInnerHTML: {
            __html: opts.bodyHtml
        }
    }));
    return "<!DOCTYPE html>" + renderToString(page);
}
// Set up a preact option hook to track when vnode with custom functions are
// created.
const ISLANDS = [];
const ENCOUNTERED_ISLANDS = new Set([]);
let ISLAND_PROPS = [];
const originalHook = options.vnode;
let ignoreNext = false;
options.vnode = (vnode)=>{
    assetHashingHook(vnode);
    const originalType = vnode.type;
    if (typeof vnode.type === "function") {
        const island = ISLANDS.find((island)=>island.component === originalType);
        if (island) {
            if (ignoreNext) {
                ignoreNext = false;
                return;
            }
            ENCOUNTERED_ISLANDS.add(island);
            vnode.type = (props)=>{
                ignoreNext = true;
                const child = h(originalType, props);
                ISLAND_PROPS.push(props);
                return h(`!--frsh-${island.id}:${ISLAND_PROPS.length - 1}--`, null, child);
            };
        }
    }
    if (originalHook) originalHook(vnode);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvZnJlc2hAMS4wLjEvc3JjL3NlcnZlci9yZW5kZXIudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKiBAanN4IGggKi9cbmltcG9ydCB7IHJlbmRlclRvU3RyaW5nIH0gZnJvbSBcInByZWFjdC1yZW5kZXItdG8tc3RyaW5nXCI7XG5pbXBvcnQgeyBDb21wb25lbnRDaGlsZHJlbiwgQ29tcG9uZW50VHlwZSwgaCwgb3B0aW9ucyB9IGZyb20gXCJwcmVhY3RcIjtcbmltcG9ydCB7XG4gIEFwcE1vZHVsZSxcbiAgRXJyb3JQYWdlLFxuICBJc2xhbmQsXG4gIFJlbmRlckZ1bmN0aW9uLFxuICBSb3V0ZSxcbiAgVW5rbm93blBhZ2UsXG59IGZyb20gXCIuL3R5cGVzLnRzXCI7XG5pbXBvcnQgeyBIRUFEX0NPTlRFWFQgfSBmcm9tIFwiLi4vcnVudGltZS9oZWFkLnRzXCI7XG5pbXBvcnQgeyBDU1BfQ09OVEVYVCwgbm9uY2UsIE5PTkUsIFVOU0FGRV9JTkxJTkUgfSBmcm9tIFwiLi4vcnVudGltZS9jc3AudHNcIjtcbmltcG9ydCB7IENvbnRlbnRTZWN1cml0eVBvbGljeSB9IGZyb20gXCIuLi9ydW50aW1lL2NzcC50c1wiO1xuaW1wb3J0IHsgYnVuZGxlQXNzZXRVcmwgfSBmcm9tIFwiLi9jb25zdGFudHMudHNcIjtcbmltcG9ydCB7IGFzc2V0SGFzaGluZ0hvb2sgfSBmcm9tIFwiLi4vcnVudGltZS91dGlscy50c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlck9wdGlvbnM8RGF0YT4ge1xuICByb3V0ZTogUm91dGU8RGF0YT4gfCBVbmtub3duUGFnZSB8IEVycm9yUGFnZTtcbiAgaXNsYW5kczogSXNsYW5kW107XG4gIGFwcDogQXBwTW9kdWxlO1xuICBpbXBvcnRzOiBzdHJpbmdbXTtcbiAgcHJlbG9hZHM6IHN0cmluZ1tdO1xuICB1cmw6IFVSTDtcbiAgcGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBzdHJpbmdbXT47XG4gIHJlbmRlckZuOiBSZW5kZXJGdW5jdGlvbjtcbiAgZGF0YT86IERhdGE7XG4gIGVycm9yPzogdW5rbm93bjtcbiAgbGFuZz86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgSW5uZXJSZW5kZXJGdW5jdGlvbiA9ICgpID0+IHN0cmluZztcblxuZXhwb3J0IGNsYXNzIFJlbmRlckNvbnRleHQge1xuICAjaWQ6IHN0cmluZztcbiAgI3N0YXRlOiBNYXA8c3RyaW5nLCB1bmtub3duPiA9IG5ldyBNYXAoKTtcbiAgI3N0eWxlczogc3RyaW5nW10gPSBbXTtcbiAgI3VybDogVVJMO1xuICAjcm91dGU6IHN0cmluZztcbiAgI2xhbmc6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCB1cmw6IFVSTCwgcm91dGU6IHN0cmluZywgbGFuZzogc3RyaW5nKSB7XG4gICAgdGhpcy4jaWQgPSBpZDtcbiAgICB0aGlzLiN1cmwgPSB1cmw7XG4gICAgdGhpcy4jcm91dGUgPSByb3V0ZTtcbiAgICB0aGlzLiNsYW5nID0gbGFuZztcbiAgfVxuXG4gIC8qKiBBIHVuaXF1ZSBJRCBmb3IgdGhpcyBsb2dpY2FsIEpJVCByZW5kZXIuICovXG4gIGdldCBpZCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLiNpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGF0ZSB0aGF0IGlzIHBlcnNpc3RlZCBiZXR3ZWVuIG11bHRpcGxlIHJlbmRlcnMgd2l0aCB0aGUgc2FtZSByZW5kZXJcbiAgICogY29udGV4dC4gVGhpcyBpcyB1c2VmdWwgYmVjYXVzZSBvbmUgbG9naWNhbCBKSVQgcmVuZGVyIGNvdWxkIGhhdmUgbXVsdGlwbGVcbiAgICogcHJlYWN0IHJlbmRlciBwYXNzZXMgZHVlIHRvIHN1c3BlbnNlLlxuICAgKi9cbiAgZ2V0IHN0YXRlKCk6IE1hcDxzdHJpbmcsIHVua25vd24+IHtcbiAgICByZXR1cm4gdGhpcy4jc3RhdGU7XG4gIH1cblxuICAvKipcbiAgICogQWxsIG9mIHRoZSBDU1Mgc3R5bGUgcnVsZXMgdGhhdCBzaG91bGQgYmUgaW5saW5lZCBpbnRvIHRoZSBkb2N1bWVudC5cbiAgICogQWRkaW5nIHRvIHRoaXMgbGlzdCBhY3Jvc3MgbXVsdGlwbGUgcmVuZGVycyBpcyBzdXBwb3J0ZWQgKGV2ZW4gYWNyb3NzXG4gICAqIHN1c3BlbnNlISkuIFRoZSBDU1MgcnVsZXMgd2lsbCBhbHdheXMgYmUgaW5zZXJ0ZWQgb24gdGhlIGNsaWVudCBpbiB0aGVcbiAgICogb3JkZXIgc3BlY2lmaWVkIGhlcmUuXG4gICAqL1xuICBnZXQgc3R5bGVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gdGhpcy4jc3R5bGVzO1xuICB9XG5cbiAgLyoqIFRoZSBVUkwgb2YgdGhlIHBhZ2UgYmVpbmcgcmVuZGVyZWQuICovXG4gIGdldCB1cmwoKTogVVJMIHtcbiAgICByZXR1cm4gdGhpcy4jdXJsO1xuICB9XG5cbiAgLyoqIFRoZSByb3V0ZSBtYXRjaGVyIChlLmcuIC9ibG9nLzppZCkgdGhhdCB0aGUgcmVxdWVzdCBtYXRjaGVkIGZvciB0aGlzIHBhZ2VcbiAgICogdG8gYmUgcmVuZGVyZWQuICovXG4gIGdldCByb3V0ZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLiNyb3V0ZTtcbiAgfVxuXG4gIC8qKiBUaGUgbGFuZ3VhZ2Ugb2YgdGhlIHBhZ2UgYmVpbmcgcmVuZGVyZWQuIERlZmF1bHRzIHRvIFwiZW5cIi4gKi9cbiAgZ2V0IGxhbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy4jbGFuZztcbiAgfVxuICBzZXQgbGFuZyhsYW5nOiBzdHJpbmcpIHtcbiAgICB0aGlzLiNsYW5nID0gbGFuZztcbiAgfVxufVxuXG5mdW5jdGlvbiBkZWZhdWx0Q3NwKCkge1xuICByZXR1cm4ge1xuICAgIGRpcmVjdGl2ZXM6IHsgZGVmYXVsdFNyYzogW05PTkVdLCBzdHlsZVNyYzogW1VOU0FGRV9JTkxJTkVdIH0sXG4gICAgcmVwb3J0T25seTogZmFsc2UsXG4gIH07XG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiByZW5kZXJzIG91dCBhIHBhZ2UuIFJlbmRlcmluZyBpcyBhc3luY2hyb25vdXMsIGFuZCBzdHJlYW1pbmcuXG4gKiBSZW5kZXJpbmcgaGFwcGVucyBpbiBtdWx0aXBsZSBzdGVwcywgYmVjYXVzZSBvZiB0aGUgbmVlZCB0byBoYW5kbGUgc3VzcGVuc2UuXG4gKlxuICogMS4gVGhlIHBhZ2UncyB2bm9kZSB0cmVlIGlzIGNvbnN0cnVjdGVkLlxuICogMi4gVGhlIHBhZ2UncyB2bm9kZSB0cmVlIGlzIHBhc3NlZCB0byB0aGUgcmVuZGVyZXIuXG4gKiAgIC0gSWYgdGhlIHJlbmRlcmluZyB0aHJvd3MgYSBwcm9taXNlLCB0aGUgcHJvbWlzZSBpcyBhd2FpdGVkIGJlZm9yZVxuICogICAgIGNvbnRpbnVpbmcuIFRoaXMgYWxsb3dzIHRoZSByZW5kZXJlciB0byBoYW5kbGUgYXN5bmMgaG9va3MuXG4gKiAgIC0gT25jZSB0aGUgcmVuZGVyaW5nIHRocm93cyBubyBtb3JlIHByb21pc2VzLCB0aGUgaW5pdGlhbCByZW5kZXIgaXNcbiAqICAgICBjb21wbGV0ZSBhbmQgYSBib2R5IHN0cmluZyBpcyByZXR1cm5lZC5cbiAqICAgLSBEdXJpbmcgcmVuZGVyaW5nLCBldmVyeSB0aW1lIGEgYDxTdXNwZW5zZT5gIGlzIHJlbmRlcmVkLCBpdCwgYW5kIGl0J3NcbiAqICAgICBhdHRhY2hlZCBjaGlsZHJlbiBhcmUgcmVjb3JkZWQgZm9yIGxhdGVyIHJlbmRlcmluZy5cbiAqIDMuIE9uY2UgdGhlIGluaXRhbCByZW5kZXIgaXMgY29tcGxldGUsIHRoZSBib2R5IHN0cmluZyBpcyBmaXR0ZWQgaW50byB0aGVcbiAqICAgIEhUTUwgd3JhcHBlciB0ZW1wbGF0ZS5cbiAqIDQuIFRoZSBmdWxsIGluaXRhbCByZW5kZXIgaW4gdGhlIHRlbXBsYXRlIGlzIHlpZWxkZWQgdG8gYmUgc2VudCB0byB0aGVcbiAqICAgIGNsaWVudC5cbiAqIDUuIE5vdyB0aGUgc3VzcGVuZGVkIHZub2RlcyBhcmUgcmVuZGVyZWQuIFRoZXNlIGFyZSBpbmRpdmlkdWFsbHkgcmVuZGVyZWRcbiAqICAgIGxpa2UgZGVzY3JpYmVkIGluIHN0ZXAgMiBhYm92ZS4gT25jZSBlYWNoIG5vZGUgaXMgZG9uZSByZW5kZXJpbmcsIGl0XG4gKiAgICB3cmFwcGVkIGluIHNvbWUgYm9pbGRlcnBsYXRlIEhUTUwsIGFuZCBzdWZmaXhlZCB3aXRoIHNvbWUgSlMsIGFuZCB0aGVuXG4gKiAgICBzZW50IHRvIHRoZSBjbGllbnQuIE9uIHRoZSBjbGllbnQgdGhlIEhUTUwgd2lsbCBiZSBzbG90dGVkIGludG8gdGhlIERPTVxuICogICAgYXQgdGhlIGxvY2F0aW9uIG9mIHRoZSBvcmlnaW5hbCBgPFN1c3BlbnNlPmAgbm9kZS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbmRlcjxEYXRhPihcbiAgb3B0czogUmVuZGVyT3B0aW9uczxEYXRhPixcbik6IFByb21pc2U8W3N0cmluZywgQ29udGVudFNlY3VyaXR5UG9saWN5IHwgdW5kZWZpbmVkXT4ge1xuICBjb25zdCBwcm9wczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgcGFyYW1zOiBvcHRzLnBhcmFtcyxcbiAgICB1cmw6IG9wdHMudXJsLFxuICAgIHJvdXRlOiBvcHRzLnJvdXRlLnBhdHRlcm4sXG4gICAgZGF0YTogb3B0cy5kYXRhLFxuICB9O1xuICBpZiAob3B0cy5lcnJvcikge1xuICAgIHByb3BzLmVycm9yID0gb3B0cy5lcnJvcjtcbiAgfVxuXG4gIGNvbnN0IGNzcDogQ29udGVudFNlY3VyaXR5UG9saWN5IHwgdW5kZWZpbmVkID0gb3B0cy5yb3V0ZS5jc3BcbiAgICA/IGRlZmF1bHRDc3AoKVxuICAgIDogdW5kZWZpbmVkO1xuICBjb25zdCBoZWFkQ29tcG9uZW50czogQ29tcG9uZW50Q2hpbGRyZW5bXSA9IFtdO1xuXG4gIGNvbnN0IHZub2RlID0gaChDU1BfQ09OVEVYVC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiBjc3AsXG4gICAgY2hpbGRyZW46IGgoSEVBRF9DT05URVhULlByb3ZpZGVyLCB7XG4gICAgICB2YWx1ZTogaGVhZENvbXBvbmVudHMsXG4gICAgICBjaGlsZHJlbjogaChvcHRzLmFwcC5kZWZhdWx0LCB7XG4gICAgICAgIENvbXBvbmVudCgpIHtcbiAgICAgICAgICByZXR1cm4gaChvcHRzLnJvdXRlLmNvbXBvbmVudCEgYXMgQ29tcG9uZW50VHlwZTx1bmtub3duPiwgcHJvcHMpO1xuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgfSksXG4gIH0pO1xuXG4gIGNvbnN0IGN0eCA9IG5ldyBSZW5kZXJDb250ZXh0KFxuICAgIGNyeXB0by5yYW5kb21VVUlEKCksXG4gICAgb3B0cy51cmwsXG4gICAgb3B0cy5yb3V0ZS5wYXR0ZXJuLFxuICAgIG9wdHMubGFuZyA/PyBcImVuXCIsXG4gICk7XG5cbiAgaWYgKGNzcCkge1xuICAgIC8vIENsZWFyIHRoZSBjc3BcbiAgICBjb25zdCBuZXdDc3AgPSBkZWZhdWx0Q3NwKCk7XG4gICAgY3NwLmRpcmVjdGl2ZXMgPSBuZXdDc3AuZGlyZWN0aXZlcztcbiAgICBjc3AucmVwb3J0T25seSA9IG5ld0NzcC5yZXBvcnRPbmx5O1xuICB9XG4gIC8vIENsZWFyIHRoZSBoZWFkIGNvbXBvbmVudHNcbiAgaGVhZENvbXBvbmVudHMuc3BsaWNlKDAsIGhlYWRDb21wb25lbnRzLmxlbmd0aCk7XG5cbiAgLy8gU2V0dXAgdGhlIGludGVyZXN0aW5nIFZOb2RlIHR5cGVzXG4gIElTTEFORFMuc3BsaWNlKDAsIElTTEFORFMubGVuZ3RoLCAuLi5vcHRzLmlzbGFuZHMpO1xuXG4gIC8vIENsZWFyIHRoZSBlbmNvdW50ZXJlZCB2bm9kZXNcbiAgRU5DT1VOVEVSRURfSVNMQU5EUy5jbGVhcigpO1xuXG4gIC8vIENsZWFyIHRoZSBpc2xhbmQgcHJvcHNcbiAgSVNMQU5EX1BST1BTID0gW107XG5cbiAgbGV0IGJvZHlIdG1sOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBmdW5jdGlvbiByZW5kZXIoKSB7XG4gICAgYm9keUh0bWwgPSByZW5kZXJUb1N0cmluZyh2bm9kZSk7XG4gICAgcmV0dXJuIGJvZHlIdG1sO1xuICB9XG5cbiAgYXdhaXQgb3B0cy5yZW5kZXJGbihjdHgsIHJlbmRlciBhcyBJbm5lclJlbmRlckZ1bmN0aW9uKTtcblxuICBpZiAoYm9keUh0bWwgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYHJlbmRlcmAgZnVuY3Rpb24gd2FzIG5vdCBjYWxsZWQgYnkgdGhlIHJlbmRlcmVyLlwiKTtcbiAgfVxuXG4gIGNvbnN0IGltcG9ydHMgPSBvcHRzLmltcG9ydHMubWFwKCh1cmwpID0+IHtcbiAgICBjb25zdCByYW5kb21Ob25jZSA9IGNyeXB0by5yYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCBcIlwiKTtcbiAgICBpZiAoY3NwKSB7XG4gICAgICBjc3AuZGlyZWN0aXZlcy5zY3JpcHRTcmMgPSBbXG4gICAgICAgIC4uLmNzcC5kaXJlY3RpdmVzLnNjcmlwdFNyYyA/PyBbXSxcbiAgICAgICAgbm9uY2UocmFuZG9tTm9uY2UpLFxuICAgICAgXTtcbiAgICB9XG4gICAgcmV0dXJuIFt1cmwsIHJhbmRvbU5vbmNlXSBhcyBjb25zdDtcbiAgfSk7XG5cbiAgaWYgKEVOQ09VTlRFUkVEX0lTTEFORFMuc2l6ZSA+IDApIHtcbiAgICAvLyBMb2FkIHRoZSBtYWluLmpzIHNjcmlwdFxuICAgIHtcbiAgICAgIGNvbnN0IHJhbmRvbU5vbmNlID0gY3J5cHRvLnJhbmRvbVVVSUQoKS5yZXBsYWNlKC8tL2csIFwiXCIpO1xuICAgICAgaWYgKGNzcCkge1xuICAgICAgICBjc3AuZGlyZWN0aXZlcy5zY3JpcHRTcmMgPSBbXG4gICAgICAgICAgLi4uY3NwLmRpcmVjdGl2ZXMuc2NyaXB0U3JjID8/IFtdLFxuICAgICAgICAgIG5vbmNlKHJhbmRvbU5vbmNlKSxcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHVybCA9IGJ1bmRsZUFzc2V0VXJsKFwiL21haW4uanNcIik7XG4gICAgICBpbXBvcnRzLnB1c2goW3VybCwgcmFuZG9tTm9uY2VdIGFzIGNvbnN0KTtcbiAgICB9XG5cbiAgICAvLyBQcmVwYXJlIHRoZSBpbmxpbmUgc2NyaXB0IHRoYXQgbG9hZHMgYW5kIHJldml2ZXMgdGhlIGlzbGFuZHNcbiAgICBsZXQgaXNsYW5kSW1wb3J0cyA9IFwiXCI7XG4gICAgbGV0IGlzbGFuZFJlZ2lzdHJ5ID0gXCJcIjtcbiAgICBmb3IgKGNvbnN0IGlzbGFuZCBvZiBFTkNPVU5URVJFRF9JU0xBTkRTKSB7XG4gICAgICBjb25zdCByYW5kb21Ob25jZSA9IGNyeXB0by5yYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCBcIlwiKTtcbiAgICAgIGlmIChjc3ApIHtcbiAgICAgICAgY3NwLmRpcmVjdGl2ZXMuc2NyaXB0U3JjID0gW1xuICAgICAgICAgIC4uLmNzcC5kaXJlY3RpdmVzLnNjcmlwdFNyYyA/PyBbXSxcbiAgICAgICAgICBub25jZShyYW5kb21Ob25jZSksXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgICBjb25zdCB1cmwgPSBidW5kbGVBc3NldFVybChgL2lzbGFuZC0ke2lzbGFuZC5pZH0uanNgKTtcbiAgICAgIGltcG9ydHMucHVzaChbdXJsLCByYW5kb21Ob25jZV0gYXMgY29uc3QpO1xuICAgICAgaXNsYW5kSW1wb3J0cyArPSBgXFxuaW1wb3J0ICR7aXNsYW5kLm5hbWV9IGZyb20gXCIke3VybH1cIjtgO1xuICAgICAgaXNsYW5kUmVnaXN0cnkgKz0gYFxcbiAgJHtpc2xhbmQuaWR9OiAke2lzbGFuZC5uYW1lfSxgO1xuICAgIH1cbiAgICBjb25zdCBpbml0Q29kZSA9IGBpbXBvcnQgeyByZXZpdmUgfSBmcm9tIFwiJHtcbiAgICAgIGJ1bmRsZUFzc2V0VXJsKFwiL21haW4uanNcIilcbiAgICB9XCI7JHtpc2xhbmRJbXBvcnRzfVxcbnJldml2ZSh7JHtpc2xhbmRSZWdpc3RyeX1cXG59KTtgO1xuXG4gICAgLy8gQXBwZW5kIHRoZSBpbmxpbmUgc2NyaXB0IHRvIHRoZSBib2R5XG4gICAgY29uc3QgcmFuZG9tTm9uY2UgPSBjcnlwdG8ucmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIik7XG4gICAgaWYgKGNzcCkge1xuICAgICAgY3NwLmRpcmVjdGl2ZXMuc2NyaXB0U3JjID0gW1xuICAgICAgICAuLi5jc3AuZGlyZWN0aXZlcy5zY3JpcHRTcmMgPz8gW10sXG4gICAgICAgIG5vbmNlKHJhbmRvbU5vbmNlKSxcbiAgICAgIF07XG4gICAgfVxuICAgIChib2R5SHRtbCBhcyBzdHJpbmcpICs9XG4gICAgICBgPHNjcmlwdCBpZD1cIl9fRlJTSF9JU0xBTkRfUFJPUFNcIiB0eXBlPVwiYXBwbGljYXRpb24vanNvblwiPiR7XG4gICAgICAgIEpTT04uc3RyaW5naWZ5KElTTEFORF9QUk9QUylcbiAgICAgIH08L3NjcmlwdD48c2NyaXB0IHR5cGU9XCJtb2R1bGVcIiBub25jZT1cIiR7cmFuZG9tTm9uY2V9XCI+JHtpbml0Q29kZX08L3NjcmlwdD5gO1xuICB9XG5cbiAgY29uc3QgaHRtbCA9IHRlbXBsYXRlKHtcbiAgICBib2R5SHRtbCxcbiAgICBoZWFkQ29tcG9uZW50cyxcbiAgICBpbXBvcnRzLFxuICAgIHByZWxvYWRzOiBvcHRzLnByZWxvYWRzLFxuICAgIHN0eWxlczogY3R4LnN0eWxlcyxcbiAgICBsYW5nOiBjdHgubGFuZyxcbiAgfSk7XG5cbiAgcmV0dXJuIFtodG1sLCBjc3BdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlbXBsYXRlT3B0aW9ucyB7XG4gIGJvZHlIdG1sOiBzdHJpbmc7XG4gIGhlYWRDb21wb25lbnRzOiBDb21wb25lbnRDaGlsZHJlbltdO1xuICBpbXBvcnRzOiAocmVhZG9ubHkgW3N0cmluZywgc3RyaW5nXSlbXTtcbiAgc3R5bGVzOiBzdHJpbmdbXTtcbiAgcHJlbG9hZHM6IHN0cmluZ1tdO1xuICBsYW5nOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZShvcHRzOiBUZW1wbGF0ZU9wdGlvbnMpOiBzdHJpbmcge1xuICBjb25zdCBwYWdlID0gKFxuICAgIDxodG1sIGxhbmc9e29wdHMubGFuZ30+XG4gICAgICA8aGVhZD5cbiAgICAgICAgPG1ldGEgY2hhclNldD1cIlVURi04XCIgLz5cbiAgICAgICAgPG1ldGEgaHR0cC1lcXVpdj1cIlgtVUEtQ29tcGF0aWJsZVwiIGNvbnRlbnQ9XCJJRT1lZGdlXCIgLz5cbiAgICAgICAgPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjBcIiAvPlxuICAgICAgICB7b3B0cy5wcmVsb2Fkcy5tYXAoKHNyYykgPT4gPGxpbmsgcmVsPVwibW9kdWxlcHJlbG9hZFwiIGhyZWY9e3NyY30gLz4pfVxuICAgICAgICB7b3B0cy5pbXBvcnRzLm1hcCgoW3NyYywgbm9uY2VdKSA9PiAoXG4gICAgICAgICAgPHNjcmlwdCBzcmM9e3NyY30gbm9uY2U9e25vbmNlfSB0eXBlPVwibW9kdWxlXCI+PC9zY3JpcHQ+XG4gICAgICAgICkpfVxuICAgICAgICA8c3R5bGVcbiAgICAgICAgICBpZD1cIl9fRlJTSF9TVFlMRVwiXG4gICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3sgX19odG1sOiBvcHRzLnN0eWxlcy5qb2luKFwiXFxuXCIpIH19XG4gICAgICAgIC8+XG4gICAgICAgIHtvcHRzLmhlYWRDb21wb25lbnRzfVxuICAgICAgPC9oZWFkPlxuICAgICAgPGJvZHkgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3sgX19odG1sOiBvcHRzLmJvZHlIdG1sIH19IC8+XG4gICAgPC9odG1sPlxuICApO1xuXG4gIHJldHVybiBcIjwhRE9DVFlQRSBodG1sPlwiICsgcmVuZGVyVG9TdHJpbmcocGFnZSk7XG59XG5cbi8vIFNldCB1cCBhIHByZWFjdCBvcHRpb24gaG9vayB0byB0cmFjayB3aGVuIHZub2RlIHdpdGggY3VzdG9tIGZ1bmN0aW9ucyBhcmVcbi8vIGNyZWF0ZWQuXG5jb25zdCBJU0xBTkRTOiBJc2xhbmRbXSA9IFtdO1xuY29uc3QgRU5DT1VOVEVSRURfSVNMQU5EUzogU2V0PElzbGFuZD4gPSBuZXcgU2V0KFtdKTtcbmxldCBJU0xBTkRfUFJPUFM6IHVua25vd25bXSA9IFtdO1xuY29uc3Qgb3JpZ2luYWxIb29rID0gb3B0aW9ucy52bm9kZTtcbmxldCBpZ25vcmVOZXh0ID0gZmFsc2U7XG5vcHRpb25zLnZub2RlID0gKHZub2RlKSA9PiB7XG4gIGFzc2V0SGFzaGluZ0hvb2sodm5vZGUpO1xuICBjb25zdCBvcmlnaW5hbFR5cGUgPSB2bm9kZS50eXBlIGFzIENvbXBvbmVudFR5cGU8dW5rbm93bj47XG4gIGlmICh0eXBlb2Ygdm5vZGUudHlwZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY29uc3QgaXNsYW5kID0gSVNMQU5EUy5maW5kKChpc2xhbmQpID0+IGlzbGFuZC5jb21wb25lbnQgPT09IG9yaWdpbmFsVHlwZSk7XG4gICAgaWYgKGlzbGFuZCkge1xuICAgICAgaWYgKGlnbm9yZU5leHQpIHtcbiAgICAgICAgaWdub3JlTmV4dCA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBFTkNPVU5URVJFRF9JU0xBTkRTLmFkZChpc2xhbmQpO1xuICAgICAgdm5vZGUudHlwZSA9IChwcm9wcykgPT4ge1xuICAgICAgICBpZ25vcmVOZXh0ID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgY2hpbGQgPSBoKG9yaWdpbmFsVHlwZSwgcHJvcHMpO1xuICAgICAgICBJU0xBTkRfUFJPUFMucHVzaChwcm9wcyk7XG4gICAgICAgIHJldHVybiBoKFxuICAgICAgICAgIGAhLS1mcnNoLSR7aXNsYW5kLmlkfToke0lTTEFORF9QUk9QUy5sZW5ndGggLSAxfS0tYCxcbiAgICAgICAgICBudWxsLFxuICAgICAgICAgIGNoaWxkLFxuICAgICAgICApO1xuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgaWYgKG9yaWdpbmFsSG9vaykgb3JpZ2luYWxIb29rKHZub2RlKTtcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsYUFBYSxDQUNiLFNBQVMsY0FBYyxRQUFRLHlCQUF5QixDQUFDO0FBQ3pELFNBQTJDLENBQUMsRUFBRSxPQUFPLFFBQVEsUUFBUSxDQUFDO0FBU3RFLFNBQVMsWUFBWSxRQUFRLG9CQUFvQixDQUFDO0FBQ2xELFNBQVMsV0FBVyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsYUFBYSxRQUFRLG1CQUFtQixDQUFDO0FBRTVFLFNBQVMsY0FBYyxRQUFRLGdCQUFnQixDQUFDO0FBQ2hELFNBQVMsZ0JBQWdCLFFBQVEscUJBQXFCLENBQUM7QUFrQnZELE9BQU8sTUFBTSxhQUFhO0lBQ3hCLENBQUMsRUFBRSxDQUFTO0lBQ1osQ0FBQyxLQUFLLEdBQXlCLElBQUksR0FBRyxFQUFFLENBQUM7SUFDekMsQ0FBQyxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUMsR0FBRyxDQUFNO0lBQ1YsQ0FBQyxLQUFLLENBQVM7SUFDZixDQUFDLElBQUksQ0FBUztJQUVkLFlBQVksRUFBVSxFQUFFLEdBQVEsRUFBRSxLQUFhLEVBQUUsSUFBWSxDQUFFO1FBQzdELElBQUksQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDcEIsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztLQUNuQjtJQUVELCtDQUErQyxDQUMvQyxJQUFJLEVBQUUsR0FBVztRQUNmLE9BQU8sSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDO0tBQ2pCO0lBRUQ7Ozs7S0FJRyxDQUNILElBQUksS0FBSyxHQUF5QjtRQUNoQyxPQUFPLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQztLQUNwQjtJQUVEOzs7OztLQUtHLENBQ0gsSUFBSSxNQUFNLEdBQWE7UUFDckIsT0FBTyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUM7S0FDckI7SUFFRCwwQ0FBMEMsQ0FDMUMsSUFBSSxHQUFHLEdBQVE7UUFDYixPQUFPLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQztLQUNsQjtJQUVEO3VCQUNxQixDQUNyQixJQUFJLEtBQUssR0FBVztRQUNsQixPQUFPLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQztLQUNwQjtJQUVELGlFQUFpRSxDQUNqRSxJQUFJLElBQUksR0FBVztRQUNqQixPQUFPLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQztLQUNuQjtJQUNELElBQUksSUFBSSxDQUFDLElBQVksRUFBRTtRQUNyQixJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0tBQ25CO0NBQ0Y7QUFFRCxTQUFTLFVBQVUsR0FBRztJQUNwQixPQUFPO1FBQ0wsVUFBVSxFQUFFO1lBQUUsVUFBVSxFQUFFO2dCQUFDLElBQUk7YUFBQztZQUFFLFFBQVEsRUFBRTtnQkFBQyxhQUFhO2FBQUM7U0FBRTtRQUM3RCxVQUFVLEVBQUUsS0FBSztLQUNsQixDQUFDO0NBQ0g7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBcUJHLENBQ0gsT0FBTyxlQUFlLE1BQU0sQ0FDMUIsSUFBeUIsRUFDNkI7SUFDdEQsTUFBTSxLQUFLLEdBQTRCO1FBQ3JDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtRQUNuQixHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7UUFDYixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPO1FBQ3pCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtLQUNoQixBQUFDO0lBQ0YsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ2QsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0tBQzFCO0lBRUQsTUFBTSxHQUFHLEdBQXNDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUN6RCxVQUFVLEVBQUUsR0FDWixTQUFTLEFBQUM7SUFDZCxNQUFNLGNBQWMsR0FBd0IsRUFBRSxBQUFDO0lBRS9DLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFO1FBQ3BDLEtBQUssRUFBRSxHQUFHO1FBQ1YsUUFBUSxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFO1lBQ2pDLEtBQUssRUFBRSxjQUFjO1lBQ3JCLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUU7Z0JBQzVCLFNBQVMsSUFBRztvQkFDVixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBNkIsS0FBSyxDQUFDLENBQUM7aUJBQ2xFO2FBQ0YsQ0FBQztTQUNILENBQUM7S0FDSCxDQUFDLEFBQUM7SUFFSCxNQUFNLEdBQUcsR0FBRyxJQUFJLGFBQWEsQ0FDM0IsTUFBTSxDQUFDLFVBQVUsRUFBRSxFQUNuQixJQUFJLENBQUMsR0FBRyxFQUNSLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUNsQixJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FDbEIsQUFBQztJQUVGLElBQUksR0FBRyxFQUFFO1FBQ1AsZ0JBQWdCO1FBQ2hCLE1BQU0sTUFBTSxHQUFHLFVBQVUsRUFBRSxBQUFDO1FBQzVCLEdBQUcsQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQUNuQyxHQUFHLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7S0FDcEM7SUFDRCw0QkFBNEI7SUFDNUIsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWhELG9DQUFvQztJQUNwQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUVuRCwrQkFBK0I7SUFDL0IsbUJBQW1CLENBQUMsS0FBSyxFQUFFLENBQUM7SUFFNUIseUJBQXlCO0lBQ3pCLFlBQVksR0FBRyxFQUFFLENBQUM7SUFFbEIsSUFBSSxRQUFRLEdBQWtCLElBQUksQUFBQztJQUVuQyxTQUFTLE1BQU0sR0FBRztRQUNoQixRQUFRLEdBQUcsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLE9BQU8sUUFBUSxDQUFDO0tBQ2pCO0lBRUQsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQXdCLENBQUM7SUFFeEQsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsdURBQXVELENBQUMsQ0FBQztLQUMxRTtJQUVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFLO1FBQ3hDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxPQUFPLE9BQU8sRUFBRSxDQUFDLEFBQUM7UUFDMUQsSUFBSSxHQUFHLEVBQUU7WUFDUCxHQUFHLENBQUMsVUFBVSxDQUFDLFNBQVMsR0FBRzttQkFDdEIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxTQUFTLElBQUksRUFBRTtnQkFDakMsS0FBSyxDQUFDLFdBQVcsQ0FBQzthQUNuQixDQUFDO1NBQ0g7UUFDRCxPQUFPO1lBQUMsR0FBRztZQUFFLFdBQVc7U0FBQyxDQUFVO0tBQ3BDLENBQUMsQUFBQztJQUVILElBQUksbUJBQW1CLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRTtRQUNoQywwQkFBMEI7UUFDMUI7WUFDRSxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsT0FBTyxPQUFPLEVBQUUsQ0FBQyxBQUFDO1lBQzFELElBQUksR0FBRyxFQUFFO2dCQUNQLEdBQUcsQ0FBQyxVQUFVLENBQUMsU0FBUyxHQUFHO3VCQUN0QixHQUFHLENBQUMsVUFBVSxDQUFDLFNBQVMsSUFBSSxFQUFFO29CQUNqQyxLQUFLLENBQUMsV0FBVyxDQUFDO2lCQUNuQixDQUFDO2FBQ0g7WUFDRCxNQUFNLEdBQUcsR0FBRyxjQUFjLENBQUMsVUFBVSxDQUFDLEFBQUM7WUFDdkMsT0FBTyxDQUFDLElBQUksQ0FBQztnQkFBQyxHQUFHO2dCQUFFLFdBQVc7YUFBQyxDQUFVLENBQUM7U0FDM0M7UUFFRCwrREFBK0Q7UUFDL0QsSUFBSSxhQUFhLEdBQUcsRUFBRSxBQUFDO1FBQ3ZCLElBQUksY0FBYyxHQUFHLEVBQUUsQUFBQztRQUN4QixLQUFLLE1BQU0sTUFBTSxJQUFJLG1CQUFtQixDQUFFO1lBQ3hDLE1BQU0sWUFBVyxHQUFHLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxPQUFPLE9BQU8sRUFBRSxDQUFDLEFBQUM7WUFDMUQsSUFBSSxHQUFHLEVBQUU7Z0JBQ1AsR0FBRyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEdBQUc7dUJBQ3RCLEdBQUcsQ0FBQyxVQUFVLENBQUMsU0FBUyxJQUFJLEVBQUU7b0JBQ2pDLEtBQUssQ0FBQyxZQUFXLENBQUM7aUJBQ25CLENBQUM7YUFDSDtZQUNELE1BQU0sSUFBRyxHQUFHLGNBQWMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEFBQUM7WUFDdEQsT0FBTyxDQUFDLElBQUksQ0FBQztnQkFBQyxJQUFHO2dCQUFFLFlBQVc7YUFBQyxDQUFVLENBQUM7WUFDMUMsYUFBYSxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMxRCxjQUFjLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN2RDtRQUNELE1BQU0sUUFBUSxHQUFHLENBQUMsd0JBQXdCLEVBQ3hDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FDM0IsRUFBRSxFQUFFLGFBQWEsQ0FBQyxVQUFVLEVBQUUsY0FBYyxDQUFDLEtBQUssQ0FBQyxBQUFDO1FBRXJELHVDQUF1QztRQUN2QyxNQUFNLFlBQVcsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsT0FBTyxPQUFPLEVBQUUsQ0FBQyxBQUFDO1FBQzFELElBQUksR0FBRyxFQUFFO1lBQ1AsR0FBRyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEdBQUc7bUJBQ3RCLEdBQUcsQ0FBQyxVQUFVLENBQUMsU0FBUyxJQUFJLEVBQUU7Z0JBQ2pDLEtBQUssQ0FBQyxZQUFXLENBQUM7YUFDbkIsQ0FBQztTQUNIO1FBQ0QsQUFBQyxRQUFRLElBQ1AsQ0FBQyx5REFBeUQsRUFDeEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FDN0Isc0NBQXNDLEVBQUUsWUFBVyxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDaEY7SUFFRCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUM7UUFDcEIsUUFBUTtRQUNSLGNBQWM7UUFDZCxPQUFPO1FBQ1AsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1FBQ3ZCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTTtRQUNsQixJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUk7S0FDZixDQUFDLEFBQUM7SUFFSCxPQUFPO1FBQUMsSUFBSTtRQUFFLEdBQUc7S0FBQyxDQUFDO0NBQ3BCO0FBV0QsT0FBTyxTQUFTLFFBQVEsQ0FBQyxJQUFxQixFQUFVO0lBQ3RELE1BQU0sSUFBSSxpQkFDUixBQS9RSixDQUFhLENBK1FSLE1BQUk7UUFBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7cUJBQ25CLEFBaFJOLENBQWEsQ0FnUk4sTUFBSSxzQkFDSCxBQWpSUixDQUFhLENBaVJKLE1BQUk7UUFBQyxPQUFPLEVBQUMsT0FBTztNQUFHLGdCQUN4QixBQWxSUixDQUFhLENBa1JKLE1BQUk7UUFBQyxZQUFVLEVBQUMsaUJBQWlCO1FBQUMsT0FBTyxFQUFDLFNBQVM7TUFBRyxnQkFDdkQsQUFuUlIsQ0FBYSxDQW1SSixNQUFJO1FBQUMsSUFBSSxFQUFDLFVBQVU7UUFBQyxPQUFPLEVBQUMsdUNBQXVDO01BQUcsRUFDdkUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLGlCQUFLLEFBcFJwQyxDQUFhLENBb1J3QixNQUFJO1lBQUMsR0FBRyxFQUFDLGVBQWU7WUFBQyxJQUFJLEVBQUUsR0FBRztVQUFJLENBQUMsRUFDbkUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsaUJBQzdCLEFBdFJWLENBQWEsQ0FzUkYsUUFBTTtZQUFDLEdBQUcsRUFBRSxHQUFHO1lBQUUsS0FBSyxFQUFFLEtBQUs7WUFBRSxJQUFJLEVBQUMsUUFBUTtVQUFVLEFBQ3hELENBQUMsZ0JBQ0YsQUF4UlIsQ0FBYSxDQXdSSixPQUFLO1FBQ0osRUFBRSxFQUFDLGNBQWM7UUFDakIsdUJBQXVCLEVBQUU7WUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1NBQUU7TUFDM0QsRUFDRCxJQUFJLENBQUMsY0FBYyxDQUNmLGdCQUNQLEFBOVJOLENBQWEsQ0E4Uk4sTUFBSTtRQUFDLHVCQUF1QixFQUFFO1lBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRO1NBQUU7TUFBSSxDQUN2RCxBQUNSLEFBQUM7SUFFRixPQUFPLGlCQUFpQixHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNqRDtBQUVELDRFQUE0RTtBQUM1RSxXQUFXO0FBQ1gsTUFBTSxPQUFPLEdBQWEsRUFBRSxBQUFDO0FBQzdCLE1BQU0sbUJBQW1CLEdBQWdCLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxBQUFDO0FBQ3JELElBQUksWUFBWSxHQUFjLEVBQUUsQUFBQztBQUNqQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsS0FBSyxBQUFDO0FBQ25DLElBQUksVUFBVSxHQUFHLEtBQUssQUFBQztBQUN2QixPQUFPLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxHQUFLO0lBQ3pCLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3hCLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxJQUFJLEFBQTBCLEFBQUM7SUFDMUQsSUFBSSxPQUFPLEtBQUssQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFO1FBQ3BDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUssTUFBTSxDQUFDLFNBQVMsS0FBSyxZQUFZLENBQUMsQUFBQztRQUMzRSxJQUFJLE1BQU0sRUFBRTtZQUNWLElBQUksVUFBVSxFQUFFO2dCQUNkLFVBQVUsR0FBRyxLQUFLLENBQUM7Z0JBQ25CLE9BQU87YUFDUjtZQUNELG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNoQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxHQUFLO2dCQUN0QixVQUFVLEdBQUcsSUFBSSxDQUFDO2dCQUNsQixNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxBQUFDO2dCQUNyQyxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN6QixPQUFPLENBQUMsQ0FDTixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFDbkQsSUFBSSxFQUNKLEtBQUssQ0FDTixDQUFDO2FBQ0gsQ0FBQztTQUNIO0tBQ0Y7SUFDRCxJQUFJLFlBQVksRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDdkMsQ0FBQyJ9