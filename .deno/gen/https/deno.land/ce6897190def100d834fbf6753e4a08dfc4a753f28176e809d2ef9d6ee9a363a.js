import { isImportMap, isImports, isScopes, isSpecifierMap, isURL, sortObject } from "./_util.ts";
/* https://wicg.github.io/import-maps/#sort-and-normalize-a-specifier-map */ function sortAndNormalizeSpecifierMap(originalMap, baseURL) {
    const normalized = {};
    for (const [specifierKey, value] of Object.entries(originalMap)){
        const normalizedSpecifierKey = normalizeSpecifierKey(specifierKey, baseURL);
        if (normalizedSpecifierKey === null) continue;
        if (typeof value !== "string") {
            console.warn(`addresses need to be strings.`);
            normalized[normalizedSpecifierKey] = null;
            continue;
        }
        const addressURL = parseUrlLikeImportSpecifier(value, baseURL);
        if (addressURL === null) {
            console.warn(`the address was invalid.`);
            normalized[normalizedSpecifierKey] = null;
            continue;
        }
        if (specifierKey.endsWith("/") && !serializeURL(addressURL).endsWith("/")) {
            console.warn(`an invalid address was given for the specifier key specifierKey; since specifierKey ended in a slash, the address needs to as well.`);
            normalized[normalizedSpecifierKey] = null;
            continue;
        }
        normalized[normalizedSpecifierKey] = serializeURL(addressURL);
    }
    return sortObject(normalized);
}
/* https://url.spec.whatwg.org/#concept-url-serializer */ function serializeURL(url) {
    return url.href;
}
/* https://wicg.github.io/import-maps/#sort-and-normalize-scopes */ function sortAndNormalizeScopes(originalMap, baseURL) {
    const normalized = {};
    for (const [scopePrefix, potentialSpecifierMap] of Object.entries(originalMap)){
        if (!isSpecifierMap(potentialSpecifierMap)) {
            throw new TypeError(`the value of the scope with prefix scopePrefix needs to be an object.`);
        }
        let scopePrefixURL;
        try {
            scopePrefixURL = new URL(scopePrefix, baseURL);
        } catch  {
            console.warn(`the scope prefix URL was not parseable.`);
            continue;
        }
        const normalizedScopePrefix = serializeURL(scopePrefixURL);
        normalized[normalizedScopePrefix] = sortAndNormalizeSpecifierMap(potentialSpecifierMap, baseURL);
    }
    const sorted = {};
    for (const key of Object.keys(normalized)){
        sorted[key] = sortObject(normalized[key]);
    }
    return sortObject(sorted);
}
/* https://wicg.github.io/import-maps/#normalize-a-specifier-key */ function normalizeSpecifierKey(specifierKey, baseURL) {
    if (!specifierKey.length) {
        console.warn("specifier key cannot be an empty string.");
        return null;
    }
    const url = parseUrlLikeImportSpecifier(specifierKey, baseURL);
    if (url !== null) {
        return serializeURL(url);
    }
    return specifierKey;
}
/* https://wicg.github.io/import-maps/#parse-a-url-like-import-specifier */ function parseUrlLikeImportSpecifier(specifier, baseURL) {
    if (baseURL && (specifier.startsWith("/") || specifier.startsWith("./") || specifier.startsWith("../"))) {
        try {
            const url = new URL(specifier, baseURL);
            return url;
        } catch  {
            return null;
        }
    }
    try {
        const url1 = new URL(specifier);
        return url1;
    } catch  {
        return null;
    }
}
const specialSchemes = [
    "ftp",
    "file",
    "http",
    "https",
    "ws",
    "wss", 
];
/* https://url.spec.whatwg.org/#is-special */ function isSpecial(asURL) {
    return specialSchemes.some((scheme)=>serializeURL(asURL).startsWith(scheme));
}
/* https://wicg.github.io/import-maps/#resolve-an-imports-match */ function resolveImportsMatch(normalizedSpecifier, asURL, specifierMap) {
    for (const [specifierKey, resolutionResult] of Object.entries(specifierMap)){
        if (specifierKey === normalizedSpecifier) {
            if (resolutionResult === null) {
                throw new TypeError(`resolution of specifierKey was blocked by a null entry.`);
            }
            if (!isURL(resolutionResult)) {
                throw new TypeError(`resolutionResult must be an URL.`);
            }
            return resolutionResult;
        } else if (specifierKey.endsWith("/") && normalizedSpecifier.startsWith(specifierKey) && (asURL === null || isSpecial(asURL))) {
            if (resolutionResult === null) {
                throw new TypeError(`resolution of specifierKey was blocked by a null entry.`);
            }
            if (!isURL(resolutionResult)) {
                throw new TypeError(`resolutionResult must be an URL.`);
            }
            const afterPrefix = normalizedSpecifier.slice(specifierKey.length);
            if (!resolutionResult.endsWith("/")) {
                throw new TypeError(`resolutionResult does not end with "/"`);
            }
            try {
                const url = new URL(afterPrefix, resolutionResult);
                if (!isURL(url)) {
                    throw new TypeError(`url must be an URL.`);
                }
                if (!serializeURL(url).startsWith(resolutionResult)) {
                    throw new TypeError(`resolution of normalizedSpecifier was blocked due to it backtracking above its prefix specifierKey.`);
                }
                return serializeURL(url);
            } catch  {
                throw new TypeError(`resolution of normalizedSpecifier was blocked since the afterPrefix portion could not be URL-parsed relative to the resolutionResult mapped to by the specifierKey prefix.`);
            }
        }
    }
    return null;
}
/* https://wicg.github.io/import-maps/#parsing */ // do not parse JSON string as done in the specs. That can be done with JSON.parse
export function resolveImportMap(importMap, baseURL) {
    let sortedAndNormalizedImports = {};
    if (!isImportMap(importMap)) {
        throw new TypeError(`the top-level value needs to be a JSON object.`);
    }
    const { imports , scopes  } = importMap;
    if (imports !== undefined) {
        if (!isImports(imports)) {
            throw new TypeError(`"imports" top-level key needs to be an object.`);
        }
        sortedAndNormalizedImports = sortAndNormalizeSpecifierMap(imports, baseURL);
    }
    let sortedAndNormalizedScopes = {};
    if (scopes !== undefined) {
        if (!isScopes(scopes)) {
            throw new TypeError(`"scopes" top-level key needs to be an object.`);
        }
        sortedAndNormalizedScopes = sortAndNormalizeScopes(scopes, baseURL);
    }
    if (Object.keys(importMap).find((key)=>key !== "imports" && key !== "scopes")) {
        console.warn(`an invalid top-level key was present in the import map.`);
    }
    return {
        imports: sortedAndNormalizedImports,
        scopes: sortedAndNormalizedScopes
    };
}
/* https://wicg.github.io/import-maps/#new-resolve-algorithm */ export function resolveModuleSpecifier(specifier, { imports ={} , scopes ={}  }, baseURL) {
    const baseURLString = serializeURL(baseURL);
    const asURL = parseUrlLikeImportSpecifier(specifier, baseURL);
    const normalizedSpecifier = asURL !== null ? serializeURL(asURL) : specifier;
    for (const [scopePrefix, scopeImports] of Object.entries(scopes)){
        if (scopePrefix === baseURLString || scopePrefix.endsWith("/") && baseURLString.startsWith(scopePrefix)) {
            const scopeImportsMatch = resolveImportsMatch(normalizedSpecifier, asURL, scopeImports);
            if (scopeImportsMatch !== null) {
                return scopeImportsMatch;
            }
        }
    }
    const topLevelImportsMatch = resolveImportsMatch(normalizedSpecifier, asURL, imports);
    if (topLevelImportsMatch !== null) {
        return topLevelImportsMatch;
    }
    if (asURL !== null) {
        return serializeURL(asURL);
    }
    throw new TypeError(`specifier was a bare specifier, but was not remapped to anything by importMap.`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvaW1wb3J0bWFwQDAuMi4xL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBJbXBvcnRNYXAsXG4gIGlzSW1wb3J0TWFwLFxuICBpc0ltcG9ydHMsXG4gIGlzU2NvcGVzLFxuICBpc1NwZWNpZmllck1hcCxcbiAgaXNVUkwsXG4gIFNjb3BlcyxcbiAgc29ydE9iamVjdCxcbiAgU3BlY2lmaWVyTWFwLFxufSBmcm9tIFwiLi9fdXRpbC50c1wiO1xuXG5leHBvcnQgdHlwZSB7IEltcG9ydE1hcCwgU2NvcGVzLCBTcGVjaWZpZXJNYXAgfSBmcm9tIFwiLi9fdXRpbC50c1wiO1xuXG4vKiBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNzb3J0LWFuZC1ub3JtYWxpemUtYS1zcGVjaWZpZXItbWFwICovXG5mdW5jdGlvbiBzb3J0QW5kTm9ybWFsaXplU3BlY2lmaWVyTWFwKFxuICBvcmlnaW5hbE1hcDogU3BlY2lmaWVyTWFwLFxuICBiYXNlVVJMOiBVUkwsXG4pOiBTcGVjaWZpZXJNYXAge1xuICBjb25zdCBub3JtYWxpemVkOiBTcGVjaWZpZXJNYXAgPSB7fTtcbiAgZm9yIChjb25zdCBbc3BlY2lmaWVyS2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMob3JpZ2luYWxNYXApKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFNwZWNpZmllcktleSA9IG5vcm1hbGl6ZVNwZWNpZmllcktleShzcGVjaWZpZXJLZXksIGJhc2VVUkwpO1xuICAgIGlmIChub3JtYWxpemVkU3BlY2lmaWVyS2V5ID09PSBudWxsKSBjb250aW51ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zb2xlLndhcm4oYGFkZHJlc3NlcyBuZWVkIHRvIGJlIHN0cmluZ3MuYCk7XG4gICAgICBub3JtYWxpemVkW25vcm1hbGl6ZWRTcGVjaWZpZXJLZXldID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBhZGRyZXNzVVJMID0gcGFyc2VVcmxMaWtlSW1wb3J0U3BlY2lmaWVyKHZhbHVlLCBiYXNlVVJMKTtcblxuICAgIGlmIChhZGRyZXNzVVJMID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYHRoZSBhZGRyZXNzIHdhcyBpbnZhbGlkLmApO1xuICAgICAgbm9ybWFsaXplZFtub3JtYWxpemVkU3BlY2lmaWVyS2V5XSA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHNwZWNpZmllcktleS5lbmRzV2l0aChcIi9cIikgJiYgIXNlcmlhbGl6ZVVSTChhZGRyZXNzVVJMKS5lbmRzV2l0aChcIi9cIikpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgYGFuIGludmFsaWQgYWRkcmVzcyB3YXMgZ2l2ZW4gZm9yIHRoZSBzcGVjaWZpZXIga2V5IHNwZWNpZmllcktleTsgc2luY2Ugc3BlY2lmaWVyS2V5IGVuZGVkIGluIGEgc2xhc2gsIHRoZSBhZGRyZXNzIG5lZWRzIHRvIGFzIHdlbGwuYCxcbiAgICAgICk7XG4gICAgICBub3JtYWxpemVkW25vcm1hbGl6ZWRTcGVjaWZpZXJLZXldID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBub3JtYWxpemVkW25vcm1hbGl6ZWRTcGVjaWZpZXJLZXldID0gc2VyaWFsaXplVVJMKGFkZHJlc3NVUkwpO1xuICB9XG4gIHJldHVybiBzb3J0T2JqZWN0KG5vcm1hbGl6ZWQpIGFzIFNwZWNpZmllck1hcDtcbn1cbi8qIGh0dHBzOi8vdXJsLnNwZWMud2hhdHdnLm9yZy8jY29uY2VwdC11cmwtc2VyaWFsaXplciAqL1xuZnVuY3Rpb24gc2VyaWFsaXplVVJMKHVybDogVVJMKTogc3RyaW5nIHtcbiAgcmV0dXJuIHVybC5ocmVmO1xufVxuLyogaHR0cHM6Ly93aWNnLmdpdGh1Yi5pby9pbXBvcnQtbWFwcy8jc29ydC1hbmQtbm9ybWFsaXplLXNjb3BlcyAqL1xuZnVuY3Rpb24gc29ydEFuZE5vcm1hbGl6ZVNjb3BlcyhcbiAgb3JpZ2luYWxNYXA6IFNjb3BlcyxcbiAgYmFzZVVSTDogVVJMLFxuKTogU2NvcGVzIHtcbiAgY29uc3Qgbm9ybWFsaXplZDogU2NvcGVzID0ge307XG4gIGZvciAoXG4gICAgY29uc3QgW3Njb3BlUHJlZml4LCBwb3RlbnRpYWxTcGVjaWZpZXJNYXBdIG9mIE9iamVjdC5lbnRyaWVzKG9yaWdpbmFsTWFwKVxuICApIHtcbiAgICBpZiAoIWlzU3BlY2lmaWVyTWFwKHBvdGVudGlhbFNwZWNpZmllck1hcCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIGB0aGUgdmFsdWUgb2YgdGhlIHNjb3BlIHdpdGggcHJlZml4IHNjb3BlUHJlZml4IG5lZWRzIHRvIGJlIGFuIG9iamVjdC5gLFxuICAgICAgKTtcbiAgICB9XG4gICAgbGV0IHNjb3BlUHJlZml4VVJMO1xuICAgIHRyeSB7XG4gICAgICBzY29wZVByZWZpeFVSTCA9IG5ldyBVUkwoc2NvcGVQcmVmaXgsIGJhc2VVUkwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc29sZS53YXJuKGB0aGUgc2NvcGUgcHJlZml4IFVSTCB3YXMgbm90IHBhcnNlYWJsZS5gKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBub3JtYWxpemVkU2NvcGVQcmVmaXggPSBzZXJpYWxpemVVUkwoc2NvcGVQcmVmaXhVUkwpO1xuICAgIG5vcm1hbGl6ZWRbbm9ybWFsaXplZFNjb3BlUHJlZml4XSA9IHNvcnRBbmROb3JtYWxpemVTcGVjaWZpZXJNYXAoXG4gICAgICBwb3RlbnRpYWxTcGVjaWZpZXJNYXAsXG4gICAgICBiYXNlVVJMLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBzb3J0ZWQ6IFNjb3BlcyA9IHt9O1xuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhub3JtYWxpemVkKSkge1xuICAgIHNvcnRlZFtrZXldID0gc29ydE9iamVjdChub3JtYWxpemVkW2tleV0pIGFzIFNwZWNpZmllck1hcDtcbiAgfVxuICByZXR1cm4gc29ydE9iamVjdChzb3J0ZWQpIGFzIFNjb3Blcztcbn1cbi8qIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI25vcm1hbGl6ZS1hLXNwZWNpZmllci1rZXkgKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVNwZWNpZmllcktleShcbiAgc3BlY2lmaWVyS2V5OiBzdHJpbmcsXG4gIGJhc2VVUkw6IFVSTCxcbik6IHN0cmluZyB8IG51bGwge1xuICBpZiAoIXNwZWNpZmllcktleS5sZW5ndGgpIHtcbiAgICBjb25zb2xlLndhcm4oXCJzcGVjaWZpZXIga2V5IGNhbm5vdCBiZSBhbiBlbXB0eSBzdHJpbmcuXCIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHVybCA9IHBhcnNlVXJsTGlrZUltcG9ydFNwZWNpZmllcihzcGVjaWZpZXJLZXksIGJhc2VVUkwpO1xuICBpZiAodXJsICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIHNlcmlhbGl6ZVVSTCh1cmwpO1xuICB9XG4gIHJldHVybiBzcGVjaWZpZXJLZXk7XG59XG4vKiBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNwYXJzZS1hLXVybC1saWtlLWltcG9ydC1zcGVjaWZpZXIgKi9cbmZ1bmN0aW9uIHBhcnNlVXJsTGlrZUltcG9ydFNwZWNpZmllcihcbiAgc3BlY2lmaWVyOiBzdHJpbmcsXG4gIGJhc2VVUkw6IFVSTCxcbik6IFVSTCB8IG51bGwge1xuICBpZiAoXG4gICAgYmFzZVVSTCAmJiAoc3BlY2lmaWVyLnN0YXJ0c1dpdGgoXCIvXCIpIHx8XG4gICAgICBzcGVjaWZpZXIuc3RhcnRzV2l0aChcIi4vXCIpIHx8XG4gICAgICBzcGVjaWZpZXIuc3RhcnRzV2l0aChcIi4uL1wiKSlcbiAgKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoc3BlY2lmaWVyLCBiYXNlVVJMKTtcbiAgICAgIHJldHVybiB1cmw7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoc3BlY2lmaWVyKTtcbiAgICByZXR1cm4gdXJsO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5jb25zdCBzcGVjaWFsU2NoZW1lcyA9IFtcbiAgXCJmdHBcIixcbiAgXCJmaWxlXCIsXG4gIFwiaHR0cFwiLFxuICBcImh0dHBzXCIsXG4gIFwid3NcIixcbiAgXCJ3c3NcIixcbl07XG4vKiBodHRwczovL3VybC5zcGVjLndoYXR3Zy5vcmcvI2lzLXNwZWNpYWwgKi9cbmZ1bmN0aW9uIGlzU3BlY2lhbChhc1VSTDogVVJMKTogYm9vbGVhbiB7XG4gIHJldHVybiBzcGVjaWFsU2NoZW1lcy5zb21lKChzY2hlbWUpID0+XG4gICAgc2VyaWFsaXplVVJMKGFzVVJMKS5zdGFydHNXaXRoKHNjaGVtZSlcbiAgKTtcbn1cbi8qIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI3Jlc29sdmUtYW4taW1wb3J0cy1tYXRjaCAqL1xuZnVuY3Rpb24gcmVzb2x2ZUltcG9ydHNNYXRjaChcbiAgbm9ybWFsaXplZFNwZWNpZmllcjogc3RyaW5nLFxuICBhc1VSTDogVVJMIHwgbnVsbCxcbiAgc3BlY2lmaWVyTWFwOiBTcGVjaWZpZXJNYXAsXG4pOiBzdHJpbmcgfCBudWxsIHtcbiAgZm9yIChcbiAgICBjb25zdCBbc3BlY2lmaWVyS2V5LCByZXNvbHV0aW9uUmVzdWx0XSBvZiBPYmplY3QuZW50cmllcyhzcGVjaWZpZXJNYXApXG4gICkge1xuICAgIGlmIChzcGVjaWZpZXJLZXkgPT09IG5vcm1hbGl6ZWRTcGVjaWZpZXIpIHtcbiAgICAgIGlmIChyZXNvbHV0aW9uUmVzdWx0ID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgYHJlc29sdXRpb24gb2Ygc3BlY2lmaWVyS2V5IHdhcyBibG9ja2VkIGJ5IGEgbnVsbCBlbnRyeS5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKCFpc1VSTChyZXNvbHV0aW9uUmVzdWx0KSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGByZXNvbHV0aW9uUmVzdWx0IG11c3QgYmUgYW4gVVJMLmApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc29sdXRpb25SZXN1bHQ7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHNwZWNpZmllcktleS5lbmRzV2l0aChcIi9cIikgJiZcbiAgICAgIG5vcm1hbGl6ZWRTcGVjaWZpZXIuc3RhcnRzV2l0aChzcGVjaWZpZXJLZXkpICYmXG4gICAgICAoYXNVUkwgPT09IG51bGwgfHwgaXNTcGVjaWFsKGFzVVJMKSlcbiAgICApIHtcbiAgICAgIGlmIChyZXNvbHV0aW9uUmVzdWx0ID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgYHJlc29sdXRpb24gb2Ygc3BlY2lmaWVyS2V5IHdhcyBibG9ja2VkIGJ5IGEgbnVsbCBlbnRyeS5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKCFpc1VSTChyZXNvbHV0aW9uUmVzdWx0KSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGByZXNvbHV0aW9uUmVzdWx0IG11c3QgYmUgYW4gVVJMLmApO1xuICAgICAgfVxuICAgICAgY29uc3QgYWZ0ZXJQcmVmaXggPSBub3JtYWxpemVkU3BlY2lmaWVyLnNsaWNlKHNwZWNpZmllcktleS5sZW5ndGgpO1xuXG4gICAgICBpZiAoIXJlc29sdXRpb25SZXN1bHQuZW5kc1dpdGgoXCIvXCIpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYHJlc29sdXRpb25SZXN1bHQgZG9lcyBub3QgZW5kIHdpdGggXCIvXCJgKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChhZnRlclByZWZpeCwgcmVzb2x1dGlvblJlc3VsdCk7XG4gICAgICAgIGlmICghaXNVUkwodXJsKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYHVybCBtdXN0IGJlIGFuIFVSTC5gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXNlcmlhbGl6ZVVSTCh1cmwpLnN0YXJ0c1dpdGgocmVzb2x1dGlvblJlc3VsdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgYHJlc29sdXRpb24gb2Ygbm9ybWFsaXplZFNwZWNpZmllciB3YXMgYmxvY2tlZCBkdWUgdG8gaXQgYmFja3RyYWNraW5nIGFib3ZlIGl0cyBwcmVmaXggc3BlY2lmaWVyS2V5LmAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2VyaWFsaXplVVJMKHVybCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgcmVzb2x1dGlvbiBvZiBub3JtYWxpemVkU3BlY2lmaWVyIHdhcyBibG9ja2VkIHNpbmNlIHRoZSBhZnRlclByZWZpeCBwb3J0aW9uIGNvdWxkIG5vdCBiZSBVUkwtcGFyc2VkIHJlbGF0aXZlIHRvIHRoZSByZXNvbHV0aW9uUmVzdWx0IG1hcHBlZCB0byBieSB0aGUgc3BlY2lmaWVyS2V5IHByZWZpeC5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cbi8qIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI3BhcnNpbmcgKi9cbi8vIGRvIG5vdCBwYXJzZSBKU09OIHN0cmluZyBhcyBkb25lIGluIHRoZSBzcGVjcy4gVGhhdCBjYW4gYmUgZG9uZSB3aXRoIEpTT04ucGFyc2VcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSW1wb3J0TWFwKFxuICBpbXBvcnRNYXA6IEltcG9ydE1hcCxcbiAgYmFzZVVSTDogVVJMLFxuKTogSW1wb3J0TWFwIHtcbiAgbGV0IHNvcnRlZEFuZE5vcm1hbGl6ZWRJbXBvcnRzID0ge307XG4gIGlmICghaXNJbXBvcnRNYXAoaW1wb3J0TWFwKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYHRoZSB0b3AtbGV2ZWwgdmFsdWUgbmVlZHMgdG8gYmUgYSBKU09OIG9iamVjdC5gKTtcbiAgfVxuICBjb25zdCB7IGltcG9ydHMsIHNjb3BlcyB9ID0gaW1wb3J0TWFwO1xuICBpZiAoaW1wb3J0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKCFpc0ltcG9ydHMoaW1wb3J0cykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFwiaW1wb3J0c1wiIHRvcC1sZXZlbCBrZXkgbmVlZHMgdG8gYmUgYW4gb2JqZWN0LmApO1xuICAgIH1cbiAgICBzb3J0ZWRBbmROb3JtYWxpemVkSW1wb3J0cyA9IHNvcnRBbmROb3JtYWxpemVTcGVjaWZpZXJNYXAoXG4gICAgICBpbXBvcnRzLFxuICAgICAgYmFzZVVSTCxcbiAgICApO1xuICB9XG4gIGxldCBzb3J0ZWRBbmROb3JtYWxpemVkU2NvcGVzID0ge307XG4gIGlmIChzY29wZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICghaXNTY29wZXMoc2NvcGVzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgXCJzY29wZXNcIiB0b3AtbGV2ZWwga2V5IG5lZWRzIHRvIGJlIGFuIG9iamVjdC5gKTtcbiAgICB9XG4gICAgc29ydGVkQW5kTm9ybWFsaXplZFNjb3BlcyA9IHNvcnRBbmROb3JtYWxpemVTY29wZXMoXG4gICAgICBzY29wZXMsXG4gICAgICBiYXNlVVJMLFxuICAgICk7XG4gIH1cbiAgaWYgKFxuICAgIE9iamVjdC5rZXlzKGltcG9ydE1hcCkuZmluZCgoa2V5KSA9PiBrZXkgIT09IFwiaW1wb3J0c1wiICYmIGtleSAhPT0gXCJzY29wZXNcIilcbiAgKSB7XG4gICAgY29uc29sZS53YXJuKGBhbiBpbnZhbGlkIHRvcC1sZXZlbCBrZXkgd2FzIHByZXNlbnQgaW4gdGhlIGltcG9ydCBtYXAuYCk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBpbXBvcnRzOiBzb3J0ZWRBbmROb3JtYWxpemVkSW1wb3J0cyxcbiAgICBzY29wZXM6IHNvcnRlZEFuZE5vcm1hbGl6ZWRTY29wZXMsXG4gIH07XG59XG4vKiBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNuZXctcmVzb2x2ZS1hbGdvcml0aG0gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlTW9kdWxlU3BlY2lmaWVyKFxuICBzcGVjaWZpZXI6IHN0cmluZyxcbiAgeyBpbXBvcnRzID0ge30sIHNjb3BlcyA9IHt9IH06IEltcG9ydE1hcCxcbiAgYmFzZVVSTDogVVJMLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgYmFzZVVSTFN0cmluZyA9IHNlcmlhbGl6ZVVSTChiYXNlVVJMKTtcbiAgY29uc3QgYXNVUkwgPSBwYXJzZVVybExpa2VJbXBvcnRTcGVjaWZpZXIoc3BlY2lmaWVyLCBiYXNlVVJMKTtcbiAgY29uc3Qgbm9ybWFsaXplZFNwZWNpZmllciA9IGFzVVJMICE9PSBudWxsID8gc2VyaWFsaXplVVJMKGFzVVJMKSA6IHNwZWNpZmllcjtcbiAgZm9yIChjb25zdCBbc2NvcGVQcmVmaXgsIHNjb3BlSW1wb3J0c10gb2YgT2JqZWN0LmVudHJpZXMoc2NvcGVzKSkge1xuICAgIGlmIChcbiAgICAgIHNjb3BlUHJlZml4ID09PSBiYXNlVVJMU3RyaW5nIHx8XG4gICAgICAoc2NvcGVQcmVmaXguZW5kc1dpdGgoXCIvXCIpICYmIGJhc2VVUkxTdHJpbmcuc3RhcnRzV2l0aChzY29wZVByZWZpeCkpXG4gICAgKSB7XG4gICAgICBjb25zdCBzY29wZUltcG9ydHNNYXRjaCA9IHJlc29sdmVJbXBvcnRzTWF0Y2goXG4gICAgICAgIG5vcm1hbGl6ZWRTcGVjaWZpZXIsXG4gICAgICAgIGFzVVJMLFxuICAgICAgICBzY29wZUltcG9ydHMsXG4gICAgICApO1xuICAgICAgaWYgKHNjb3BlSW1wb3J0c01hdGNoICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBzY29wZUltcG9ydHNNYXRjaDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCB0b3BMZXZlbEltcG9ydHNNYXRjaCA9IHJlc29sdmVJbXBvcnRzTWF0Y2goXG4gICAgbm9ybWFsaXplZFNwZWNpZmllcixcbiAgICBhc1VSTCxcbiAgICBpbXBvcnRzLFxuICApO1xuXG4gIGlmICh0b3BMZXZlbEltcG9ydHNNYXRjaCAhPT0gbnVsbCkge1xuICAgIHJldHVybiB0b3BMZXZlbEltcG9ydHNNYXRjaDtcbiAgfVxuXG4gIGlmIChhc1VSTCAhPT0gbnVsbCkge1xuICAgIHJldHVybiBzZXJpYWxpemVVUkwoYXNVUkwpO1xuICB9XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgYHNwZWNpZmllciB3YXMgYSBiYXJlIHNwZWNpZmllciwgYnV0IHdhcyBub3QgcmVtYXBwZWQgdG8gYW55dGhpbmcgYnkgaW1wb3J0TWFwLmAsXG4gICk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FFRSxXQUFXLEVBQ1gsU0FBUyxFQUNULFFBQVEsRUFDUixjQUFjLEVBQ2QsS0FBSyxFQUVMLFVBQVUsUUFFTCxZQUFZLENBQUM7QUFJcEIsNEVBQTRFLENBQzVFLFNBQVMsNEJBQTRCLENBQ25DLFdBQXlCLEVBQ3pCLE9BQVksRUFDRTtJQUNkLE1BQU0sVUFBVSxHQUFpQixFQUFFLEFBQUM7SUFDcEMsS0FBSyxNQUFNLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUU7UUFDL0QsTUFBTSxzQkFBc0IsR0FBRyxxQkFBcUIsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLEFBQUM7UUFDNUUsSUFBSSxzQkFBc0IsS0FBSyxJQUFJLEVBQUUsU0FBUztRQUM5QyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtZQUM3QixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsNkJBQTZCLENBQUMs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