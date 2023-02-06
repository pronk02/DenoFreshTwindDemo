import { extname, fromFileUrl } from "../deps.ts";
export async function load(url, _options) {
    switch(url.protocol){
        case "http:":
        case "https:":
        case "data:":
            return await loadWithFetch(url);
        case "file:":
            {
                const res = await loadWithReadFile(url);
                res.watchFiles = [
                    fromFileUrl(url.href)
                ];
                return res;
            }
    }
    return null;
}
async function loadWithFetch(specifier) {
    const specifierRaw = specifier.href;
    // TODO(lucacasonato): redirects!
    const resp = await fetch(specifierRaw);
    if (!resp.ok) {
        throw new Error(`Encountered status code ${resp.status} while fetching ${specifierRaw}.`);
    }
    const contentType = resp.headers.get("content-type");
    const loader = mapContentTypeToLoader(new URL(resp.url || specifierRaw), contentType);
    const contents = new Uint8Array(await resp.arrayBuffer());
    return {
        contents,
        loader
    };
}
async function loadWithReadFile(specifier) {
    const path = fromFileUrl(specifier);
    const loader = mapContentTypeToLoader(specifier, null);
    const contents = await Deno.readFile(path);
    return {
        contents,
        loader
    };
}
function mapContentTypeToLoader(specifier, contentType) {
    const mediaType = mapContentType(specifier, contentType);
    switch(mediaType){
        case "JavaScript":
        case "Mjs":
            return "js";
        case "JSX":
            return "jsx";
        case "TypeScript":
        case "Mts":
            return "ts";
        case "TSX":
            return "tsx";
        default:
            throw new Error(`Unhandled media type ${mediaType}. Content type is ${contentType}.`);
    }
}
function mapContentType(specifier, contentType) {
    if (contentType !== null) {
        const contentTypes = contentType.split(";");
        const mediaType = contentTypes[0].toLowerCase();
        switch(mediaType){
            case "application/typescript":
            case "text/typescript":
            case "video/vnd.dlna.mpeg-tts":
            case "video/mp2t":
            case "application/x-typescript":
                return mapJsLikeExtension(specifier, "TypeScript");
            case "application/javascript":
            case "text/javascript":
            case "application/ecmascript":
            case "text/ecmascript":
            case "application/x-javascript":
            case "application/node":
                return mapJsLikeExtension(specifier, "JavaScript");
            case "text/jsx":
                return "JSX";
            case "text/tsx":
                return "TSX";
            case "application/json":
            case "text/json":
                return "Json";
            case "application/wasm":
                return "Wasm";
            case "text/plain":
            case "application/octet-stream":
                return mediaTypeFromSpecifier(specifier);
            default:
                return "Unknown";
        }
    } else {
        return mediaTypeFromSpecifier(specifier);
    }
}
function mapJsLikeExtension(specifier, defaultType) {
    const path = specifier.pathname;
    switch(extname(path)){
        case ".jsx":
            return "JSX";
        case ".mjs":
            return "Mjs";
        case ".cjs":
            return "Cjs";
        case ".tsx":
            return "TSX";
        case ".ts":
            if (path.endsWith(".d.ts")) {
                return "Dts";
            } else {
                return defaultType;
            }
        case ".mts":
            {
                if (path.endsWith(".d.mts")) {
                    return "Dmts";
                } else {
                    return defaultType == "JavaScript" ? "Mjs" : "Mts";
                }
            }
        case ".cts":
            {
                if (path.endsWith(".d.cts")) {
                    return "Dcts";
                } else {
                    return defaultType == "JavaScript" ? "Cjs" : "Cts";
                }
            }
        default:
            return defaultType;
    }
}
function mediaTypeFromSpecifier(specifier) {
    const path = specifier.pathname;
    switch(extname(path)){
        case "":
            if (path.endsWith("/.tsbuildinfo")) {
                return "TsBuildInfo";
            } else {
                return "Unknown";
            }
        case ".ts":
            if (path.endsWith(".d.ts")) {
                return "Dts";
            } else {
                return "TypeScript";
            }
        case ".mts":
            if (path.endsWith(".d.mts")) {
                return "Dmts";
            } else {
                return "Mts";
            }
        case ".cts":
            if (path.endsWith(".d.cts")) {
                return "Dcts";
            } else {
                return "Cts";
            }
        case ".tsx":
            return "TSX";
        case ".js":
            return "JavaScript";
        case ".jsx":
            return "JSX";
        case ".mjs":
            return "Mjs";
        case ".cjs":
            return "Cjs";
        case ".json":
            return "Json";
        case ".wasm":
            return "Wasm";
        case ".tsbuildinfo":
            return "TsBuildInfo";
        case ".map":
            return "SourceMap";
        default:
            return "Unknown";
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvZXNidWlsZF9kZW5vX2xvYWRlckAwLjUuMC9zcmMvcG9ydGFibGVfbG9hZGVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGVzYnVpbGQsIGV4dG5hbWUsIGZyb21GaWxlVXJsIH0gZnJvbSBcIi4uL2RlcHMudHNcIjtcbmltcG9ydCAqIGFzIGRlbm8gZnJvbSBcIi4vZGVuby50c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIExvYWRPcHRpb25zIHtcbiAgaW1wb3J0TWFwVVJMPzogVVJMO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZChcbiAgdXJsOiBVUkwsXG4gIF9vcHRpb25zOiBMb2FkT3B0aW9ucyxcbik6IFByb21pc2U8ZXNidWlsZC5PbkxvYWRSZXN1bHQgfCBudWxsPiB7XG4gIHN3aXRjaCAodXJsLnByb3RvY29sKSB7XG4gICAgY2FzZSBcImh0dHA6XCI6XG4gICAgY2FzZSBcImh0dHBzOlwiOlxuICAgIGNhc2UgXCJkYXRhOlwiOlxuICAgICAgcmV0dXJuIGF3YWl0IGxvYWRXaXRoRmV0Y2godXJsKTtcbiAgICBjYXNlIFwiZmlsZTpcIjoge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgbG9hZFdpdGhSZWFkRmlsZSh1cmwpO1xuICAgICAgcmVzLndhdGNoRmlsZXMgPSBbZnJvbUZpbGVVcmwodXJsLmhyZWYpXTtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkV2l0aEZldGNoKFxuICBzcGVjaWZpZXI6IFVSTCxcbik6IFByb21pc2U8ZXNidWlsZC5PbkxvYWRSZXN1bHQ+IHtcbiAgY29uc3Qgc3BlY2lmaWVyUmF3ID0gc3BlY2lmaWVyLmhyZWY7XG5cbiAgLy8gVE9ETyhsdWNhY2Fzb25hdG8pOiByZWRpcmVjdHMhXG4gIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChzcGVjaWZpZXJSYXcpO1xuICBpZiAoIXJlc3Aub2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRW5jb3VudGVyZWQgc3RhdHVzIGNvZGUgJHtyZXNwLnN0YXR1c30gd2hpbGUgZmV0Y2hpbmcgJHtzcGVjaWZpZXJSYXd9LmAsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnRUeXBlID0gcmVzcC5oZWFkZXJzLmdldChcImNvbnRlbnQtdHlwZVwiKTtcbiAgY29uc3QgbG9hZGVyID0gbWFwQ29udGVudFR5cGVUb0xvYWRlcihcbiAgICBuZXcgVVJMKHJlc3AudXJsIHx8IHNwZWNpZmllclJhdyksXG4gICAgY29udGVudFR5cGUsXG4gICk7XG5cbiAgY29uc3QgY29udGVudHMgPSBuZXcgVWludDhBcnJheShhd2FpdCByZXNwLmFycmF5QnVmZmVyKCkpO1xuXG4gIHJldHVybiB7IGNvbnRlbnRzLCBsb2FkZXIgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZFdpdGhSZWFkRmlsZShzcGVjaWZpZXI6IFVSTCk6IFByb21pc2U8ZXNidWlsZC5PbkxvYWRSZXN1bHQ+IHtcbiAgY29uc3QgcGF0aCA9IGZyb21GaWxlVXJsKHNwZWNpZmllcik7XG5cbiAgY29uc3QgbG9hZGVyID0gbWFwQ29udGVudFR5cGVUb0xvYWRlcihzcGVjaWZpZXIsIG51bGwpO1xuICBjb25zdCBjb250ZW50cyA9IGF3YWl0IERlbm8ucmVhZEZpbGUocGF0aCk7XG5cbiAgcmV0dXJuIHsgY29udGVudHMsIGxvYWRlciB9O1xufVxuXG5mdW5jdGlvbiBtYXBDb250ZW50VHlwZVRvTG9hZGVyKFxuICBzcGVjaWZpZXI6IFVSTCxcbiAgY29udGVudFR5cGU6IHN0cmluZyB8IG51bGwsXG4pOiBlc2J1aWxkLkxvYWRlciB7XG4gIGNvbnN0IG1lZGlhVHlwZSA9IG1hcENvbnRlbnRUeXBlKHNwZWNpZmllciwgY29udGVudFR5cGUpO1xuICBzd2l0Y2ggKG1lZGlhVHlwZSkge1xuICAgIGNhc2UgXCJKYXZhU2NyaXB0XCI6XG4gICAgY2FzZSBcIk1qc1wiOlxuICAgICAgcmV0dXJuIFwianNcIjtcbiAgICBjYXNlIFwiSlNYXCI6XG4gICAgICByZXR1cm4gXCJqc3hcIjtcbiAgICBjYXNlIFwiVHlwZVNjcmlwdFwiOlxuICAgIGNhc2UgXCJNdHNcIjpcbiAgICAgIHJldHVybiBcInRzXCI7XG4gICAgY2FzZSBcIlRTWFwiOlxuICAgICAgcmV0dXJuIFwidHN4XCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFVuaGFuZGxlZCBtZWRpYSB0eXBlICR7bWVkaWFUeXBlfS4gQ29udGVudCB0eXBlIGlzICR7Y29udGVudFR5cGV9LmAsXG4gICAgICApO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hcENvbnRlbnRUeXBlKFxuICBzcGVjaWZpZXI6IFVSTCxcbiAgY29udGVudFR5cGU6IHN0cmluZyB8IG51bGwsXG4pOiBkZW5vLk1lZGlhVHlwZSB7XG4gIGlmIChjb250ZW50VHlwZSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGNvbnRlbnRUeXBlcyA9IGNvbnRlbnRUeXBlLnNwbGl0KFwiO1wiKTtcbiAgICBjb25zdCBtZWRpYVR5cGUgPSBjb250ZW50VHlwZXNbMF0udG9Mb3dlckNhc2UoKTtcbiAgICBzd2l0Y2ggKG1lZGlhVHlwZSkge1xuICAgICAgY2FzZSBcImFwcGxpY2F0aW9uL3R5cGVzY3JpcHRcIjpcbiAgICAgIGNhc2UgXCJ0ZXh0L3R5cGVzY3JpcHRcIjpcbiAgICAgIGNhc2UgXCJ2aWRlby92bmQuZGxuYS5tcGVnLXR0c1wiOlxuICAgICAgY2FzZSBcInZpZGVvL21wMnRcIjpcbiAgICAgIGNhc2UgXCJhcHBsaWNhdGlvbi94LXR5cGVzY3JpcHRcIjpcbiAgICAgICAgcmV0dXJuIG1hcEpzTGlrZUV4dGVuc2lvbihzcGVjaWZpZXIsIFwiVHlwZVNjcmlwdFwiKTtcbiAgICAgIGNhc2UgXCJhcHBsaWNhdGlvbi9qYXZhc2NyaXB0XCI6XG4gICAgICBjYXNlIFwidGV4dC9qYXZhc2NyaXB0XCI6XG4gICAgICBjYXNlIFwiYXBwbGljYXRpb24vZWNtYXNjcmlwdFwiOlxuICAgICAgY2FzZSBcInRleHQvZWNtYXNjcmlwdFwiOlxuICAgICAgY2FzZSBcImFwcGxpY2F0aW9uL3gtamF2YXNjcmlwdFwiOlxuICAgICAgY2FzZSBcImFwcGxpY2F0aW9uL25vZGVcIjpcbiAgICAgICAgcmV0dXJuIG1hcEpzTGlrZUV4dGVuc2lvbihzcGVjaWZpZXIsIFwiSmF2YVNjcmlwdFwiKTtcbiAgICAgIGNhc2UgXCJ0ZXh0L2pzeFwiOlxuICAgICAgICByZXR1cm4gXCJKU1hcIjtcbiAgICAgIGNhc2UgXCJ0ZXh0L3RzeFwiOlxuICAgICAgICByZXR1cm4gXCJUU1hcIjtcbiAgICAgIGNhc2UgXCJhcHBsaWNhdGlvbi9qc29uXCI6XG4gICAgICBjYXNlIFwidGV4dC9qc29uXCI6XG4gICAgICAgIHJldHVybiBcIkpzb25cIjtcbiAgICAgIGNhc2UgXCJhcHBsaWNhdGlvbi93YXNtXCI6XG4gICAgICAgIHJldHVybiBcIldhc21cIjtcbiAgICAgIGNhc2UgXCJ0ZXh0L3BsYWluXCI6XG4gICAgICBjYXNlIFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCI6XG4gICAgICAgIHJldHVybiBtZWRpYVR5cGVGcm9tU3BlY2lmaWVyKHNwZWNpZmllcik7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gXCJVbmtub3duXCI7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBtZWRpYVR5cGVGcm9tU3BlY2lmaWVyKHNwZWNpZmllcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFwSnNMaWtlRXh0ZW5zaW9uKFxuICBzcGVjaWZpZXI6IFVSTCxcbiAgZGVmYXVsdFR5cGU6IGRlbm8uTWVkaWFUeXBlLFxuKTogZGVuby5NZWRpYVR5cGUge1xuICBjb25zdCBwYXRoID0gc3BlY2lmaWVyLnBhdGhuYW1lO1xuICBzd2l0Y2ggKGV4dG5hbWUocGF0aCkpIHtcbiAgICBjYXNlIFwiLmpzeFwiOlxuICAgICAgcmV0dXJuIFwiSlNYXCI7XG4gICAgY2FzZSBcIi5tanNcIjpcbiAgICAgIHJldHVybiBcIk1qc1wiO1xuICAgIGNhc2UgXCIuY2pzXCI6XG4gICAgICByZXR1cm4gXCJDanNcIjtcbiAgICBjYXNlIFwiLnRzeFwiOlxuICAgICAgcmV0dXJuIFwiVFNYXCI7XG4gICAgY2FzZSBcIi50c1wiOlxuICAgICAgaWYgKHBhdGguZW5kc1dpdGgoXCIuZC50c1wiKSkge1xuICAgICAgICByZXR1cm4gXCJEdHNcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBkZWZhdWx0VHlwZTtcbiAgICAgIH1cbiAgICBjYXNlIFwiLm10c1wiOiB7XG4gICAgICBpZiAocGF0aC5lbmRzV2l0aChcIi5kLm10c1wiKSkge1xuICAgICAgICByZXR1cm4gXCJEbXRzXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZGVmYXVsdFR5cGUgPT0gXCJKYXZhU2NyaXB0XCIgPyBcIk1qc1wiIDogXCJNdHNcIjtcbiAgICAgIH1cbiAgICB9XG4gICAgY2FzZSBcIi5jdHNcIjoge1xuICAgICAgaWYgKHBhdGguZW5kc1dpdGgoXCIuZC5jdHNcIikpIHtcbiAgICAgICAgcmV0dXJuIFwiRGN0c1wiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGRlZmF1bHRUeXBlID09IFwiSmF2YVNjcmlwdFwiID8gXCJDanNcIiA6IFwiQ3RzXCI7XG4gICAgICB9XG4gICAgfVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZGVmYXVsdFR5cGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWVkaWFUeXBlRnJvbVNwZWNpZmllcihzcGVjaWZpZXI6IFVSTCk6IGRlbm8uTWVkaWFUeXBlIHtcbiAgY29uc3QgcGF0aCA9IHNwZWNpZmllci5wYXRobmFtZTtcbiAgc3dpdGNoIChleHRuYW1lKHBhdGgpKSB7XG4gICAgY2FzZSBcIlwiOlxuICAgICAgaWYgKHBhdGguZW5kc1dpdGgoXCIvLnRzYnVpbGRpbmZvXCIpKSB7XG4gICAgICAgIHJldHVybiBcIlRzQnVpbGRJbmZvXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gXCJVbmtub3duXCI7XG4gICAgICB9XG4gICAgY2FzZSBcIi50c1wiOlxuICAgICAgaWYgKHBhdGguZW5kc1dpdGgoXCIuZC50c1wiKSkge1xuICAgICAgICByZXR1cm4gXCJEdHNcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBcIlR5cGVTY3JpcHRcIjtcbiAgICAgIH1cbiAgICBjYXNlIFwiLm10c1wiOlxuICAgICAgaWYgKHBhdGguZW5kc1dpdGgoXCIuZC5tdHNcIikpIHtcbiAgICAgICAgcmV0dXJuIFwiRG10c1wiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFwiTXRzXCI7XG4gICAgICB9XG4gICAgY2FzZSBcIi5jdHNcIjpcbiAgICAgIGlmIChwYXRoLmVuZHNXaXRoKFwiLmQuY3RzXCIpKSB7XG4gICAgICAgIHJldHVybiBcIkRjdHNcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBcIkN0c1wiO1xuICAgICAgfVxuICAgIGNhc2UgXCIudHN4XCI6XG4gICAgICByZXR1cm4gXCJUU1hcIjtcbiAgICBjYXNlIFwiLmpzXCI6XG4gICAgICByZXR1cm4gXCJKYXZhU2NyaXB0XCI7XG4gICAgY2FzZSBcIi5qc3hcIjpcbiAgICAgIHJldHVybiBcIkpTWFwiO1xuICAgIGNhc2UgXCIubWpzXCI6XG4gICAgICByZXR1cm4gXCJNanNcIjtcbiAgICBjYXNlIFwiLmNqc1wiOlxuICAgICAgcmV0dXJuIFwiQ2pzXCI7XG4gICAgY2FzZSBcIi5qc29uXCI6XG4gICAgICByZXR1cm4gXCJKc29uXCI7XG4gICAgY2FzZSBcIi53YXNtXCI6XG4gICAgICByZXR1cm4gXCJXYXNtXCI7XG4gICAgY2FzZSBcIi50c2J1aWxkaW5mb1wiOlxuICAgICAgcmV0dXJuIFwiVHNCdWlsZEluZm9cIjtcbiAgICBjYXNlIFwiLm1hcFwiOlxuICAgICAgcmV0dXJuIFwiU291cmNlTWFwXCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBcIlVua25vd25cIjtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQWtCLE9BQU8sRUFBRSxXQUFXLFFBQVEsWUFBWSxDQUFDO0FBTzNELE9BQU8sZUFBZSxJQUFJLENBQ3hCLEdBQVEsRUFDUixRQUFxQixFQUNpQjtJQUN0QyxPQUFRLEdBQUcsQ0FBQyxRQUFRO1FBQ2xCLEtBQUssT0FBTyxDQUFDO1FBQ2IsS0FBSyxRQUFRLENBQUM7UUFDZCxLQUFLLE9BQU87WUFDVixPQUFPLE1BQU0sYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLEtBQUssT0FBTztZQUFFO2dCQUNaLE1BQU0sR0FBRyxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEFBQUM7Z0JBQ3hDLEdBQUcsQ0FBQyxVQUFVLEdBQUc7b0JBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7aUJBQUMsQ0FBQztnQkFDekMsT0FBTyxHQUFHLENBQUM7YUFDWjtLQUNGO0lBQ0QsT0FBTyxJQUFJLENBQUM7Q0FDYjtBQUVELGVBQWUsYUFBYSxDQUMxQixTQUFjLEVBQ2lCO0lBQy9CLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEFBQUM7SUFFcEMsaUNBQWlDO0lBQ2pDLE1BQU0sSUFBSSxHQUFHLE1BQU0sS0FBSyxDQUFDLFlBQVksQ0FBQyxBQUFDO0lBQ3ZDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFO1FBQ1osTUFBTSxJQUFJLEtBQUssQ0FDYixDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUN6RSxDQUFDO0tBQ0g7SUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQUFBQztJQUNyRCxNQUFNLE1BQU0sR0FBRyxzQkFBc0IsQ0FDbkMsSUFBSSxHQUFHLENB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