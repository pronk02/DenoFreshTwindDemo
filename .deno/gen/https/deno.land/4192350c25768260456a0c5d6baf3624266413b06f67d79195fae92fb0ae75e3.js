import { BUILD_ID } from "./constants.ts";
import { denoPlugin, esbuild, toFileUrl } from "./deps.ts";
let esbuildInitalized = false;
async function ensureEsbuildInitialized() {
    if (esbuildInitalized === false) {
        if (Deno.run === undefined) {
            esbuildInitalized = esbuild.initialize({
                wasmURL: "https://unpkg.com/esbuild-wasm@0.14.39/esbuild.wasm",
                worker: false
            });
        } else {
            esbuild.initialize({});
        }
        await esbuildInitalized;
        esbuildInitalized = true;
    } else if (esbuildInitalized instanceof Promise) {
        await esbuildInitalized;
    }
}
export class Bundler {
    #importMapURL;
    #islands;
    #cache = undefined;
    constructor(islands, importMapURL){
        this.#islands = islands;
        this.#importMapURL = importMapURL;
    }
    async bundle() {
        const entryPoints = {
            "main": new URL("../../src/runtime/main.ts", import.meta.url).href
        };
        for (const island of this.#islands){
            entryPoints[`island-${island.id}`] = island.url;
        }
        const absWorkingDir = Deno.cwd();
        await ensureEsbuildInitialized();
        const bundle = await esbuild.build({
            bundle: true,
            define: {
                __FRSH_BUILD_ID: `"${BUILD_ID}"`
            },
            entryPoints,
            format: "esm",
            metafile: true,
            minify: true,
            outdir: ".",
            // This is requried to ensure the format of the outputFiles path is the same
            // between windows and linux
            absWorkingDir,
            outfile: "",
            platform: "neutral",
            plugins: [
                denoPlugin({
                    importMapURL: this.#importMapURL
                })
            ],
            splitting: true,
            target: [
                "chrome99",
                "firefox99",
                "safari15"
            ],
            treeShaking: true,
            write: false
        });
        // const metafileOutputs = bundle.metafile!.outputs;
        // for (const path in metafileOutputs) {
        //   const meta = metafileOutputs[path];
        //   const imports = meta.imports
        //     .filter(({ kind }) => kind === "import-statement")
        //     .map(({ path }) => `/${path}`);
        //   this.#preloads.set(`/${path}`, imports);
        // }
        const cache = new Map();
        const absDirUrlLength = toFileUrl(absWorkingDir).href.length;
        for (const file of bundle.outputFiles){
            cache.set(toFileUrl(file.path).href.substring(absDirUrlLength), file.contents);
        }
        this.#cache = cache;
        return;
    }
    async cache() {
        if (this.#cache === undefined) {
            this.#cache = this.bundle();
        }
        if (this.#cache instanceof Promise) {
            await this.#cache;
        }
        return this.#cache;
    }
    async get(path) {
        const cache = await this.cache();
        return cache.get(path) ?? null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvZnJlc2hAMS4wLjEvc3JjL3NlcnZlci9idW5kbGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQlVJTERfSUQgfSBmcm9tIFwiLi9jb25zdGFudHMudHNcIjtcbmltcG9ydCB7IGRlbm9QbHVnaW4sIGVzYnVpbGQsIHRvRmlsZVVybCB9IGZyb20gXCIuL2RlcHMudHNcIjtcbmltcG9ydCB7IElzbGFuZCB9IGZyb20gXCIuL3R5cGVzLnRzXCI7XG5cbmxldCBlc2J1aWxkSW5pdGFsaXplZDogYm9vbGVhbiB8IFByb21pc2U8dm9pZD4gPSBmYWxzZTtcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUVzYnVpbGRJbml0aWFsaXplZCgpIHtcbiAgaWYgKGVzYnVpbGRJbml0YWxpemVkID09PSBmYWxzZSkge1xuICAgIGlmIChEZW5vLnJ1biA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlc2J1aWxkSW5pdGFsaXplZCA9IGVzYnVpbGQuaW5pdGlhbGl6ZSh7XG4gICAgICAgIHdhc21VUkw6IFwiaHR0cHM6Ly91bnBrZy5jb20vZXNidWlsZC13YXNtQDAuMTQuMzkvZXNidWlsZC53YXNtXCIsXG4gICAgICAgIHdvcmtlcjogZmFsc2UsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXNidWlsZC5pbml0aWFsaXplKHt9KTtcbiAgICB9XG4gICAgYXdhaXQgZXNidWlsZEluaXRhbGl6ZWQ7XG4gICAgZXNidWlsZEluaXRhbGl6ZWQgPSB0cnVlO1xuICB9IGVsc2UgaWYgKGVzYnVpbGRJbml0YWxpemVkIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgIGF3YWl0IGVzYnVpbGRJbml0YWxpemVkO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdW5kbGVyIHtcbiAgI2ltcG9ydE1hcFVSTDogVVJMO1xuICAjaXNsYW5kczogSXNsYW5kW107XG4gICNjYWNoZTogTWFwPHN0cmluZywgVWludDhBcnJheT4gfCBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKGlzbGFuZHM6IElzbGFuZFtdLCBpbXBvcnRNYXBVUkw6IFVSTCkge1xuICAgIHRoaXMuI2lzbGFuZHMgPSBpc2xhbmRzO1xuICAgIHRoaXMuI2ltcG9ydE1hcFVSTCA9IGltcG9ydE1hcFVSTDtcbiAgfVxuXG4gIGFzeW5jIGJ1bmRsZSgpIHtcbiAgICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIFwibWFpblwiOiBuZXcgVVJMKFwiLi4vLi4vc3JjL3J1bnRpbWUvbWFpbi50c1wiLCBpbXBvcnQubWV0YS51cmwpLmhyZWYsXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgaXNsYW5kIG9mIHRoaXMuI2lzbGFuZHMpIHtcbiAgICAgIGVudHJ5UG9pbnRzW2Bpc2xhbmQtJHtpc2xhbmQuaWR9YF0gPSBpc2xhbmQudXJsO1xuICAgIH1cblxuICAgIGNvbnN0IGFic1dvcmtpbmdEaXIgPSBEZW5vLmN3ZCgpO1xuICAgIGF3YWl0IGVuc3VyZUVzYnVpbGRJbml0aWFsaXplZCgpO1xuICAgIGNvbnN0IGJ1bmRsZSA9IGF3YWl0IGVzYnVpbGQuYnVpbGQoe1xuICAgICAgYnVuZGxlOiB0cnVlLFxuICAgICAgZGVmaW5lOiB7IF9fRlJTSF9CVUlMRF9JRDogYFwiJHtCVUlMRF9JRH1cImAgfSxcbiAgICAgIGVudHJ5UG9pbnRzLFxuICAgICAgZm9ybWF0OiBcImVzbVwiLFxuICAgICAgbWV0YWZpbGU6IHRydWUsXG4gICAgICBtaW5pZnk6IHRydWUsXG4gICAgICBvdXRkaXI6IFwiLlwiLFxuICAgICAgLy8gVGhpcyBpcyByZXF1cmllZCB0byBlbnN1cmUgdGhlIGZvcm1hdCBvZiB0aGUgb3V0cHV0RmlsZXMgcGF0aCBpcyB0aGUgc2FtZVxuICAgICAgLy8gYmV0d2VlbiB3aW5kb3dzIGFuZCBsaW51eFxuICAgICAgYWJzV29ya2luZ0RpcixcbiAgICAgIG91dGZpbGU6IFwiXCIsXG4gICAgICBwbGF0Zm9ybTogXCJuZXV0cmFsXCIsXG4gICAgICBwbHVnaW5zOiBbZGVub1BsdWdpbih7IGltcG9ydE1hcFVSTDogdGhpcy4jaW1wb3J0TWFwVVJMIH0pXSxcbiAgICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICAgIHRhcmdldDogW1wiY2hyb21lOTlcIiwgXCJmaXJlZm94OTlcIiwgXCJzYWZhcmkxNVwiXSxcbiAgICAgIHRyZWVTaGFraW5nOiB0cnVlLFxuICAgICAgd3JpdGU6IGZhbHNlLFxuICAgIH0pO1xuICAgIC8vIGNvbnN0IG1ldGFmaWxlT3V0cHV0cyA9IGJ1bmRsZS5tZXRhZmlsZSEub3V0cHV0cztcblxuICAgIC8vIGZvciAoY29uc3QgcGF0aCBpbiBtZXRhZmlsZU91dHB1dHMpIHtcbiAgICAvLyAgIGNvbnN0IG1ldGEgPSBtZXRhZmlsZU91dHB1dHNbcGF0aF07XG4gICAgLy8gICBjb25zdCBpbXBvcnRzID0gbWV0YS5pbXBvcnRzXG4gICAgLy8gICAgIC5maWx0ZXIoKHsga2luZCB9KSA9PiBraW5kID09PSBcImltcG9ydC1zdGF0ZW1lbnRcIilcbiAgICAvLyAgICAgLm1hcCgoeyBwYXRoIH0pID0+IGAvJHtwYXRofWApO1xuICAgIC8vICAgdGhpcy4jcHJlbG9hZHMuc2V0KGAvJHtwYXRofWAsIGltcG9ydHMpO1xuICAgIC8vIH1cblxuICAgIGNvbnN0IGNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIFVpbnQ4QXJyYXk+KCk7XG4gICAgY29uc3QgYWJzRGlyVXJsTGVuZ3RoID0gdG9GaWxlVXJsKGFic1dvcmtpbmdEaXIpLmhyZWYubGVuZ3RoO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBidW5kbGUub3V0cHV0RmlsZXMpIHtcbiAgICAgIGNhY2hlLnNldChcbiAgICAgICAgdG9GaWxlVXJsKGZpbGUucGF0aCkuaHJlZi5zdWJzdHJpbmcoYWJzRGlyVXJsTGVuZ3RoKSxcbiAgICAgICAgZmlsZS5jb250ZW50cyxcbiAgICAgICk7XG4gICAgfVxuICAgIHRoaXMuI2NhY2hlID0gY2FjaGU7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBhc3luYyBjYWNoZSgpOiBQcm9taXNlPE1hcDxzdHJpbmcsIFVpbnQ4QXJyYXk+PiB7XG4gICAgaWYgKHRoaXMuI2NhY2hlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuI2NhY2hlID0gdGhpcy5idW5kbGUoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuI2NhY2hlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgYXdhaXQgdGhpcy4jY2FjaGU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLiNjYWNoZSBhcyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PjtcbiAgfVxuXG4gIGFzeW5jIGdldChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPFVpbnQ4QXJyYXkgfCBudWxsPiB7XG4gICAgY29uc3QgY2FjaGUgPSBhd2FpdCB0aGlzLmNhY2hlKCk7XG4gICAgcmV0dXJuIGNhY2hlLmdldChwYXRoKSA/PyBudWxsO1xuICB9XG5cbiAgLy8gZ2V0UHJlbG9hZHMocGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAvLyAgIHJldHVybiB0aGlzLiNwcmVsb2Fkcy5nZXQocGF0aCkgPz8gW107XG4gIC8vIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxnQkFBZ0IsQ0FBQztBQUMxQyxTQUFTLFVBQVUsRUFBRSxPQUFPLEVBQUUsU0FBUyxRQUFRLFdBQVcsQ0FBQztBQUczRCxJQUFJLGlCQUFpQixHQUE0QixLQUFLLEFBQUM7QUFDdkQsZUFBZSx3QkFBd0IsR0FBRztJQUN4QyxJQUFJLGlCQUFpQixLQUFLLEtBQUssRUFBRTtRQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLEtBQUssU0FBUyxFQUFFO1lBQzFCLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7Z0JBQ3JDLE9BQU8sRUFBRSxxREFBcUQ7Z0JBQzlELE1BQU0sRUFBRSxLQUFLO2FBQ2QsQ0FBQyxDQUFDO1NBQ0osTUFB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