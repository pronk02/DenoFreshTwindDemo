// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { isWindows, osType } from "../_util/os.ts";
import { SEP, SEP_PATTERN } from "./separator.ts";
import * as _win32 from "./win32.ts";
import * as _posix from "./posix.ts";
const path = isWindows ? _win32 : _posix;
const { join , normalize  } = path;
// deno-fmt-ignore
const regExpEscapeChars = [
    "!",
    "$",
    "(",
    ")",
    "*",
    "+",
    ".",
    "=",
    "?",
    "[",
    "\\",
    "^",
    "{",
    "|"
];
const rangeEscapeChars = [
    "-",
    "\\",
    "]"
];
/** Convert a glob string to a regular expression.
 *
 * Tries to match bash glob expansion as closely as possible.
 *
 * Basic glob syntax:
 * - `*` - Matches everything without leaving the path segment.
 * - `?` - Matches any single character.
 * - `{foo,bar}` - Matches `foo` or `bar`.
 * - `[abcd]` - Matches `a`, `b`, `c` or `d`.
 * - `[a-d]` - Matches `a`, `b`, `c` or `d`.
 * - `[!abcd]` - Matches any single character besides `a`, `b`, `c` or `d`.
 * - `[[:<class>:]]` - Matches any character belonging to `<class>`.
 *     - `[[:alnum:]]` - Matches any digit or letter.
 *     - `[[:digit:]abc]` - Matches any digit, `a`, `b` or `c`.
 *     - See https://facelessuser.github.io/wcmatch/glob/#posix-character-classes
 *       for a complete list of supported character classes.
 * - `\` - Escapes the next character for an `os` other than `"windows"`.
 * - \` - Escapes the next character for `os` set to `"windows"`.
 * - `/` - Path separator.
 * - `\` - Additional path separator only for `os` set to `"windows"`.
 *
 * Extended syntax:
 * - Requires `{ extended: true }`.
 * - `?(foo|bar)` - Matches 0 or 1 instance of `{foo,bar}`.
 * - `@(foo|bar)` - Matches 1 instance of `{foo,bar}`. They behave the same.
 * - `*(foo|bar)` - Matches _n_ instances of `{foo,bar}`.
 * - `+(foo|bar)` - Matches _n > 0_ instances of `{foo,bar}`.
 * - `!(foo|bar)` - Matches anything other than `{foo,bar}`.
 * - See https://www.linuxjournal.com/content/bash-extended-globbing.
 *
 * Globstar syntax:
 * - Requires `{ globstar: true }`.
 * - `**` - Matches any number of any path segments.
 *     - Must comprise its entire path segment in the provided glob.
 * - See https://www.linuxjournal.com/content/globstar-new-bash-globbing-option.
 *
 * Note the following properties:
 * - The generated `RegExp` is anchored at both start and end.
 * - Repeating and trailing separators are tolerated. Trailing separators in the
 *   provided glob have no meaning and are discarded.
 * - Absolute globs will only match absolute paths, etc.
 * - Empty globs will match nothing.
 * - Any special glob syntax must be contained to one path segment. For example,
 *   `?(foo|bar/baz)` is invalid. The separator will take precedence and the
 *   first segment ends with an unclosed group.
 * - If a path segment ends with unclosed groups or a dangling escape prefix, a
 *   parse error has occurred. Every character for that segment is taken
 *   literally in this event.
 *
 * Limitations:
 * - A negative group like `!(foo|bar)` will wrongly be converted to a negative
 *   look-ahead followed by a wildcard. This means that `!(foo).js` will wrongly
 *   fail to match `foobar.js`, even though `foobar` is not `foo`. Effectively,
 *   `!(foo|bar)` is treated like `!(@(foo|bar)*)`. This will work correctly if
 *   the group occurs not nested at the end of the segment. */ export function globToRegExp(glob, { extended =true , globstar: globstarOption = true , os =osType , caseInsensitive =false  } = {}) {
    if (glob == "") {
        return /(?!)/;
    }
    const sep = os == "windows" ? "(?:\\\\|/)+" : "/+";
    const sepMaybe = os == "windows" ? "(?:\\\\|/)*" : "/*";
    const seps = os == "windows" ? [
        "\\",
        "/"
    ] : [
        "/"
    ];
    const globstar = os == "windows" ? "(?:[^\\\\/]*(?:\\\\|/|$)+)*" : "(?:[^/]*(?:/|$)+)*";
    const wildcard = os == "windows" ? "[^\\\\/]*" : "[^/]*";
    const escapePrefix = os == "windows" ? "`" : "\\";
    // Remove trailing separators.
    let newLength = glob.length;
    for(; newLength > 1 && seps.includes(glob[newLength - 1]); newLength--);
    glob = glob.slice(0, newLength);
    let regExpString = "";
    // Terminates correctly. Trust that `j` is incremented every iteration.
    for(let j = 0; j < glob.length;){
        let segment = "";
        const groupStack = [];
        let inRange = false;
        let inEscape = false;
        let endsWithSep = false;
        let i = j;
        // Terminates with `i` at the non-inclusive end of the current segment.
        for(; i < glob.length && !seps.includes(glob[i]); i++){
            if (inEscape) {
                inEscape = false;
                const escapeChars = inRange ? rangeEscapeChars : regExpEscapeChars;
                segment += escapeChars.includes(glob[i]) ? `\\${glob[i]}` : glob[i];
                continue;
            }
            if (glob[i] == escapePrefix) {
                inEscape = true;
                continue;
            }
            if (glob[i] == "[") {
                if (!inRange) {
                    inRange = true;
                    segment += "[";
                    if (glob[i + 1] == "!") {
                        i++;
                        segment += "^";
                    } else if (glob[i + 1] == "^") {
                        i++;
                        segment += "\\^";
                    }
                    continue;
                } else if (glob[i + 1] == ":") {
                    let k = i + 1;
                    let value = "";
                    while(glob[k + 1] != null && glob[k + 1] != ":"){
                        value += glob[k + 1];
                        k++;
                    }
                    if (glob[k + 1] == ":" && glob[k + 2] == "]") {
                        i = k + 2;
                        if (value == "alnum") segment += "\\dA-Za-z";
                        else if (value == "alpha") segment += "A-Za-z";
                        else if (value == "ascii") segment += "\x00-\x7F";
                        else if (value == "blank") segment += "\t ";
                        else if (value == "cntrl") segment += "\x00-\x1F\x7F";
                        else if (value == "digit") segment += "\\d";
                        else if (value == "graph") segment += "\x21-\x7E";
                        else if (value == "lower") segment += "a-z";
                        else if (value == "print") segment += "\x20-\x7E";
                        else if (value == "punct") {
                            segment += "!\"#$%&'()*+,\\-./:;<=>?@[\\\\\\]^_‘{|}~";
                        } else if (value == "space") segment += "\\s\v";
                        else if (value == "upper") segment += "A-Z";
                        else if (value == "word") segment += "\\w";
                        else if (value == "xdigit") segment += "\\dA-Fa-f";
                        continue;
                    }
                }
            }
            if (glob[i] == "]" && inRange) {
                inRange = false;
                segment += "]";
                continue;
            }
            if (inRange) {
                if (glob[i] == "\\") {
                    segment += `\\\\`;
                } else {
                    segment += glob[i];
                }
                continue;
            }
            if (glob[i] == ")" && groupStack.length > 0 && groupStack[groupStack.length - 1] != "BRACE") {
                segment += ")";
                const type = groupStack.pop();
                if (type == "!") {
                    segment += wildcard;
                } else if (type != "@") {
                    segment += type;
                }
                continue;
            }
            if (glob[i] == "|" && groupStack.length > 0 && groupStack[groupStack.length - 1] != "BRACE") {
                segment += "|";
                continue;
            }
            if (glob[i] == "+" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("+");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "@" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("@");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "?") {
                if (extended && glob[i + 1] == "(") {
                    i++;
                    groupStack.push("?");
                    segment += "(?:";
                } else {
                    segment += ".";
                }
                continue;
            }
            if (glob[i] == "!" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("!");
                segment += "(?!";
                continue;
            }
            if (glob[i] == "{") {
                groupStack.push("BRACE");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "}" && groupStack[groupStack.length - 1] == "BRACE") {
                groupStack.pop();
                segment += ")";
                continue;
            }
            if (glob[i] == "," && groupStack[groupStack.length - 1] == "BRACE") {
                segment += "|";
                continue;
            }
            if (glob[i] == "*") {
                if (extended && glob[i + 1] == "(") {
                    i++;
                    groupStack.push("*");
                    segment += "(?:";
                } else {
                    const prevChar = glob[i - 1];
                    let numStars = 1;
                    while(glob[i + 1] == "*"){
                        i++;
                        numStars++;
                    }
                    const nextChar = glob[i + 1];
                    if (globstarOption && numStars == 2 && [
                        ...seps,
                        undefined
                    ].includes(prevChar) && [
                        ...seps,
                        undefined
                    ].includes(nextChar)) {
                        segment += globstar;
                        endsWithSep = true;
                    } else {
                        segment += wildcard;
                    }
                }
                continue;
            }
            segment += regExpEscapeChars.includes(glob[i]) ? `\\${glob[i]}` : glob[i];
        }
        // Check for unclosed groups or a dangling backslash.
        if (groupStack.length > 0 || inRange || inEscape) {
            // Parse failure. Take all characters from this segment literally.
            segment = "";
            for (const c of glob.slice(j, i)){
                segment += regExpEscapeChars.includes(c) ? `\\${c}` : c;
                endsWithSep = false;
            }
        }
        regExpString += segment;
        if (!endsWithSep) {
            regExpString += i < glob.length ? sep : sepMaybe;
            endsWithSep = true;
        }
        // Terminates with `i` at the start of the next segment.
        while(seps.includes(glob[i]))i++;
        // Check that the next value of `j` is indeed higher than the current value.
        if (!(i > j)) {
            throw new Error("Assertion failure: i > j (potential infinite loop)");
        }
        j = i;
    }
    regExpString = `^${regExpString}$`;
    return new RegExp(regExpString, caseInsensitive ? "i" : "");
}
/** Test whether the given string is a glob */ export function isGlob(str) {
    const chars = {
        "{": "}",
        "(": ")",
        "[": "]"
    };
    const regex = /\\(.)|(^!|\*|\?|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
    if (str === "") {
        return false;
    }
    let match;
    while(match = regex.exec(str)){
        if (match[2]) return true;
        let idx = match.index + match[0].length;
        // if an open bracket/brace/paren is escaped,
        // set the index to the next closing character
        const open = match[1];
        const close = open ? chars[open] : null;
        if (open && close) {
            const n = str.indexOf(close, idx);
            if (n !== -1) {
                idx = n + 1;
            }
        }
        str = str.slice(idx);
    }
    return false;
}
/** Like normalize(), but doesn't collapse "**\/.." when `globstar` is true. */ export function normalizeGlob(glob, { globstar =false  } = {}) {
    if (glob.match(/\0/g)) {
        throw new Error(`Glob contains invalid characters: "${glob}"`);
    }
    if (!globstar) {
        return normalize(glob);
    }
    const s = SEP_PATTERN.source;
    const badParentPattern = new RegExp(`(?<=(${s}|^)\\*\\*${s})\\.\\.(?=${s}|$)`, "g");
    return normalize(glob.replace(badParentPattern, "\0")).replace(/\0/g, "..");
}
/** Like join(), but doesn't collapse "**\/.." when `globstar` is true. */ export function joinGlobs(globs, { extended =false , globstar =false  } = {}) {
    if (!globstar || globs.length == 0) {
        return join(...globs);
    }
    if (globs.length === 0) return ".";
    let joined;
    for (const glob of globs){
        const path = glob;
        if (path.length > 0) {
            if (!joined) joined = path;
            else joined += `${SEP}${path}`;
        }
    }
    if (!joined) return ".";
    return normalizeGlob(joined, {
        extended,
        globstar
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEwNy4wL3BhdGgvZ2xvYi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIxIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5pbXBvcnQgeyBpc1dpbmRvd3MsIG9zVHlwZSB9IGZyb20gXCIuLi9fdXRpbC9vcy50c1wiO1xuaW1wb3J0IHsgU0VQLCBTRVBfUEFUVEVSTiB9IGZyb20gXCIuL3NlcGFyYXRvci50c1wiO1xuaW1wb3J0ICogYXMgX3dpbjMyIGZyb20gXCIuL3dpbjMyLnRzXCI7XG5pbXBvcnQgKiBhcyBfcG9zaXggZnJvbSBcIi4vcG9zaXgudHNcIjtcbmltcG9ydCB0eXBlIHsgT1NUeXBlIH0gZnJvbSBcIi4uL191dGlsL29zLnRzXCI7XG5cbmNvbnN0IHBhdGggPSBpc1dpbmRvd3MgPyBfd2luMzIgOiBfcG9zaXg7XG5jb25zdCB7IGpvaW4sIG5vcm1hbGl6ZSB9ID0gcGF0aDtcblxuZXhwb3J0IGludGVyZmFjZSBHbG9iT3B0aW9ucyB7XG4gIC8qKiBFeHRlbmRlZCBnbG9iIHN5bnRheC5cbiAgICogU2VlIGh0dHBzOi8vd3d3LmxpbnV4am91cm5hbC5jb20vY29udGVudC9iYXNoLWV4dGVuZGVkLWdsb2JiaW5nLiBEZWZhdWx0c1xuICAgKiB0byB0cnVlLiAqL1xuICBleHRlbmRlZD86IGJvb2xlYW47XG4gIC8qKiBHbG9ic3RhciBzeW50YXguXG4gICAqIFNlZSBodHRwczovL3d3dy5saW51eGpvdXJuYWwuY29tL2NvbnRlbnQvZ2xvYnN0YXItbmV3LWJhc2gtZ2xvYmJpbmctb3B0aW9uLlxuICAgKiBJZiBmYWxzZSwgYCoqYCBpcyB0cmVhdGVkIGxpa2UgYCpgLiBEZWZhdWx0cyB0byB0cnVlLiAqL1xuICBnbG9ic3Rhcj86IGJvb2xlYW47XG4gIC8qKiBXaGV0aGVyIGdsb2JzdGFyIHNob3VsZCBiZSBjYXNlIGluc2Vuc2l0aXZlLiAqL1xuICBjYXNlSW5zZW5zaXRpdmU/OiBib29sZWFuO1xuICAvKiogT3BlcmF0aW5nIHN5c3RlbS4gRGVmYXVsdHMgdG8gdGhlIG5hdGl2ZSBPUy4gKi9cbiAgb3M/OiBPU1R5cGU7XG59XG5cbmV4cG9ydCB0eXBlIEdsb2JUb1JlZ0V4cE9wdGlvbnMgPSBHbG9iT3B0aW9ucztcblxuLy8gZGVuby1mbXQtaWdub3JlXG5jb25zdCByZWdFeHBFc2NhcGVDaGFycyA9IFtcIiFcIiwgXCIkXCIsIFwiKFwiLCBcIilcIiwgXCIqXCIsIFwiK1wiLCBcIi5cIiwgXCI9XCIsIFwiP1wiLCBcIltcIiwgXCJcXFxcXCIsIFwiXlwiLCBcIntcIiwgXCJ8XCJdO1xuY29uc3QgcmFuZ2VFc2NhcGVDaGFycyA9IFtcIi1cIiwgXCJcXFxcXCIsIFwiXVwiXTtcblxuLyoqIENvbnZlcnQgYSBnbG9iIHN0cmluZyB0byBhIHJlZ3VsYXIgZXhwcmVzc2lvbi5cbiAqXG4gKiBUcmllcyB0byBtYXRjaCBiYXNoIGdsb2IgZXhwYW5zaW9uIGFzIGNsb3NlbHkgYXMgcG9zc2libGUuXG4gKlxuICogQmFzaWMgZ2xvYiBzeW50YXg6XG4gKiAtIGAqYCAtIE1hdGNoZXMgZXZlcnl0aGluZyB3aXRob3V0IGxlYXZpbmcgdGhlIHBhdGggc2VnbWVudC5cbiAqIC0gYD9gIC0gTWF0Y2hlcyBhbnkgc2luZ2xlIGNoYXJhY3Rlci5cbiAqIC0gYHtmb28sYmFyfWAgLSBNYXRjaGVzIGBmb29gIG9yIGBiYXJgLlxuICogLSBgW2FiY2RdYCAtIE1hdGNoZXMgYGFgLCBgYmAsIGBjYCBvciBgZGAuXG4gKiAtIGBbYS1kXWAgLSBNYXRjaGVzIGBhYCwgYGJgLCBgY2Agb3IgYGRgLlxuICogLSBgWyFhYmNkXWAgLSBNYXRjaGVzIGFueSBzaW5nbGUgY2hhcmFjdGVyIGJlc2lkZXMgYGFgLCBgYmAsIGBjYCBvciBgZGAuXG4gKiAtIGBbWzo8Y2xhc3M+Ol1dYCAtIE1hdGNoZXMgYW55IGNoYXJhY3RlciBiZWxvbmdpbmcgdG8gYDxjbGFzcz5gLlxuICogICAgIC0gYFtbOmFsbnVtOl1dYCAtIE1hdGNoZXMgYW55IGRpZ2l0IG9yIGxldHRlci5cbiAqICAgICAtIGBbWzpkaWdpdDpdYWJjXWAgLSBNYXRjaGVzIGFueSBkaWdpdCwgYGFgLCBgYmAgb3IgYGNgLlxuICogICAgIC0gU2VlIGh0dHBzOi8vZmFjZWxlc3N1c2VyLmdpdGh1Yi5pby93Y21hdGNoL2dsb2IvI3Bvc2l4LWNoYXJhY3Rlci1jbGFzc2VzXG4gKiAgICAgICBmb3IgYSBjb21wbGV0ZSBsaXN0IG9mIHN1cHBvcnRlZCBjaGFyYWN0ZXIgY2xhc3Nlcy5cbiAqIC0gYFxcYCAtIEVzY2FwZXMgdGhlIG5leHQgY2hhcmFjdGVyIGZvciBhbiBgb3NgIG90aGVyIHRoYW4gYFwid2luZG93c1wiYC5cbiAqIC0gXFxgIC0gRXNjYXBlcyB0aGUgbmV4dCBjaGFyYWN0ZXIgZm9yIGBvc2Agc2V0IHRvIGBcIndpbmRvd3NcImAuXG4gKiAtIGAvYCAtIFBhdGggc2VwYXJhdG9yLlxuICogLSBgXFxgIC0gQWRkaXRpb25hbCBwYXRoIHNlcGFyYXRvciBvbmx5IGZvciBgb3NgIHNldCB0byBgXCJ3aW5kb3dzXCJgLlxuICpcbiAqIEV4dGVuZGVkIHN5bnRheDpcbiAqIC0gUmVxdWlyZXMgYHsgZXh0ZW5kZWQ6IHRydWUgfWAuXG4gKiAtIGA/KGZvb3xiYXIpYCAtIE1hdGNoZXMgMCBvciAxIGluc3RhbmNlIG9mIGB7Zm9vLGJhcn1gLlxuICogLSBgQChmb298YmFyKWAgLSBNYXRjaGVzIDEgaW5zdGFuY2Ugb2YgYHtmb28sYmFyfWAuIFRoZXkgYmVoYXZlIHRoZSBzYW1lLlxuICogLSBgKihmb298YmFyKWAgLSBNYXRjaGVzIF9uXyBpbnN0YW5jZXMgb2YgYHtmb28sYmFyfWAuXG4gKiAtIGArKGZvb3xiYXIpYCAtIE1hdGNoZXMgX24gPiAwXyBpbnN0YW5jZXMgb2YgYHtmb28sYmFyfWAuXG4gKiAtIGAhKGZvb3xiYXIpYCAtIE1hdGNoZXMgYW55dGhpbmcgb3RoZXIgdGhhbiBge2ZvbyxiYXJ9YC5cbiAqIC0gU2VlIGh0dHBzOi8vd3d3LmxpbnV4am91cm5hbC5jb20vY29udGVudC9iYXNoLWV4dGVuZGVkLWdsb2JiaW5nLlxuICpcbiAqIEdsb2JzdGFyIHN5bnRheDpcbiAqIC0gUmVxdWlyZXMgYHsgZ2xvYnN0YXI6IHRydWUgfWAuXG4gKiAtIGAqKmAgLSBNYXRjaGVzIGFueSBudW1iZXIgb2YgYW55IHBhdGggc2VnbWVudHMuXG4gKiAgICAgLSBNdXN0IGNvbXByaXNlIGl0cyBlbnRpcmUgcGF0aCBzZWdtZW50IGluIHRoZSBwcm92aWRlZCBnbG9iLlxuICogLSBTZWUgaHR0cHM6Ly93d3cubGludXhqb3VybmFsLmNvbS9jb250ZW50L2dsb2JzdGFyLW5ldy1iYXNoLWdsb2JiaW5nLW9wdGlvbi5cbiAqXG4gKiBOb3RlIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAqIC0gVGhlIGdlbmVyYXRlZCBgUmVnRXhwYCBpcyBhbmNob3JlZCBhdCBib3RoIHN0YXJ0IGFuZCBlbmQuXG4gKiAtIFJlcGVhdGluZyBhbmQgdHJhaWxpbmcgc2VwYXJhdG9ycyBhcmUgdG9sZXJhdGVkLiBUcmFpbGluZyBzZXBhcmF0b3JzIGluIHRoZVxuICogICBwcm92aWRlZCBnbG9iIGhhdmUgbm8gbWVhbmluZyBhbmQgYXJlIGRpc2NhcmRlZC5cbiAqIC0gQWJzb2x1dGUgZ2xvYnMgd2lsbCBvbmx5IG1hdGNoIGFic29sdXRlIHBhdGhzLCBldGMuXG4gKiAtIEVtcHR5IGdsb2JzIHdpbGwgbWF0Y2ggbm90aGluZy5cbiAqIC0gQW55IHNwZWNpYWwgZ2xvYiBzeW50YXggbXVzdCBiZSBjb250YWluZWQgdG8gb25lIHBhdGggc2VnbWVudC4gRm9yIGV4YW1wbGUsXG4gKiAgIGA/KGZvb3xiYXIvYmF6KWAgaXMgaW52YWxpZC4gVGhlIHNlcGFyYXRvciB3aWxsIHRha2UgcHJlY2VkZW5jZSBhbmQgdGhlXG4gKiAgIGZpcnN0IHNlZ21lbnQgZW5kcyB3aXRoIGFuIHVuY2xvc2VkIGdyb3VwLlxuICogLSBJZiBhIHBhdGggc2VnbWVudCBlbmRzIHdpdGggdW5jbG9zZWQgZ3JvdXBzIG9yIGEgZGFuZ2xpbmcgZXNjYXBlIHByZWZpeCwgYVxuICogICBwYXJzZSBlcnJvciBoYXMgb2NjdXJyZWQuIEV2ZXJ5IGNoYXJhY3RlciBmb3IgdGhhdCBzZWdtZW50IGlzIHRha2VuXG4gKiAgIGxpdGVyYWxseSBpbiB0aGlzIGV2ZW50LlxuICpcbiAqIExpbWl0YXRpb25zOlxuICogLSBBIG5lZ2F0aXZlIGdyb3VwIGxpa2UgYCEoZm9vfGJhcilgIHdpbGwgd3JvbmdseSBiZSBjb252ZXJ0ZWQgdG8gYSBuZWdhdGl2ZVxuICogICBsb29rLWFoZWFkIGZvbGxvd2VkIGJ5IGEgd2lsZGNhcmQuIFRoaXMgbWVhbnMgdGhhdCBgIShmb28pLmpzYCB3aWxsIHdyb25nbHlcbiAqICAgZmFpbCB0byBtYXRjaCBgZm9vYmFyLmpzYCwgZXZlbiB0aG91Z2ggYGZvb2JhcmAgaXMgbm90IGBmb29gLiBFZmZlY3RpdmVseSxcbiAqICAgYCEoZm9vfGJhcilgIGlzIHRyZWF0ZWQgbGlrZSBgIShAKGZvb3xiYXIpKilgLiBUaGlzIHdpbGwgd29yayBjb3JyZWN0bHkgaWZcbiAqICAgdGhlIGdyb3VwIG9jY3VycyBub3QgbmVzdGVkIGF0IHRoZSBlbmQgb2YgdGhlIHNlZ21lbnQuICovXG5leHBvcnQgZnVuY3Rpb24gZ2xvYlRvUmVnRXhwKFxuICBnbG9iOiBzdHJpbmcsXG4gIHtcbiAgICBleHRlbmRlZCA9IHRydWUsXG4gICAgZ2xvYnN0YXI6IGdsb2JzdGFyT3B0aW9uID0gdHJ1ZSxcbiAgICBvcyA9IG9zVHlwZSxcbiAgICBjYXNlSW5zZW5zaXRpdmUgPSBmYWxzZSxcbiAgfTogR2xvYlRvUmVnRXhwT3B0aW9ucyA9IHt9LFxuKTogUmVnRXhwIHtcbiAgaWYgKGdsb2IgPT0gXCJcIikge1xuICAgIHJldHVybiAvKD8hKS87XG4gIH1cblxuICBjb25zdCBzZXAgPSBvcyA9PSBcIndpbmRvd3NcIiA/IFwiKD86XFxcXFxcXFx8LykrXCIgOiBcIi8rXCI7XG4gIGNvbnN0IHNlcE1heWJlID0gb3MgPT0gXCJ3aW5kb3dzXCIgPyBcIig/OlxcXFxcXFxcfC8pKlwiIDogXCIvKlwiO1xuICBjb25zdCBzZXBzID0gb3MgPT0gXCJ3aW5kb3dzXCIgPyBbXCJcXFxcXCIsIFwiL1wiXSA6IFtcIi9cIl07XG4gIGNvbnN0IGdsb2JzdGFyID0gb3MgPT0gXCJ3aW5kb3dzXCJcbiAgICA/IFwiKD86W15cXFxcXFxcXC9dKig/OlxcXFxcXFxcfC98JCkrKSpcIlxuICAgIDogXCIoPzpbXi9dKig/Oi98JCkrKSpcIjtcbiAgY29uc3Qgd2lsZGNhcmQgPSBvcyA9PSBcIndpbmRvd3NcIiA/IFwiW15cXFxcXFxcXC9dKlwiIDogXCJbXi9dKlwiO1xuICBjb25zdCBlc2NhcGVQcmVmaXggPSBvcyA9PSBcIndpbmRvd3NcIiA/IFwiYFwiIDogXCJcXFxcXCI7XG5cbiAgLy8gUmVtb3ZlIHRyYWlsaW5nIHNlcGFyYXRvcnMuXG4gIGxldCBuZXdMZW5ndGggPSBnbG9iLmxlbmd0aDtcbiAgZm9yICg7IG5ld0xlbmd0aCA+IDEgJiYgc2Vwcy5pbmNsdWRlcyhnbG9iW25ld0xlbmd0aCAtIDFdKTsgbmV3TGVuZ3RoLS0pO1xuICBnbG9iID0gZ2xvYi5zbGljZSgwLCBuZXdMZW5ndGgpO1xuXG4gIGxldCByZWdFeHBTdHJpbmcgPSBcIlwiO1xuXG4gIC8vIFRlcm1pbmF0ZXMgY29ycmVjdGx5LiBUcnVzdCB0aGF0IGBqYCBpcyBpbmNyZW1lbnRlZCBldmVyeSBpdGVyYXRpb24uXG4gIGZvciAobGV0IGogPSAwOyBqIDwgZ2xvYi5sZW5ndGg7KSB7XG4gICAgbGV0IHNlZ21lbnQgPSBcIlwiO1xuICAgIGNvbnN0IGdyb3VwU3RhY2s6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGluUmFuZ2UgPSBmYWxzZTtcbiAgICBsZXQgaW5Fc2NhcGUgPSBmYWxzZTtcbiAgICBsZXQgZW5kc1dpdGhTZXAgPSBmYWxzZTtcbiAgICBsZXQgaSA9IGo7XG5cbiAgICAvLyBUZXJtaW5hdGVzIHdpdGggYGlgIGF0IHRoZSBub24taW5jbHVzaXZlIGVuZCBvZiB0aGUgY3VycmVudCBzZWdtZW50LlxuICAgIGZvciAoOyBpIDwgZ2xvYi5sZW5ndGggJiYgIXNlcHMuaW5jbHVkZXMoZ2xvYltpXSk7IGkrKykge1xuICAgICAgaWYgKGluRXNjYXBlKSB7XG4gICAgICAgIGluRXNjYXBlID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGVzY2FwZUNoYXJzID0gaW5SYW5nZSA/IHJhbmdlRXNjYXBlQ2hhcnMgOiByZWdFeHBFc2NhcGVDaGFycztcbiAgICAgICAgc2VnbWVudCArPSBlc2NhcGVDaGFycy5pbmNsdWRlcyhnbG9iW2ldKSA/IGBcXFxcJHtnbG9iW2ldfWAgOiBnbG9iW2ldO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gZXNjYXBlUHJlZml4KSB7XG4gICAgICAgIGluRXNjYXBlID0gdHJ1ZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChnbG9iW2ldID09IFwiW1wiKSB7XG4gICAgICAgIGlmICghaW5SYW5nZSkge1xuICAgICAgICAgIGluUmFuZ2UgPSB0cnVlO1xuICAgICAgICAgIHNlZ21lbnQgKz0gXCJbXCI7XG4gICAgICAgICAgaWYgKGdsb2JbaSArIDFdID09IFwiIVwiKSB7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBzZWdtZW50ICs9IFwiXlwiO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZ2xvYltpICsgMV0gPT0gXCJeXCIpIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIHNlZ21lbnQgKz0gXCJcXFxcXlwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIGlmIChnbG9iW2kgKyAxXSA9PSBcIjpcIikge1xuICAgICAgICAgIGxldCBrID0gaSArIDE7XG4gICAgICAgICAgbGV0IHZhbHVlID0gXCJcIjtcbiAgICAgICAgICB3aGlsZSAoZ2xvYltrICsgMV0gIT0gbnVsbCAmJiBnbG9iW2sgKyAxXSAhPSBcIjpcIikge1xuICAgICAgICAgICAgdmFsdWUgKz0gZ2xvYltrICsgMV07XG4gICAgICAgICAgICBrKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChnbG9iW2sgKyAxXSA9PSBcIjpcIiAmJiBnbG9iW2sgKyAyXSA9PSBcIl1cIikge1xuICAgICAgICAgICAgaSA9IGsgKyAyO1xuICAgICAgICAgICAgaWYgKHZhbHVlID09IFwiYWxudW1cIikgc2VnbWVudCArPSBcIlxcXFxkQS1aYS16XCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImFscGhhXCIpIHNlZ21lbnQgKz0gXCJBLVphLXpcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwiYXNjaWlcIikgc2VnbWVudCArPSBcIlxceDAwLVxceDdGXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImJsYW5rXCIpIHNlZ21lbnQgKz0gXCJcXHQgXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImNudHJsXCIpIHNlZ21lbnQgKz0gXCJcXHgwMC1cXHgxRlxceDdGXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImRpZ2l0XCIpIHNlZ21lbnQgKz0gXCJcXFxcZFwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJncmFwaFwiKSBzZWdtZW50ICs9IFwiXFx4MjEtXFx4N0VcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwibG93ZXJcIikgc2VnbWVudCArPSBcImEtelwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJwcmludFwiKSBzZWdtZW50ICs9IFwiXFx4MjAtXFx4N0VcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwicHVuY3RcIikge1xuICAgICAgICAgICAgICBzZWdtZW50ICs9IFwiIVxcXCIjJCUmJygpKissXFxcXC0uLzo7PD0+P0BbXFxcXFxcXFxcXFxcXV5f4oCYe3x9flwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PSBcInNwYWNlXCIpIHNlZ21lbnQgKz0gXCJcXFxcc1xcdlwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJ1cHBlclwiKSBzZWdtZW50ICs9IFwiQS1aXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcIndvcmRcIikgc2VnbWVudCArPSBcIlxcXFx3XCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcInhkaWdpdFwiKSBzZWdtZW50ICs9IFwiXFxcXGRBLUZhLWZcIjtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIl1cIiAmJiBpblJhbmdlKSB7XG4gICAgICAgIGluUmFuZ2UgPSBmYWxzZTtcbiAgICAgICAgc2VnbWVudCArPSBcIl1cIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpblJhbmdlKSB7XG4gICAgICAgIGlmIChnbG9iW2ldID09IFwiXFxcXFwiKSB7XG4gICAgICAgICAgc2VnbWVudCArPSBgXFxcXFxcXFxgO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlZ21lbnQgKz0gZ2xvYltpXTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBnbG9iW2ldID09IFwiKVwiICYmIGdyb3VwU3RhY2subGVuZ3RoID4gMCAmJlxuICAgICAgICBncm91cFN0YWNrW2dyb3VwU3RhY2subGVuZ3RoIC0gMV0gIT0gXCJCUkFDRVwiXG4gICAgICApIHtcbiAgICAgICAgc2VnbWVudCArPSBcIilcIjtcbiAgICAgICAgY29uc3QgdHlwZSA9IGdyb3VwU3RhY2sucG9wKCkhO1xuICAgICAgICBpZiAodHlwZSA9PSBcIiFcIikge1xuICAgICAgICAgIHNlZ21lbnQgKz0gd2lsZGNhcmQ7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSAhPSBcIkBcIikge1xuICAgICAgICAgIHNlZ21lbnQgKz0gdHlwZTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBnbG9iW2ldID09IFwifFwiICYmIGdyb3VwU3RhY2subGVuZ3RoID4gMCAmJlxuICAgICAgICBncm91cFN0YWNrW2dyb3VwU3RhY2subGVuZ3RoIC0gMV0gIT0gXCJCUkFDRVwiXG4gICAgICApIHtcbiAgICAgICAgc2VnbWVudCArPSBcInxcIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChnbG9iW2ldID09IFwiK1wiICYmIGV4dGVuZGVkICYmIGdsb2JbaSArIDFdID09IFwiKFwiKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgZ3JvdXBTdGFjay5wdXNoKFwiK1wiKTtcbiAgICAgICAgc2VnbWVudCArPSBcIig/OlwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCJAXCIgJiYgZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgaSsrO1xuICAgICAgICBncm91cFN0YWNrLnB1c2goXCJAXCIpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKD86XCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIj9cIikge1xuICAgICAgICBpZiAoZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZ3JvdXBTdGFjay5wdXNoKFwiP1wiKTtcbiAgICAgICAgICBzZWdtZW50ICs9IFwiKD86XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VnbWVudCArPSBcIi5cIjtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCIhXCIgJiYgZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgaSsrO1xuICAgICAgICBncm91cFN0YWNrLnB1c2goXCIhXCIpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKD8hXCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIntcIikge1xuICAgICAgICBncm91cFN0YWNrLnB1c2goXCJCUkFDRVwiKTtcbiAgICAgICAgc2VnbWVudCArPSBcIig/OlwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCJ9XCIgJiYgZ3JvdXBTdGFja1tncm91cFN0YWNrLmxlbmd0aCAtIDFdID09IFwiQlJBQ0VcIikge1xuICAgICAgICBncm91cFN0YWNrLnBvcCgpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKVwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCIsXCIgJiYgZ3JvdXBTdGFja1tncm91cFN0YWNrLmxlbmd0aCAtIDFdID09IFwiQlJBQ0VcIikge1xuICAgICAgICBzZWdtZW50ICs9IFwifFwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCIqXCIpIHtcbiAgICAgICAgaWYgKGV4dGVuZGVkICYmIGdsb2JbaSArIDFdID09IFwiKFwiKSB7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGdyb3VwU3RhY2sucHVzaChcIipcIik7XG4gICAgICAgICAgc2VnbWVudCArPSBcIig/OlwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHByZXZDaGFyID0gZ2xvYltpIC0gMV07XG4gICAgICAgICAgbGV0IG51bVN0YXJzID0gMTtcbiAgICAgICAgICB3aGlsZSAoZ2xvYltpICsgMV0gPT0gXCIqXCIpIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIG51bVN0YXJzKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IG5leHRDaGFyID0gZ2xvYltpICsgMV07XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgZ2xvYnN0YXJPcHRpb24gJiYgbnVtU3RhcnMgPT0gMiAmJlxuICAgICAgICAgICAgWy4uLnNlcHMsIHVuZGVmaW5lZF0uaW5jbHVkZXMocHJldkNoYXIpICYmXG4gICAgICAgICAgICBbLi4uc2VwcywgdW5kZWZpbmVkXS5pbmNsdWRlcyhuZXh0Q2hhcilcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHNlZ21lbnQgKz0gZ2xvYnN0YXI7XG4gICAgICAgICAgICBlbmRzV2l0aFNlcCA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlZ21lbnQgKz0gd2lsZGNhcmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBzZWdtZW50ICs9IHJlZ0V4cEVzY2FwZUNoYXJzLmluY2x1ZGVzKGdsb2JbaV0pID8gYFxcXFwke2dsb2JbaV19YCA6IGdsb2JbaV07XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIHVuY2xvc2VkIGdyb3VwcyBvciBhIGRhbmdsaW5nIGJhY2tzbGFzaC5cbiAgICBpZiAoZ3JvdXBTdGFjay5sZW5ndGggPiAwIHx8IGluUmFuZ2UgfHwgaW5Fc2NhcGUpIHtcbiAgICAgIC8vIFBhcnNlIGZhaWx1cmUuIFRha2UgYWxsIGNoYXJhY3RlcnMgZnJvbSB0aGlzIHNlZ21lbnQgbGl0ZXJhbGx5LlxuICAgICAgc2VnbWVudCA9IFwiXCI7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgZ2xvYi5zbGljZShqLCBpKSkge1xuICAgICAgICBzZWdtZW50ICs9IHJlZ0V4cEVzY2FwZUNoYXJzLmluY2x1ZGVzKGMpID8gYFxcXFwke2N9YCA6IGM7XG4gICAgICAgIGVuZHNXaXRoU2VwID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVnRXhwU3RyaW5nICs9IHNlZ21lbnQ7XG4gICAgaWYgKCFlbmRzV2l0aFNlcCkge1xuICAgICAgcmVnRXhwU3RyaW5nICs9IGkgPCBnbG9iLmxlbmd0aCA/IHNlcCA6IHNlcE1heWJlO1xuICAgICAgZW5kc1dpdGhTZXAgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIFRlcm1pbmF0ZXMgd2l0aCBgaWAgYXQgdGhlIHN0YXJ0IG9mIHRoZSBuZXh0IHNlZ21lbnQuXG4gICAgd2hpbGUgKHNlcHMuaW5jbHVkZXMoZ2xvYltpXSkpIGkrKztcblxuICAgIC8vIENoZWNrIHRoYXQgdGhlIG5leHQgdmFsdWUgb2YgYGpgIGlzIGluZGVlZCBoaWdoZXIgdGhhbiB0aGUgY3VycmVudCB2YWx1ZS5cbiAgICBpZiAoIShpID4gaikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkFzc2VydGlvbiBmYWlsdXJlOiBpID4gaiAocG90ZW50aWFsIGluZmluaXRlIGxvb3ApXCIpO1xuICAgIH1cbiAgICBqID0gaTtcbiAgfVxuXG4gIHJlZ0V4cFN0cmluZyA9IGBeJHtyZWdFeHBTdHJpbmd9JGA7XG4gIHJldHVybiBuZXcgUmVnRXhwKHJlZ0V4cFN0cmluZywgY2FzZUluc2Vuc2l0aXZlID8gXCJpXCIgOiBcIlwiKTtcbn1cblxuLyoqIFRlc3Qgd2hldGhlciB0aGUgZ2l2ZW4gc3RyaW5nIGlzIGEgZ2xvYiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzR2xvYihzdHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBjaGFyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgXCJ7XCI6IFwifVwiLCBcIihcIjogXCIpXCIsIFwiW1wiOiBcIl1cIiB9O1xuICBjb25zdCByZWdleCA9XG4gICAgL1xcXFwoLil8KF4hfFxcKnxcXD98W1xcXS4rKV1cXD98XFxbW15cXFxcXFxdXStcXF18XFx7W15cXFxcfV0rXFx9fFxcKFxcP1s6IT1dW15cXFxcKV0rXFwpfFxcKFtefF0rXFx8W15cXFxcKV0rXFwpKS87XG5cbiAgaWYgKHN0ciA9PT0gXCJcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGxldCBtYXRjaDogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcblxuICB3aGlsZSAoKG1hdGNoID0gcmVnZXguZXhlYyhzdHIpKSkge1xuICAgIGlmIChtYXRjaFsyXSkgcmV0dXJuIHRydWU7XG4gICAgbGV0IGlkeCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuXG4gICAgLy8gaWYgYW4gb3BlbiBicmFja2V0L2JyYWNlL3BhcmVuIGlzIGVzY2FwZWQsXG4gICAgLy8gc2V0IHRoZSBpbmRleCB0byB0aGUgbmV4dCBjbG9zaW5nIGNoYXJhY3RlclxuICAgIGNvbnN0IG9wZW4gPSBtYXRjaFsxXTtcbiAgICBjb25zdCBjbG9zZSA9IG9wZW4gPyBjaGFyc1tvcGVuXSA6IG51bGw7XG4gICAgaWYgKG9wZW4gJiYgY2xvc2UpIHtcbiAgICAgIGNvbnN0IG4gPSBzdHIuaW5kZXhPZihjbG9zZSwgaWR4KTtcbiAgICAgIGlmIChuICE9PSAtMSkge1xuICAgICAgICBpZHggPSBuICsgMTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdHIgPSBzdHIuc2xpY2UoaWR4KTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqIExpa2Ugbm9ybWFsaXplKCksIGJ1dCBkb2Vzbid0IGNvbGxhcHNlIFwiKipcXC8uLlwiIHdoZW4gYGdsb2JzdGFyYCBpcyB0cnVlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUdsb2IoXG4gIGdsb2I6IHN0cmluZyxcbiAgeyBnbG9ic3RhciA9IGZhbHNlIH06IEdsb2JPcHRpb25zID0ge30sXG4pOiBzdHJpbmcge1xuICBpZiAoZ2xvYi5tYXRjaCgvXFwwL2cpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBHbG9iIGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVyczogXCIke2dsb2J9XCJgKTtcbiAgfVxuICBpZiAoIWdsb2JzdGFyKSB7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZShnbG9iKTtcbiAgfVxuICBjb25zdCBzID0gU0VQX1BBVFRFUk4uc291cmNlO1xuICBjb25zdCBiYWRQYXJlbnRQYXR0ZXJuID0gbmV3IFJlZ0V4cChcbiAgICBgKD88PSgke3N9fF4pXFxcXCpcXFxcKiR7c30pXFxcXC5cXFxcLig/PSR7c318JClgLFxuICAgIFwiZ1wiLFxuICApO1xuICByZXR1cm4gbm9ybWFsaXplKGdsb2IucmVwbGFjZShiYWRQYXJlbnRQYXR0ZXJuLCBcIlxcMFwiKSkucmVwbGFjZSgvXFwwL2csIFwiLi5cIik7XG59XG5cbi8qKiBMaWtlIGpvaW4oKSwgYnV0IGRvZXNuJ3QgY29sbGFwc2UgXCIqKlxcLy4uXCIgd2hlbiBgZ2xvYnN0YXJgIGlzIHRydWUuICovXG5leHBvcnQgZnVuY3Rpb24gam9pbkdsb2JzKFxuICBnbG9iczogc3RyaW5nW10sXG4gIHsgZXh0ZW5kZWQgPSBmYWxzZSwgZ2xvYnN0YXIgPSBmYWxzZSB9OiBHbG9iT3B0aW9ucyA9IHt9LFxuKTogc3RyaW5nIHtcbiAgaWYgKCFnbG9ic3RhciB8fCBnbG9icy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBqb2luKC4uLmdsb2JzKTtcbiAgfVxuICBpZiAoZ2xvYnMubGVuZ3RoID09PSAwKSByZXR1cm4gXCIuXCI7XG4gIGxldCBqb2luZWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgZm9yIChjb25zdCBnbG9iIG9mIGdsb2JzKSB7XG4gICAgY29uc3QgcGF0aCA9IGdsb2I7XG4gICAgaWYgKHBhdGgubGVuZ3RoID4gMCkge1xuICAgICAgaWYgKCFqb2luZWQpIGpvaW5lZCA9IHBhdGg7XG4gICAgICBlbHNlIGpvaW5lZCArPSBgJHtTRVB9JHtwYXRofWA7XG4gICAgfVxuICB9XG4gIGlmICgham9pbmVkKSByZXR1cm4gXCIuXCI7XG4gIHJldHVybiBub3JtYWxpemVHbG9iKGpvaW5lZCwgeyBleHRlbmRlZCwgZ2xvYnN0YXIgfSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFDQUFxQztBQUVyQyxTQUFTLFNBQVMsRUFBRSxNQUFNLFFBQVEsZ0JBQWdCLENBQUM7QUFDbkQsU0FBUyxHQUFHLEVBQUUsV0FBVyxRQUFRLGdCQUFnQixDQUFDO0FBQ2xELFlBQVksTUFBTSxNQUFNLFlBQVksQ0FBQztBQUNyQyxZQUFZLE1BQU0sTUFBTSxZQUFZLENBQUM7QUFHckMsTUFBTSxJQUFJLEdBQUcsU0FBUyxHQUFHLE1BQU0sR0FBRyxNQUFNLEFBQUM7QUFDekMsTUFBTSxFQUFFLElBQUksQ0FBQSxFQUFFLFNBQVMsQ0FBQSxFQUFFLEdBQUcsSUFBSSxBQUFDO0FBbUJqQyxrQkFBa0I7QUFDbEIsTUFBTSxpQkFBaUIsR0FBRztJQUFDLEdBQUc7SUFBRSxHQUFHO0lBQUUsR0FBRztJQUFFLEdBQUc7SUFBRSxHQUFHO0lBQUUsR0FBRztJQUFFLEdBQUc7SUFBRSxHQUFHO0lBQUUsR0FBRztJQUFFLEdBQUc7SUFBRSxJQUFJO0lBQUUsR0FBRztJQUFFLEdBQUc7SUFBRSxHQUFHO0NBQUMsQUFBQztBQUNsRyxNQUFNLGdCQUFnQixHQUFHO0lBQUMsR0FBRztJQUFFLElBQUk7SUFBRSxHQUFHO0NBQUMsQUFBQztBQUUxQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzhEQXNEOEQsQ0FDOUQsT0FBTyxTQUFTLFlBQVksQ0FDMUIsSUFBWSxFQUNaLEVBQ0UsUUFBUSxFQUFHLElBQUksQ0FBQSxFQUNmLFFBQVEsRUFBRSxjQUFjLEdBQUcsSUFBSSxDQUFBLEVBQy9CLEVBQUUsRUFBRyxNQUFNLENBQUEsRUFDWCxlQUFlLEVBQUcsS0FBSyxDQUFBLEVBQ0gsR0FBRyxFQUFFLEVBQ25CO0lBQ1IsSUFBSSxJQUFJLElBQUksRUFBRSxFQUFFO1FBQ2QsY0FBYztLQUNmO0lB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