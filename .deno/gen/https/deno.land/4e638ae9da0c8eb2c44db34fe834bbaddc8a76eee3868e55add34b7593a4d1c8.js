// Note: this is the semver.org version of the spec that it implements
// Not necessarily the package version of this code.
export const SEMVER_SPEC_VERSION = "2.0.0";
const MAX_LENGTH = 256;
// Max safe segment length for coercion.
const MAX_SAFE_COMPONENT_LENGTH = 16;
// The actual regexps
const re = [];
const src = [];
let R = 0;
// The following Regular Expressions can be used for tokenizing,
// validating, and parsing SemVer version strings.
// ## Numeric Identifier
// A single `0`, or a non-zero digit followed by zero or more digits.
const NUMERICIDENTIFIER = R++;
src[NUMERICIDENTIFIER] = "0|[1-9]\\d*";
const NUMERICIDENTIFIERLOOSE = R++;
src[NUMERICIDENTIFIERLOOSE] = "[0-9]+";
// ## Non-numeric Identifier
// Zero or more digits, followed by a letter or hyphen, and then zero or
// more letters, digits, or hyphens.
const NONNUMERICIDENTIFIER = R++;
src[NONNUMERICIDENTIFIER] = "\\d*[a-zA-Z-][a-zA-Z0-9-]*";
// ## Main Version
// Three dot-separated numeric identifiers.
const MAINVERSION = R++;
const nid = src[NUMERICIDENTIFIER];
src[MAINVERSION] = `(${nid})\\.(${nid})\\.(${nid})`;
const MAINVERSIONLOOSE = R++;
const nidl = src[NUMERICIDENTIFIERLOOSE];
src[MAINVERSIONLOOSE] = `(${nidl})\\.(${nidl})\\.(${nidl})`;
// ## Pre-release Version Identifier
// A numeric identifier, or a non-numeric identifier.
const PRERELEASEIDENTIFIER = R++;
src[PRERELEASEIDENTIFIER] = "(?:" + src[NUMERICIDENTIFIER] + "|" + src[NONNUMERICIDENTIFIER] + ")";
const PRERELEASEIDENTIFIERLOOSE = R++;
src[PRERELEASEIDENTIFIERLOOSE] = "(?:" + src[NUMERICIDENTIFIERLOOSE] + "|" + src[NONNUMERICIDENTIFIER] + ")";
// ## Pre-release Version
// Hyphen, followed by one or more dot-separated pre-release version
// identifiers.
const PRERELEASE = R++;
src[PRERELEASE] = "(?:-(" + src[PRERELEASEIDENTIFIER] + "(?:\\." + src[PRERELEASEIDENTIFIER] + ")*))";
const PRERELEASELOOSE = R++;
src[PRERELEASELOOSE] = "(?:-?(" + src[PRERELEASEIDENTIFIERLOOSE] + "(?:\\." + src[PRERELEASEIDENTIFIERLOOSE] + ")*))";
// ## Build Metadata Identifier
// Any combination of digits, letters, or hyphens.
const BUILDIDENTIFIER = R++;
src[BUILDIDENTIFIER] = "[0-9A-Za-z-]+";
// ## Build Metadata
// Plus sign, followed by one or more period-separated build metadata
// identifiers.
const BUILD = R++;
src[BUILD] = "(?:\\+(" + src[BUILDIDENTIFIER] + "(?:\\." + src[BUILDIDENTIFIER] + ")*))";
// ## Full Version String
// A main version, followed optionally by a pre-release version and
// build metadata.
// Note that the only major, minor, patch, and pre-release sections of
// the version string are capturing groups.  The build metadata is not a
// capturing group, because it should not ever be used in version
// comparison.
const FULL = R++;
const FULLPLAIN = "v?" + src[MAINVERSION] + src[PRERELEASE] + "?" + src[BUILD] + "?";
src[FULL] = "^" + FULLPLAIN + "$";
// like full, but allows v1.2.3 and =1.2.3, which people do sometimes.
// also, 1.0.0alpha1 (prerelease without the hyphen) which is pretty
// common in the npm registry.
const LOOSEPLAIN = "[v=\\s]*" + src[MAINVERSIONLOOSE] + src[PRERELEASELOOSE] + "?" + src[BUILD] + "?";
const LOOSE = R++;
src[LOOSE] = "^" + LOOSEPLAIN + "$";
const GTLT = R++;
src[GTLT] = "((?:<|>)?=?)";
// Something like "2.*" or "1.2.x".
// Note that "x.x" is a valid xRange identifer, meaning "any version"
// Only the first item is strictly required.
const XRANGEIDENTIFIERLOOSE = R++;
src[XRANGEIDENTIFIERLOOSE] = src[NUMERICIDENTIFIERLOOSE] + "|x|X|\\*";
const XRANGEIDENTIFIER = R++;
src[XRANGEIDENTIFIER] = src[NUMERICIDENTIFIER] + "|x|X|\\*";
const XRANGEPLAIN = R++;
src[XRANGEPLAIN] = "[v=\\s]*(" + src[XRANGEIDENTIFIER] + ")" + "(?:\\.(" + src[XRANGEIDENTIFIER] + ")" + "(?:\\.(" + src[XRANGEIDENTIFIER] + ")" + "(?:" + src[PRERELEASE] + ")?" + src[BUILD] + "?" + ")?)?";
const XRANGEPLAINLOOSE = R++;
src[XRANGEPLAINLOOSE] = "[v=\\s]*(" + src[XRANGEIDENTIFIERLOOSE] + ")" + "(?:\\.(" + src[XRANGEIDENTIFIERLOOSE] + ")" + "(?:\\.(" + src[XRANGEIDENTIFIERLOOSE] + ")" + "(?:" + src[PRERELEASELOOSE] + ")?" + src[BUILD] + "?" + ")?)?";
const XRANGE = R++;
src[XRANGE] = "^" + src[GTLT] + "\\s*" + src[XRANGEPLAIN] + "$";
const XRANGELOOSE = R++;
src[XRANGELOOSE] = "^" + src[GTLT] + "\\s*" + src[XRANGEPLAINLOOSE] + "$";
// Coercion.
// Extract anything that could conceivably be a part of a valid semver
const COERCE = R++;
src[COERCE] = "(?:^|[^\\d])" + "(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "})" + "(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?" + "(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?" + "(?:$|[^\\d])";
// Tilde ranges.
// Meaning is "reasonably at or greater than"
const LONETILDE = R++;
src[LONETILDE] = "(?:~>?)";
const TILDETRIM = R++;
src[TILDETRIM] = "(\\s*)" + src[LONETILDE] + "\\s+";
re[TILDETRIM] = new RegExp(src[TILDETRIM], "g");
const tildeTrimReplace = "$1~";
const TILDE = R++;
src[TILDE] = "^" + src[LONETILDE] + src[XRANGEPLAIN] + "$";
const TILDELOOSE = R++;
src[TILDELOOSE] = "^" + src[LONETILDE] + src[XRANGEPLAINLOOSE] + "$";
// Caret ranges.
// Meaning is "at least and backwards compatible with"
const LONECARET = R++;
src[LONECARET] = "(?:\\^)";
const CARETTRIM = R++;
src[CARETTRIM] = "(\\s*)" + src[LONECARET] + "\\s+";
re[CARETTRIM] = new RegExp(src[CARETTRIM], "g");
const caretTrimReplace = "$1^";
const CARET = R++;
src[CARET] = "^" + src[LONECARET] + src[XRANGEPLAIN] + "$";
const CARETLOOSE = R++;
src[CARETLOOSE] = "^" + src[LONECARET] + src[XRANGEPLAINLOOSE] + "$";
// A simple gt/lt/eq thing, or just "" to indicate "any version"
const COMPARATORLOOSE = R++;
src[COMPARATORLOOSE] = "^" + src[GTLT] + "\\s*(" + LOOSEPLAIN + ")$|^$";
const COMPARATOR = R++;
src[COMPARATOR] = "^" + src[GTLT] + "\\s*(" + FULLPLAIN + ")$|^$";
// An expression to strip any whitespace between the gtlt and the thing
// it modifies, so that `> 1.2.3` ==> `>1.2.3`
const COMPARATORTRIM = R++;
src[COMPARATORTRIM] = "(\\s*)" + src[GTLT] + "\\s*(" + LOOSEPLAIN + "|" + src[XRANGEPLAIN] + ")";
// this one has to use the /g flag
re[COMPARATORTRIM] = new RegExp(src[COMPARATORTRIM], "g");
const comparatorTrimReplace = "$1$2$3";
// Something like `1.2.3 - 1.2.4`
// Note that these all use the loose form, because they'll be
// checked against either the strict or loose comparator form
// later.
const HYPHENRANGE = R++;
src[HYPHENRANGE] = "^\\s*(" + src[XRANGEPLAIN] + ")" + "\\s+-\\s+" + "(" + src[XRANGEPLAIN] + ")" + "\\s*$";
const HYPHENRANGELOOSE = R++;
src[HYPHENRANGELOOSE] = "^\\s*(" + src[XRANGEPLAINLOOSE] + ")" + "\\s+-\\s+" + "(" + src[XRANGEPLAINLOOSE] + ")" + "\\s*$";
// Star ranges basically just allow anything at all.
const STAR = R++;
src[STAR] = "(<|>)?=?\\s*\\*";
// Compile to actual regexp objects.
// All are flag-free, unless they were created above with a flag.
for(let i = 0; i < R; i++){
    if (!re[i]) {
        re[i] = new RegExp(src[i]);
    }
}
export function parse(version, optionsOrLoose) {
    if (!optionsOrLoose || typeof optionsOrLoose !== "object") {
        optionsOrLoose = {
            loose: !!optionsOrLoose,
            includePrerelease: false
        };
    }
    if (version instanceof SemVer) {
        return version;
    }
    if (typeof version !== "string") {
        return null;
    }
    if (version.length > MAX_LENGTH) {
        return null;
    }
    const r = optionsOrLoose.loose ? re[LOOSE] : re[FULL];
    if (!r.test(version)) {
        return null;
    }
    try {
        return new SemVer(version, optionsOrLoose);
    } catch (er) {
        return null;
    }
}
export function valid(version, optionsOrLoose) {
    if (version === null) return null;
    const v = parse(version, optionsOrLoose);
    return v ? v.version : null;
}
export function clean(version, optionsOrLoose) {
    const s = parse(version.trim().replace(/^[=v]+/, ""), optionsOrLoose);
    return s ? s.version : null;
}
export class SemVer {
    raw;
    loose;
    options;
    major;
    minor;
    patch;
    version;
    build;
    prerelease;
    constructor(version, optionsOrLoose){
        if (!optionsOrLoose || typeof optionsOrLoose !== "object") {
            optionsOrLoose = {
                loose: !!optionsOrLoose,
                includePrerelease: false
            };
        }
        if (version instanceof SemVer) {
            if (version.loose === optionsOrLoose.loose) {
                return version;
            } else {
                version = version.version;
            }
        } else if (typeof version !== "string") {
            throw new TypeError("Invalid Version: " + version);
        }
        if (version.length > MAX_LENGTH) {
            throw new TypeError("version is longer than " + MAX_LENGTH + " characters");
        }
        if (!(this instanceof SemVer)) {
            return new SemVer(version, optionsOrLoose);
        }
        this.options = optionsOrLoose;
        this.loose = !!optionsOrLoose.loose;
        const m = version.trim().match(optionsOrLoose.loose ? re[LOOSE] : re[FULL]);
        if (!m) {
            throw new TypeError("Invalid Version: " + version);
        }
        this.raw = version;
        // these are actually numbers
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > Number.MAX_SAFE_INTEGER || this.major < 0) {
            throw new TypeError("Invalid major version");
        }
        if (this.minor > Number.MAX_SAFE_INTEGER || this.minor < 0) {
            throw new TypeError("Invalid minor version");
        }
        if (this.patch > Number.MAX_SAFE_INTEGER || this.patch < 0) {
            throw new TypeError("Invalid patch version");
        }
        // numberify any prerelease numeric ids
        if (!m[4]) {
            this.prerelease = [];
        } else {
            this.prerelease = m[4].split(".").map((id)=>{
                if (/^[0-9]+$/.test(id)) {
                    const num = +id;
                    if (num >= 0 && num < Number.MAX_SAFE_INTEGER) {
                        return num;
                    }
                }
                return id;
            });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
    }
    format() {
        this.version = this.major + "." + this.minor + "." + this.patch;
        if (this.prerelease.length) {
            this.version += "-" + this.prerelease.join(".");
        }
        return this.version;
    }
    compare(other) {
        if (!(other instanceof SemVer)) {
            other = new SemVer(other, this.options);
        }
        return this.compareMain(other) || this.comparePre(other);
    }
    compareMain(other) {
        if (!(other instanceof SemVer)) {
            other = new SemVer(other, this.options);
        }
        return compareIdentifiers(this.major, other.major) || compareIdentifiers(this.minor, other.minor) || compareIdentifiers(this.patch, other.patch);
    }
    comparePre(other) {
        if (!(other instanceof SemVer)) {
            other = new SemVer(other, this.options);
        }
        // NOT having a prerelease is > having one
        if (this.prerelease.length && !other.prerelease.length) {
            return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
            return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
            return 0;
        }
        let i = 0;
        do {
            const a = this.prerelease[i];
            const b = other.prerelease[i];
            if (a === undefined && b === undefined) {
                return 0;
            } else if (b === undefined) {
                return 1;
            } else if (a === undefined) {
                return -1;
            } else if (a === b) {
                continue;
            } else {
                return compareIdentifiers(a, b);
            }
        }while (++i)
        return 1;
    }
    compareBuild(other) {
        if (!(other instanceof SemVer)) {
            other = new SemVer(other, this.options);
        }
        let i = 0;
        do {
            const a = this.build[i];
            const b = other.build[i];
            if (a === undefined && b === undefined) {
                return 0;
            } else if (b === undefined) {
                return 1;
            } else if (a === undefined) {
                return -1;
            } else if (a === b) {
                continue;
            } else {
                return compareIdentifiers(a, b);
            }
        }while (++i)
        return 1;
    }
    inc(release, identifier) {
        switch(release){
            case "premajor":
                this.prerelease.length = 0;
                this.patch = 0;
                this.minor = 0;
                this.major++;
                this.inc("pre", identifier);
                break;
            case "preminor":
                this.prerelease.length = 0;
                this.patch = 0;
                this.minor++;
                this.inc("pre", identifier);
                break;
            case "prepatch":
                // If this is already a prerelease, it will bump to the next version
                // drop any prereleases that might already exist, since they are not
                // relevant at this point.
                this.prerelease.length = 0;
                this.inc("patch", identifier);
                this.inc("pre", identifier);
                break;
            // If the input is a non-prerelease version, this acts the same as
            // prepatch.
            case "prerelease":
                if (this.prerelease.length === 0) {
                    this.inc("patch", identifier);
                }
                this.inc("pre", identifier);
                break;
            case "major":
                // If this is a pre-major version, bump up to the same major version.
                // Otherwise increment major.
                // 1.0.0-5 bumps to 1.0.0
                // 1.1.0 bumps to 2.0.0
                if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
                    this.major++;
                }
                this.minor = 0;
                this.patch = 0;
                this.prerelease = [];
                break;
            case "minor":
                // If this is a pre-minor version, bump up to the same minor version.
                // Otherwise increment minor.
                // 1.2.0-5 bumps to 1.2.0
                // 1.2.1 bumps to 1.3.0
                if (this.patch !== 0 || this.prerelease.length === 0) {
                    this.minor++;
                }
                this.patch = 0;
                this.prerelease = [];
                break;
            case "patch":
                // If this is not a pre-release version, it will increment the patch.
                // If it is a pre-release it will bump up to the same patch version.
                // 1.2.0-5 patches to 1.2.0
                // 1.2.0 patches to 1.2.1
                if (this.prerelease.length === 0) {
                    this.patch++;
                }
                this.prerelease = [];
                break;
            // This probably shouldn't be used publicly.
            // 1.0.0 "pre" would become 1.0.0-0 which is the wrong direction.
            case "pre":
                if (this.prerelease.length === 0) {
                    this.prerelease = [
                        0
                    ];
                } else {
                    let i = this.prerelease.length;
                    while(--i >= 0){
                        if (typeof this.prerelease[i] === "number") {
                            this.prerelease[i]++;
                            i = -2;
                        }
                    }
                    if (i === -1) {
                        // didn't increment anything
                        this.prerelease.push(0);
                    }
                }
                if (identifier) {
                    // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
                    // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
                    if (this.prerelease[0] === identifier) {
                        if (isNaN(this.prerelease[1])) {
                            this.prerelease = [
                                identifier,
                                0
                            ];
                        }
                    } else {
                        this.prerelease = [
                            identifier,
                            0
                        ];
                    }
                }
                break;
            default:
                throw new Error("invalid increment argument: " + release);
        }
        this.format();
        this.raw = this.version;
        return this;
    }
    toString() {
        return this.version;
    }
}
/**
 * Return the version incremented by the release type (major, minor, patch, or prerelease), or null if it's not valid.
 */ export function inc(version, release, optionsOrLoose, identifier) {
    if (typeof optionsOrLoose === "string") {
        identifier = optionsOrLoose;
        optionsOrLoose = undefined;
    }
    try {
        return new SemVer(version, optionsOrLoose).inc(release, identifier).version;
    } catch (er) {
        return null;
    }
}
export function diff(version1, version2, optionsOrLoose) {
    if (eq(version1, version2, optionsOrLoose)) {
        return null;
    } else {
        const v1 = parse(version1);
        const v2 = parse(version2);
        let prefix = "";
        let defaultResult = null;
        if (v1 && v2) {
            if (v1.prerelease.length || v2.prerelease.length) {
                prefix = "pre";
                defaultResult = "prerelease";
            }
            for(const key in v1){
                if (key === "major" || key === "minor" || key === "patch") {
                    if (v1[key] !== v2[key]) {
                        return prefix + key;
                    }
                }
            }
        }
        return defaultResult; // may be undefined
    }
}
const numeric = /^[0-9]+$/;
export function compareIdentifiers(a, b) {
    const anum = numeric.test(a);
    const bnum = numeric.test(b);
    if (a === null || b === null) throw "Comparison against null invalid";
    if (anum && bnum) {
        a = +a;
        b = +b;
    }
    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
}
export function rcompareIdentifiers(a, b) {
    return compareIdentifiers(b, a);
}
/**
 * Return the major version number.
 */ export function major(v, optionsOrLoose) {
    return new SemVer(v, optionsOrLoose).major;
}
/**
 * Return the minor version number.
 */ export function minor(v, optionsOrLoose) {
    return new SemVer(v, optionsOrLoose).minor;
}
/**
 * Return the patch version number.
 */ export function patch(v, optionsOrLoose) {
    return new SemVer(v, optionsOrLoose).patch;
}
export function compare(v1, v2, optionsOrLoose) {
    return new SemVer(v1, optionsOrLoose).compare(new SemVer(v2, optionsOrLoose));
}
export function compareLoose(a, b) {
    return compare(a, b, true);
}
export function compareBuild(a, b, loose) {
    var versionA = new SemVer(a, loose);
    var versionB = new SemVer(b, loose);
    return versionA.compare(versionB) || versionA.compareBuild(versionB);
}
export function rcompare(v1, v2, optionsOrLoose) {
    return compare(v2, v1, optionsOrLoose);
}
export function sort(list, optionsOrLoose) {
    return list.sort((a, b)=>{
        return compareBuild(a, b, optionsOrLoose);
    });
}
export function rsort(list, optionsOrLoose) {
    return list.sort((a, b)=>{
        return compareBuild(b, a, optionsOrLoose);
    });
}
export function gt(v1, v2, optionsOrLoose) {
    return compare(v1, v2, optionsOrLoose) > 0;
}
export function lt(v1, v2, optionsOrLoose) {
    return compare(v1, v2, optionsOrLoose) < 0;
}
export function eq(v1, v2, optionsOrLoose) {
    return compare(v1, v2, optionsOrLoose) === 0;
}
export function neq(v1, v2, optionsOrLoose) {
    return compare(v1, v2, optionsOrLoose) !== 0;
}
export function gte(v1, v2, optionsOrLoose) {
    return compare(v1, v2, optionsOrLoose) >= 0;
}
export function lte(v1, v2, optionsOrLoose) {
    return compare(v1, v2, optionsOrLoose) <= 0;
}
export function cmp(v1, operator, v2, optionsOrLoose) {
    switch(operator){
        case "===":
            if (typeof v1 === "object") v1 = v1.version;
            if (typeof v2 === "object") v2 = v2.version;
            return v1 === v2;
        case "!==":
            if (typeof v1 === "object") v1 = v1.version;
            if (typeof v2 === "object") v2 = v2.version;
            return v1 !== v2;
        case "":
        case "=":
        case "==":
            return eq(v1, v2, optionsOrLoose);
        case "!=":
            return neq(v1, v2, optionsOrLoose);
        case ">":
            return gt(v1, v2, optionsOrLoose);
        case ">=":
            return gte(v1, v2, optionsOrLoose);
        case "<":
            return lt(v1, v2, optionsOrLoose);
        case "<=":
            return lte(v1, v2, optionsOrLoose);
        default:
            throw new TypeError("Invalid operator: " + operator);
    }
}
const ANY = {};
export class Comparator {
    semver;
    operator;
    value;
    loose;
    options;
    constructor(comp, optionsOrLoose){
        if (!optionsOrLoose || typeof optionsOrLoose !== "object") {
            optionsOrLoose = {
                loose: !!optionsOrLoose,
                includePrerelease: false
            };
        }
        if (comp instanceof Comparator) {
            if (comp.loose === !!optionsOrLoose.loose) {
                return comp;
            } else {
                comp = comp.value;
            }
        }
        if (!(this instanceof Comparator)) {
            return new Comparator(comp, optionsOrLoose);
        }
        this.options = optionsOrLoose;
        this.loose = !!optionsOrLoose.loose;
        this.parse(comp);
        if (this.semver === ANY) {
            this.value = "";
        } else {
            this.value = this.operator + this.semver.version;
        }
    }
    parse(comp) {
        const r = this.options.loose ? re[COMPARATORLOOSE] : re[COMPARATOR];
        const m = comp.match(r);
        if (!m) {
            throw new TypeError("Invalid comparator: " + comp);
        }
        const m1 = m[1];
        this.operator = m1 !== undefined ? m1 : "";
        if (this.operator === "=") {
            this.operator = "";
        }
        // if it literally is just '>' or '' then allow anything.
        if (!m[2]) {
            this.semver = ANY;
        } else {
            this.semver = new SemVer(m[2], this.options.loose);
        }
    }
    test(version) {
        if (this.semver === ANY || version === ANY) {
            return true;
        }
        if (typeof version === "string") {
            version = new SemVer(version, this.options);
        }
        return cmp(version, this.operator, this.semver, this.options);
    }
    intersects(comp, optionsOrLoose) {
        if (!(comp instanceof Comparator)) {
            throw new TypeError("a Comparator is required");
        }
        if (!optionsOrLoose || typeof optionsOrLoose !== "object") {
            optionsOrLoose = {
                loose: !!optionsOrLoose,
                includePrerelease: false
            };
        }
        let rangeTmp;
        if (this.operator === "") {
            if (this.value === "") {
                return true;
            }
            rangeTmp = new Range(comp.value, optionsOrLoose);
            return satisfies(this.value, rangeTmp, optionsOrLoose);
        } else if (comp.operator === "") {
            if (comp.value === "") {
                return true;
            }
            rangeTmp = new Range(this.value, optionsOrLoose);
            return satisfies(comp.semver, rangeTmp, optionsOrLoose);
        }
        const sameDirectionIncreasing = (this.operator === ">=" || this.operator === ">") && (comp.operator === ">=" || comp.operator === ">");
        const sameDirectionDecreasing = (this.operator === "<=" || this.operator === "<") && (comp.operator === "<=" || comp.operator === "<");
        const sameSemVer = this.semver.version === comp.semver.version;
        const differentDirectionsInclusive = (this.operator === ">=" || this.operator === "<=") && (comp.operator === ">=" || comp.operator === "<=");
        const oppositeDirectionsLessThan = cmp(this.semver, "<", comp.semver, optionsOrLoose) && (this.operator === ">=" || this.operator === ">") && (comp.operator === "<=" || comp.operator === "<");
        const oppositeDirectionsGreaterThan = cmp(this.semver, ">", comp.semver, optionsOrLoose) && (this.operator === "<=" || this.operator === "<") && (comp.operator === ">=" || comp.operator === ">");
        return sameDirectionIncreasing || sameDirectionDecreasing || sameSemVer && differentDirectionsInclusive || oppositeDirectionsLessThan || oppositeDirectionsGreaterThan;
    }
    toString() {
        return this.value;
    }
}
export class Range {
    range;
    raw;
    loose;
    options;
    includePrerelease;
    set;
    constructor(range, optionsOrLoose){
        if (!optionsOrLoose || typeof optionsOrLoose !== "object") {
            optionsOrLoose = {
                loose: !!optionsOrLoose,
                includePrerelease: false
            };
        }
        if (range instanceof Range) {
            if (range.loose === !!optionsOrLoose.loose && range.includePrerelease === !!optionsOrLoose.includePrerelease) {
                return range;
            } else {
                return new Range(range.raw, optionsOrLoose);
            }
        }
        if (range instanceof Comparator) {
            return new Range(range.value, optionsOrLoose);
        }
        if (!(this instanceof Range)) {
            return new Range(range, optionsOrLoose);
        }
        this.options = optionsOrLoose;
        this.loose = !!optionsOrLoose.loose;
        this.includePrerelease = !!optionsOrLoose.includePrerelease;
        // First, split based on boolean or ||
        this.raw = range;
        this.set = range.split(/\s*\|\|\s*/).map((range)=>this.parseRange(range.trim())).filter((c)=>{
            // throw out any that are not relevant for whatever reason
            return c.length;
        });
        if (!this.set.length) {
            throw new TypeError("Invalid SemVer Range: " + range);
        }
        this.format();
    }
    format() {
        this.range = this.set.map((comps)=>comps.join(" ").trim()).join("||").trim();
        return this.range;
    }
    parseRange(range) {
        const loose = this.options.loose;
        range = range.trim();
        // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
        const hr = loose ? re[HYPHENRANGELOOSE] : re[HYPHENRANGE];
        range = range.replace(hr, hyphenReplace);
        // `> 1.2.3 < 1.2.5` => `>1.2.3 <1.2.5`
        range = range.replace(re[COMPARATORTRIM], comparatorTrimReplace);
        // `~ 1.2.3` => `~1.2.3`
        range = range.replace(re[TILDETRIM], tildeTrimReplace);
        // `^ 1.2.3` => `^1.2.3`
        range = range.replace(re[CARETTRIM], caretTrimReplace);
        // normalize spaces
        range = range.split(/\s+/).join(" ");
        // At this point, the range is completely trimmed and
        // ready to be split into comparators.
        const compRe = loose ? re[COMPARATORLOOSE] : re[COMPARATOR];
        let set = range.split(" ").map((comp)=>parseComparator(comp, this.options)).join(" ").split(/\s+/);
        if (this.options.loose) {
            // in loose mode, throw out any that are not valid comparators
            set = set.filter((comp)=>{
                return !!comp.match(compRe);
            });
        }
        return set.map((comp)=>new Comparator(comp, this.options));
    }
    test(version) {
        if (typeof version === "string") {
            version = new SemVer(version, this.options);
        }
        for(var i = 0; i < this.set.length; i++){
            if (testSet(this.set[i], version, this.options)) {
                return true;
            }
        }
        return false;
    }
    intersects(range, optionsOrLoose) {
        if (!(range instanceof Range)) {
            throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators)=>{
            return isSatisfiable(thisComparators, optionsOrLoose) && range.set.some((rangeComparators)=>{
                return isSatisfiable(rangeComparators, optionsOrLoose) && thisComparators.every((thisComparator)=>{
                    return rangeComparators.every((rangeComparator)=>{
                        return thisComparator.intersects(rangeComparator, optionsOrLoose);
                    });
                });
            });
        });
    }
    toString() {
        return this.range;
    }
}
function testSet(set, version, options) {
    for(let i = 0; i < set.length; i++){
        if (!set[i].test(version)) {
            return false;
        }
    }
    if (version.prerelease.length && !options.includePrerelease) {
        // Find the set of versions that are allowed to have prereleases
        // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
        // That should allow `1.2.3-pr.2` to pass.
        // However, `1.2.4-alpha.notready` should NOT be allowed,
        // even though it's within the range set by the comparators.
        for(let i1 = 0; i1 < set.length; i1++){
            if (set[i1].semver === ANY) {
                continue;
            }
            if (set[i1].semver.prerelease.length > 0) {
                const allowed = set[i1].semver;
                if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
                    return true;
                }
            }
        }
        // Version has a -pre, but it's not one of the ones we like.
        return false;
    }
    return true;
}
// take a set of comparators and determine whether there
// exists a version which can satisfy it
function isSatisfiable(comparators, options) {
    let result = true;
    const remainingComparators = comparators.slice();
    let testComparator = remainingComparators.pop();
    while(result && remainingComparators.length){
        result = remainingComparators.every((otherComparator)=>{
            return testComparator?.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
    }
    return result;
}
// Mostly just for testing and legacy API reasons
export function toComparators(range, optionsOrLoose) {
    return new Range(range, optionsOrLoose).set.map((comp)=>{
        return comp.map((c)=>c.value).join(" ").trim().split(" ");
    });
}
// comprised of xranges, tildes, stars, and gtlt's at this point.
// already replaced the hyphen ranges
// turn into a set of JUST comparators.
function parseComparator(comp, options) {
    comp = replaceCarets(comp, options);
    comp = replaceTildes(comp, options);
    comp = replaceXRanges(comp, options);
    comp = replaceStars(comp, options);
    return comp;
}
function isX(id) {
    return !id || id.toLowerCase() === "x" || id === "*";
}
// ~, ~> --> * (any, kinda silly)
// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0
// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0
// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0
// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0
// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0
function replaceTildes(comp, options) {
    return comp.trim().split(/\s+/).map((comp)=>replaceTilde(comp, options)).join(" ");
}
function replaceTilde(comp, options) {
    const r = options.loose ? re[TILDELOOSE] : re[TILDE];
    return comp.replace(r, (_, M, m, p, pr)=>{
        let ret;
        if (isX(M)) {
            ret = "";
        } else if (isX(m)) {
            ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (isX(p)) {
            // ~1.2 == >=1.2.0 <1.3.0
            ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
        } else if (pr) {
            ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
        } else {
            // ~1.2.3 == >=1.2.3 <1.3.0
            ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
        }
        return ret;
    });
}
// ^ --> * (any, kinda silly)
// ^2, ^2.x, ^2.x.x --> >=2.0.0 <3.0.0
// ^2.0, ^2.0.x --> >=2.0.0 <3.0.0
// ^1.2, ^1.2.x --> >=1.2.0 <2.0.0
// ^1.2.3 --> >=1.2.3 <2.0.0
// ^1.2.0 --> >=1.2.0 <2.0.0
function replaceCarets(comp, options) {
    return comp.trim().split(/\s+/).map((comp)=>replaceCaret(comp, options)).join(" ");
}
function replaceCaret(comp, options) {
    const r = options.loose ? re[CARETLOOSE] : re[CARET];
    return comp.replace(r, (_, M, m, p, pr)=>{
        let ret;
        if (isX(M)) {
            ret = "";
        } else if (isX(m)) {
            ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (isX(p)) {
            if (M === "0") {
                ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
            } else {
                ret = ">=" + M + "." + m + ".0 <" + (+M + 1) + ".0.0";
            }
        } else if (pr) {
            if (M === "0") {
                if (m === "0") {
                    ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + m + "." + (+p + 1);
                } else {
                    ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
                }
            } else {
                ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + (+M + 1) + ".0.0";
            }
        } else {
            if (M === "0") {
                if (m === "0") {
                    ret = ">=" + M + "." + m + "." + p + " <" + M + "." + m + "." + (+p + 1);
                } else {
                    ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
                }
            } else {
                ret = ">=" + M + "." + m + "." + p + " <" + (+M + 1) + ".0.0";
            }
        }
        return ret;
    });
}
function replaceXRanges(comp, options) {
    return comp.split(/\s+/).map((comp)=>replaceXRange(comp, options)).join(" ");
}
function replaceXRange(comp, options) {
    comp = comp.trim();
    const r = options.loose ? re[XRANGELOOSE] : re[XRANGE];
    return comp.replace(r, (ret, gtlt, M, m, p, pr)=>{
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
            gtlt = "";
        }
        if (xM) {
            if (gtlt === ">" || gtlt === "<") {
                // nothing is allowed
                ret = "<0.0.0";
            } else {
                // nothing is forbidden
                ret = "*";
            }
        } else if (gtlt && anyX) {
            // we know patch is an x, because we have any x at all.
            // replace X with 0
            if (xm) {
                m = 0;
            }
            p = 0;
            if (gtlt === ">") {
                // >1 => >=2.0.0
                // >1.2 => >=1.3.0
                // >1.2.3 => >= 1.2.4
                gtlt = ">=";
                if (xm) {
                    M = +M + 1;
                    m = 0;
                    p = 0;
                } else {
                    m = +m + 1;
                    p = 0;
                }
            } else if (gtlt === "<=") {
                // <=0.7.x is actually <0.8.0, since any 0.7.x should
                // pass.  Similarly, <=7.x is actually <8.0.0, etc.
                gtlt = "<";
                if (xm) {
                    M = +M + 1;
                } else {
                    m = +m + 1;
                }
            }
            ret = gtlt + M + "." + m + "." + p;
        } else if (xm) {
            ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (xp) {
            ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
        }
        return ret;
    });
}
// Because * is AND-ed with everything else in the comparator,
// and '' means "any version", just remove the *s entirely.
function replaceStars(comp, options) {
    // Looseness is ignored here.  star is always as loose as it gets!
    return comp.trim().replace(re[STAR], "");
}
// This function is passed to string.replace(re[HYPHENRANGE])
// M, m, patch, prerelease, build
// 1.2 - 3.4.5 => >=1.2.0 <=3.4.5
// 1.2.3 - 3.4 => >=1.2.0 <3.5.0 Any 3.4.x will do
// 1.2 - 3.4 => >=1.2.0 <3.5.0
function hyphenReplace($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr, tb) {
    if (isX(fM)) {
        from = "";
    } else if (isX(fm)) {
        from = ">=" + fM + ".0.0";
    } else if (isX(fp)) {
        from = ">=" + fM + "." + fm + ".0";
    } else {
        from = ">=" + from;
    }
    if (isX(tM)) {
        to = "";
    } else if (isX(tm)) {
        to = "<" + (+tM + 1) + ".0.0";
    } else if (isX(tp)) {
        to = "<" + tM + "." + (+tm + 1) + ".0";
    } else if (tpr) {
        to = "<=" + tM + "." + tm + "." + tp + "-" + tpr;
    } else {
        to = "<=" + to;
    }
    return (from + " " + to).trim();
}
export function satisfies(version, range, optionsOrLoose) {
    try {
        range = new Range(range, optionsOrLoose);
    } catch (er) {
        return false;
    }
    return range.test(version);
}
export function maxSatisfying(versions, range, optionsOrLoose) {
    //todo
    var max = null;
    var maxSV = null;
    try {
        var rangeObj = new Range(range, optionsOrLoose);
    } catch (er) {
        return null;
    }
    versions.forEach((v)=>{
        if (rangeObj.test(v)) {
            // satisfies(v, range, options)
            if (!max || maxSV && maxSV.compare(v) === -1) {
                // compare(max, v, true)
                max = v;
                maxSV = new SemVer(max, optionsOrLoose);
            }
        }
    });
    return max;
}
export function minSatisfying(versions, range, optionsOrLoose) {
    //todo
    var min = null;
    var minSV = null;
    try {
        var rangeObj = new Range(range, optionsOrLoose);
    } catch (er) {
        return null;
    }
    versions.forEach((v)=>{
        if (rangeObj.test(v)) {
            // satisfies(v, range, options)
            if (!min || minSV.compare(v) === 1) {
                // compare(min, v, true)
                min = v;
                minSV = new SemVer(min, optionsOrLoose);
            }
        }
    });
    return min;
}
export function minVersion(range, optionsOrLoose) {
    range = new Range(range, optionsOrLoose);
    var minver = new SemVer("0.0.0");
    if (range.test(minver)) {
        return minver;
    }
    minver = new SemVer("0.0.0-0");
    if (range.test(minver)) {
        return minver;
    }
    minver = null;
    for(var i = 0; i < range.set.length; ++i){
        var comparators = range.set[i];
        comparators.forEach((comparator)=>{
            // Clone to avoid manipulating the comparator's semver object.
            var compver = new SemVer(comparator.semver.version);
            switch(comparator.operator){
                case ">":
                    if (compver.prerelease.length === 0) {
                        compver.patch++;
                    } else {
                        compver.prerelease.push(0);
                    }
                    compver.raw = compver.format();
                /* fallthrough */ case "":
                case ">=":
                    if (!minver || gt(minver, compver)) {
                        minver = compver;
                    }
                    break;
                case "<":
                case "<=":
                    break;
                /* istanbul ignore next */ default:
                    throw new Error("Unexpected operation: " + comparator.operator);
            }
        });
    }
    if (minver && range.test(minver)) {
        return minver;
    }
    return null;
}
export function validRange(range, optionsOrLoose) {
    try {
        if (range === null) return null;
        // Return '*' instead of '' so that truthiness works.
        // This will throw if it's invalid anyway
        return new Range(range, optionsOrLoose).range || "*";
    } catch (er) {
        return null;
    }
}
/**
 * Return true if version is less than all the versions possible in the range.
 */ export function ltr(version, range, optionsOrLoose) {
    return outside(version, range, "<", optionsOrLoose);
}
/**
 * Return true if version is greater than all the versions possible in the range.
 */ export function gtr(version, range, optionsOrLoose) {
    return outside(version, range, ">", optionsOrLoose);
}
/**
 * Return true if the version is outside the bounds of the range in either the high or low direction.
 * The hilo argument must be either the string '>' or '<'. (This is the function called by gtr and ltr.)
 */ export function outside(version, range, hilo, optionsOrLoose) {
    version = new SemVer(version, optionsOrLoose);
    range = new Range(range, optionsOrLoose);
    let gtfn;
    let ltefn;
    let ltfn;
    let comp;
    let ecomp;
    switch(hilo){
        case ">":
            gtfn = gt;
            ltefn = lte;
            ltfn = lt;
            comp = ">";
            ecomp = ">=";
            break;
        case "<":
            gtfn = lt;
            ltefn = gte;
            ltfn = gt;
            comp = "<";
            ecomp = "<=";
            break;
        default:
            throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    // If it satisifes the range it is not outside
    if (satisfies(version, range, optionsOrLoose)) {
        return false;
    }
    // From now on, variable terms are as if we're in "gtr" mode.
    // but note that everything is flipped for the "ltr" function.
    for(let i = 0; i < range.set.length; ++i){
        const comparators = range.set[i];
        let high = null;
        let low = null;
        for (let comparator of comparators){
            if (comparator.semver === ANY) {
                comparator = new Comparator(">=0.0.0");
            }
            high = high || comparator;
            low = low || comparator;
            if (gtfn(comparator.semver, high.semver, optionsOrLoose)) {
                high = comparator;
            } else if (ltfn(comparator.semver, low.semver, optionsOrLoose)) {
                low = comparator;
            }
        }
        if (high === null || low === null) return true;
        // If the edge version comparator has a operator then our version
        // isn't outside it
        if (high.operator === comp || high.operator === ecomp) {
            return false;
        }
        // If the lowest version comparator has an operator and our version
        // is less than it then it isn't higher than the range
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
            return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
            return false;
        }
    }
    return true;
}
export function prerelease(version, optionsOrLoose) {
    var parsed = parse(version, optionsOrLoose);
    return parsed && parsed.prerelease.length ? parsed.prerelease : null;
}
/**
 * Return true if any of the ranges comparators intersect
 */ export function intersects(range1, range2, optionsOrLoose) {
    range1 = new Range(range1, optionsOrLoose);
    range2 = new Range(range2, optionsOrLoose);
    return range1.intersects(range2);
}
/**
 * Coerces a string to semver if possible
 */ export function coerce(version, optionsOrLoose) {
    if (version instanceof SemVer) {
        return version;
    }
    if (typeof version !== "string") {
        return null;
    }
    const match = version.match(re[COERCE]);
    if (match == null) {
        return null;
    }
    return parse(match[1] + "." + (match[2] || "0") + "." + (match[3] || "0"), optionsOrLoose);
}
export default SemVer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc2VtdmVyQHYxLjQuMC9tb2QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHR5cGUgUmVsZWFzZVR5cGUgPVxuICB8IFwicHJlXCJcbiAgfCBcIm1ham9yXCJcbiAgfCBcInByZW1ham9yXCJcbiAgfCBcIm1pbm9yXCJcbiAgfCBcInByZW1pbm9yXCJcbiAgfCBcInBhdGNoXCJcbiAgfCBcInByZXBhdGNoXCJcbiAgfCBcInByZXJlbGVhc2VcIjtcblxuZXhwb3J0IHR5cGUgT3BlcmF0b3IgPVxuICB8IFwiPT09XCJcbiAgfCBcIiE9PVwiXG4gIHwgXCJcIlxuICB8IFwiPVwiXG4gIHwgXCI9PVwiXG4gIHwgXCIhPVwiXG4gIHwgXCI+XCJcbiAgfCBcIj49XCJcbiAgfCBcIjxcIlxuICB8IFwiPD1cIjtcblxuZXhwb3J0IGludGVyZmFjZSBPcHRpb25zIHtcbiAgbG9vc2U/OiBib29sZWFuO1xuICBpbmNsdWRlUHJlcmVsZWFzZT86IGJvb2xlYW47XG59XG5cbi8vIE5vdGU6IHRoaXMgaXMgdGhlIHNlbXZlci5vcmcgdmVyc2lvbiBvZiB0aGUgc3BlYyB0aGF0IGl0IGltcGxlbWVudHNcbi8vIE5vdCBuZWNlc3NhcmlseSB0aGUgcGFja2FnZSB2ZXJzaW9uIG9mIHRoaXMgY29kZS5cbmV4cG9ydCBjb25zdCBTRU1WRVJfU1BFQ19WRVJTSU9OID0gXCIyLjAuMFwiO1xuXG5jb25zdCBNQVhfTEVOR1RIOiBudW1iZXIgPSAyNTY7XG5cbi8vIE1heCBzYWZlIHNlZ21lbnQgbGVuZ3RoIGZvciBjb2VyY2lvbi5cbmNvbnN0IE1BWF9TQUZFX0NPTVBPTkVOVF9MRU5HVEg6IG51bWJlciA9IDE2O1xuXG4vLyBUaGUgYWN0dWFsIHJlZ2V4cHNcbmNvbnN0IHJlOiBSZWdFeHBbXSA9IFtdO1xuY29uc3Qgc3JjOiBzdHJpbmdbXSA9IFtdO1xubGV0IFI6IG51bWJlciA9IDA7XG5cbi8vIFRoZSBmb2xsb3dpbmcgUmVndWxhciBFeHByZXNzaW9ucyBjYW4gYmUgdXNlZCBmb3IgdG9rZW5pemluZyxcbi8vIHZhbGlkYXRpbmcsIGFuZCBwYXJzaW5nIFNlbVZlciB2ZXJzaW9uIHN0cmluZ3MuXG5cbi8vICMjIE51bWVyaWMgSWRlbnRpZmllclxuLy8gQSBzaW5nbGUgYDBgLCBvciBhIG5vbi16ZXJvIGRpZ2l0IGZvbGxvd2VkIGJ5IHplcm8gb3IgbW9yZSBkaWdpdHMuXG5cbmNvbnN0IE5VTUVSSUNJREVOVElGSUVSOiBudW1iZXIgPSBSKys7XG5zcmNbTlVNRVJJQ0lERU5USUZJRVJdID0gXCIwfFsxLTldXFxcXGQqXCI7XG5jb25zdCBOVU1FUklDSURFTlRJRklFUkxPT1NFOiBudW1iZXIgPSBSKys7XG5zcmNbTlVNRVJJQ0lERU5USUZJRVJMT09TRV0gPSBcIlswLTldK1wiO1xuXG4vLyAjIyBOb24tbnVtZXJpYyBJZGVudGlmaWVyXG4vLyBaZXJvIG9yIG1vcmUgZGlnaXRzLCBmb2xsb3dlZCBieSBhIGxldHRlciBvciBoeXBoZW4sIGFuZCB0aGVuIHplcm8gb3Jcbi8vIG1vcmUgbGV0dGVycywgZGlnaXRzLCBvciBoeXBoZW5zLlxuXG5jb25zdCBOT05OVU1FUklDSURFTlRJRklFUjogbnVtYmVyID0gUisrO1xuc3JjW05PTk5VTUVSSUNJREVOVElGSUVSXSA9IFwiXFxcXGQqW2EtekEtWi1dW2EtekEtWjAtOS1dKlwiO1xuXG4vLyAjIyBNYWluIFZlcnNpb25cbi8vIFRocmVlIGRvdC1zZXBhcmF0ZWQgbnVtZXJpYyBpZGVudGlmaWVycy5cblxuY29uc3QgTUFJTlZFUlNJT046IG51bWJlciA9IFIrKztcbmNvbnN0IG5pZCA9IHNyY1tOVU1FUklDSURFTlRJRklFUl07XG5zcmNbTUFJTlZFUlNJT05dID0gYCgke25pZH0pXFxcXC4oJHtuaWR9KVxcXFwuKCR7bmlkfSlgO1xuXG5jb25zdCBNQUlOVkVSU0lPTkxPT1NFOiBudW1iZXIgPSBSKys7XG5jb25zdCBuaWRsID0gc3JjW05VTUVSSUNJREVOVElGSUVSTE9PU0VdO1xuc3JjW01BSU5WRVJTSU9OTE9PU0VdID0gYCgke25pZGx9KVxcXFwuKCR7bmlkbH0pXFxcXC4oJHtuaWRsfSlgO1xuXG4vLyAjIyBQcmUtcmVsZWFzZSBWZXJzaW9uIElkZW50aWZpZXJcbi8vIEEgbnVtZXJpYyBpZGVudGlmaWVyLCBvciBhIG5vbi1udW1lcmljIGlkZW50aWZpZXIuXG5cbmNvbnN0IFBSRVJFTEVBU0VJREVOVElGSUVSOiBudW1iZXIgPSBSKys7XG5zcmNbUFJFUkVMRUFTRUlERU5USUZJRVJdID0gXCIoPzpcIiArIHNyY1tOVU1FUklDSURFTlRJRklFUl0gKyBcInxcIiArXG4gIHNyY1tOT05OVU1FUklDSURFTlRJRklFUl0gKyBcIilcIjtcblxuY29uc3QgUFJFUkVMRUFTRUlERU5USUZJRVJMT09TRTogbnVtYmVyID0gUisrO1xuc3JjW1BSRVJFTEVBU0VJREVOVElGSUVSTE9PU0VdID0gXCIoPzpcIiArIHNyY1tOVU1FUklDSURFTlRJRklFUkxPT1NFXSArIFwifFwiICtcbiAgc3JjW05PTk5VTUVSSUNJREVOVElGSUVSXSArIFwiKVwiO1xuXG4vLyAjIyBQcmUtcmVsZWFzZSBWZXJzaW9uXG4vLyBIeXBoZW4sIGZvbGxvd2VkIGJ5IG9uZSBvciBtb3JlIGRvdC1zZXBhcmF0ZWQgcHJlLXJlbGVhc2UgdmVyc2lvblxuLy8gaWRlbnRpZmllcnMuXG5cbmNvbnN0IFBSRVJFTEVBU0U6IG51bWJlciA9IFIrKztcbnNyY1tQUkVSRUxFQVNFXSA9IFwiKD86LShcIiArXG4gIHNyY1tQUkVSRUxFQVNFSURFTlRJRklFUl0gK1xuICBcIig/OlxcXFwuXCIgK1xuICBzcmNbUFJFUkVMRUFTRUlERU5USUZJRVJdICtcbiAgXCIpKikpXCI7XG5cbmNvbnN0IFBSRVJFTEVBU0VMT09TRTogbnVtYmVyID0gUisrO1xuc3JjW1BSRVJFTEVBU0VMT09TRV0gPSBcIig/Oi0/KFwiICtcbiAgc3JjW1BSRVJFTEVBU0VJREVOVElGSUVSTE9PU0VdICtcbiAgXCIoPzpcXFxcLlwiICtcbiAgc3JjW1BSRVJFTEVBU0VJREVOVElGSUVSTE9PU0VdICtcbiAgXCIpKikpXCI7XG5cbi8vICMjIEJ1aWxkIE1ldGFkYXRhIElkZW50aWZpZXJcbi8vIEFueSBjb21iaW5hdGlvbiBvZiBkaWdpdHMsIGxldHRlcnMsIG9yIGh5cGhlbnMuXG5cbmNvbnN0IEJVSUxESURFTlRJRklFUjogbnVtYmVyID0gUisrO1xuc3JjW0JVSUxESURFTlRJRklFUl0gPSBcIlswLTlBLVphLXotXStcIjtcblxuLy8gIyMgQnVpbGQgTWV0YWRhdGFcbi8vIFBsdXMgc2lnbiwgZm9sbG93ZWQgYnkgb25lIG9yIG1vcmUgcGVyaW9kLXNlcGFyYXRlZCBidWlsZCBtZXRhZGF0YVxuLy8gaWRlbnRpZmllcnMuXG5cbmNvbnN0IEJVSUxEOiBudW1iZXIgPSBSKys7XG5zcmNbQlVJTERdID0gXCIoPzpcXFxcKyhcIiArIHNyY1tCVUlMRElERU5USUZJRVJdICsgXCIoPzpcXFxcLlwiICtcbiAgc3JjW0JVSUxESURFTlRJRklFUl0gKyBcIikqKSlcIjtcblxuLy8gIyMgRnVsbCBWZXJzaW9uIFN0cmluZ1xuLy8gQSBtYWluIHZlcnNpb24sIGZvbGxvd2VkIG9wdGlvbmFsbHkgYnkgYSBwcmUtcmVsZWFzZSB2ZXJzaW9uIGFuZFxuLy8gYnVpbGQgbWV0YWRhdGEuXG5cbi8vIE5vdGUgdGhhdCB0aGUgb25seSBtYWpvciwgbWlub3IsIHBhdGNoLCBhbmQgcHJlLXJlbGVhc2Ugc2VjdGlvbnMgb2Zcbi8vIHRoZSB2ZXJzaW9uIHN0cmluZyBhcmUgY2FwdHVyaW5nIGdyb3Vwcy4gIFRoZSBidWlsZCBtZXRhZGF0YSBpcyBub3QgYVxuLy8gY2FwdHVyaW5nIGdyb3VwLCBiZWNhdXNlIGl0IHNob3VsZCBub3QgZXZlciBiZSB1c2VkIGluIHZlcnNpb25cbi8vIGNvbXBhcmlzb24uXG5cbmNvbnN0IEZVTEw6IG51bWJlciA9IFIrKztcbmNvbnN0IEZVTExQTEFJTiA9IFwidj9cIiArIHNyY1tNQUlOVkVSU0lPTl0gKyBzcmNbUFJFUkVMRUFTRV0gKyBcIj9cIiArIHNyY1tCVUlMRF0gK1xuICBcIj9cIjtcblxuc3JjW0ZVTExdID0gXCJeXCIgKyBGVUxMUExBSU4gKyBcIiRcIjtcblxuLy8gbGlrZSBmdWxsLCBidXQgYWxsb3dzIHYxLjIuMyBhbmQgPTEuMi4zLCB3aGljaCBwZW9wbGUgZG8gc29tZXRpbWVzLlxuLy8gYWxzbywgMS4wLjBhbHBoYTEgKHByZXJlbGVhc2Ugd2l0aG91dCB0aGUgaHlwaGVuKSB3aGljaCBpcyBwcmV0dHlcbi8vIGNvbW1vbiBpbiB0aGUgbnBtIHJlZ2lzdHJ5LlxuY29uc3QgTE9PU0VQTEFJTjogc3RyaW5nID0gXCJbdj1cXFxcc10qXCIgK1xuICBzcmNbTUFJTlZFUlNJT05MT09TRV0gK1xuICBzcmNbUFJFUkVMRUFTRUxPT1NFXSArXG4gIFwiP1wiICtcbiAgc3JjW0JVSUxEXSArXG4gIFwiP1wiO1xuXG5jb25zdCBMT09TRTogbnVtYmVyID0gUisrO1xuc3JjW0xPT1NFXSA9IFwiXlwiICsgTE9PU0VQTEFJTiArIFwiJFwiO1xuXG5jb25zdCBHVExUOiBudW1iZXIgPSBSKys7XG5zcmNbR1RMVF0gPSBcIigoPzo8fD4pPz0/KVwiO1xuXG4vLyBTb21ldGhpbmcgbGlrZSBcIjIuKlwiIG9yIFwiMS4yLnhcIi5cbi8vIE5vdGUgdGhhdCBcIngueFwiIGlzIGEgdmFsaWQgeFJhbmdlIGlkZW50aWZlciwgbWVhbmluZyBcImFueSB2ZXJzaW9uXCJcbi8vIE9ubHkgdGhlIGZpcnN0IGl0ZW0gaXMgc3RyaWN0bHkgcmVxdWlyZWQuXG5jb25zdCBYUkFOR0VJREVOVElGSUVSTE9PU0U6IG51bWJlciA9IFIrKztcbnNyY1tYUkFOR0VJREVOVElGSUVSTE9PU0VdID0gc3JjW05VTUVSSUNJREVOVElGSUVSTE9PU0VdICsgXCJ8eHxYfFxcXFwqXCI7XG5jb25zdCBYUkFOR0VJREVOVElGSUVSOiBudW1iZXIgPSBSKys7XG5zcmNbWFJBTkdFSURFTlRJRklFUl0gPSBzcmNbTlVNRVJJQ0lERU5USUZJRVJdICsgXCJ8eHxYfFxcXFwqXCI7XG5cbmNvbnN0IFhSQU5HRVBMQUlOOiBudW1iZXIgPSBSKys7XG5zcmNbWFJBTkdFUExBSU5dID0gXCJbdj1cXFxcc10qKFwiICtcbiAgc3JjW1hSQU5HRUlERU5USUZJRVJdICtcbiAgXCIpXCIgK1xuICBcIig/OlxcXFwuKFwiICtcbiAgc3JjW1hSQU5HRUlERU5USUZJRVJdICtcbiAgXCIpXCIgK1xuICBcIig/OlxcXFwuKFwiICtcbiAgc3JjW1hSQU5HRUlERU5USUZJRVJdICtcbiAgXCIpXCIgK1xuICBcIig/OlwiICtcbiAgc3JjW1BSRVJFTEVBU0VdICtcbiAgXCIpP1wiICtcbiAgc3JjW0JVSUxEXSArXG4gIFwiP1wiICtcbiAgXCIpPyk/XCI7XG5cbmNvbnN0IFhSQU5HRVBMQUlOTE9PU0U6IG51bWJlciA9IFIrKztcbnNyY1tYUkFOR0VQTEFJTkxPT1NFXSA9IFwiW3Y9XFxcXHNdKihcIiArXG4gIHNyY1tYUkFOR0VJREVOVElGSUVSTE9PU0VdICtcbiAgXCIpXCIgK1xuICBcIig/OlxcXFwuKFwiICtcbiAgc3JjW1hSQU5HRUlERU5USUZJRVJMT09TRV0gK1xuICBcIilcIiArXG4gIFwiKD86XFxcXC4oXCIgK1xuICBzcmNbWFJBTkdFSURFTlRJRklFUkxPT1NFXSArXG4gIFwiKVwiICtcbiAgXCIoPzpcIiArXG4gIHNyY1tQUkVSRUxFQVNFTE9PU0VdICtcbiAgXCIpP1wiICtcbiAgc3JjW0JVSUxEXSArXG4gIFwiP1wiICtcbiAgXCIpPyk/XCI7XG5cbmNvbnN0IFhSQU5HRTogbnVtYmVyID0gUisrO1xuc3JjW1hSQU5HRV0gPSBcIl5cIiArIHNyY1tHVExUXSArIFwiXFxcXHMqXCIgKyBzcmNbWFJBTkdFUExBSU5dICsgXCIkXCI7XG5jb25zdCBYUkFOR0VMT09TRSA9IFIrKztcbnNyY1tYUkFOR0VMT09TRV0gPSBcIl5cIiArIHNyY1tHVExUXSArIFwiXFxcXHMqXCIgKyBzcmNbWFJBTkdFUExBSU5MT09TRV0gKyBcIiRcIjtcblxuLy8gQ29lcmNpb24uXG4vLyBFeHRyYWN0IGFueXRoaW5nIHRoYXQgY291bGQgY29uY2VpdmFibHkgYmUgYSBwYXJ0IG9mIGEgdmFsaWQgc2VtdmVyXG5jb25zdCBDT0VSQ0U6IG51bWJlciA9IFIrKztcbnNyY1tDT0VSQ0VdID0gXCIoPzpefFteXFxcXGRdKVwiICtcbiAgXCIoXFxcXGR7MSxcIiArXG4gIE1BWF9TQUZFX0NPTVBPTkVOVF9MRU5HVEggK1xuICBcIn0pXCIgK1xuICBcIig/OlxcXFwuKFxcXFxkezEsXCIgK1xuICBNQVhfU0FGRV9DT01QT05FTlRfTEVOR1RIICtcbiAgXCJ9KSk/XCIgK1xuICBcIig/OlxcXFwuKFxcXFxkezEsXCIgK1xuICBNQVhfU0FGRV9DT01QT05FTlRfTEVOR1RIICtcbiAgXCJ9KSk/XCIgK1xuICBcIig/OiR8W15cXFxcZF0pXCI7XG5cbi8vIFRpbGRlIHJhbmdlcy5cbi8vIE1lYW5pbmcgaXMgXCJyZWFzb25hYmx5IGF0IG9yIGdyZWF0ZXIgdGhhblwiXG5jb25zdCBMT05FVElMREU6IG51bWJlciA9IFIrKztcbnNyY1tMT05FVElMREVdID0gXCIoPzp+Pj8pXCI7XG5cbmNvbnN0IFRJTERFVFJJTTogbnVtYmVyID0gUisrO1xuc3JjW1RJTERFVFJJTV0gPSBcIihcXFxccyopXCIgKyBzcmNbTE9ORVRJTERFXSArIFwiXFxcXHMrXCI7XG5yZVtUSUxERVRSSU1dID0gbmV3IFJlZ0V4cChzcmNbVElMREVUUklNXSwgXCJnXCIpO1xuY29uc3QgdGlsZGVUcmltUmVwbGFjZTogc3RyaW5nID0gXCIkMX5cIjtcblxuY29uc3QgVElMREU6IG51bWJlciA9IFIrKztcbnNyY1tUSUxERV0gPSBcIl5cIiArIHNyY1tMT05FVElMREVdICsgc3JjW1hSQU5HRVBMQUlOXSArIFwiJFwiO1xuY29uc3QgVElMREVMT09TRTogbnVtYmVyID0gUisrO1xuc3JjW1RJTERFTE9PU0VdID0gXCJeXCIgKyBzcmNbTE9ORVRJTERFXSArIHNyY1tYUkFOR0VQTEFJTkxPT1NFXSArIFwiJFwiO1xuXG4vLyBDYXJldCByYW5nZXMuXG4vLyBNZWFuaW5nIGlzIFwiYXQgbGVhc3QgYW5kIGJhY2t3YXJkcyBjb21wYXRpYmxlIHdpdGhcIlxuY29uc3QgTE9ORUNBUkVUOiBudW1iZXIgPSBSKys7XG5zcmNbTE9ORUNBUkVUXSA9IFwiKD86XFxcXF4pXCI7XG5cbmNvbnN0IENBUkVUVFJJTTogbnVtYmVyID0gUisrO1xuc3JjW0NBUkVUVFJJTV0gPSBcIihcXFxccyopXCIgKyBzcmNbTE9ORUNBUkVUXSArIFwiXFxcXHMrXCI7XG5yZVtDQVJFVFRSSU1dID0gbmV3IFJlZ0V4cChzcmNbQ0FSRVRUUklNXSwgXCJnXCIpO1xuY29uc3QgY2FyZXRUcmltUmVwbGFjZTogc3RyaW5nID0gXCIkMV5cIjtcblxuY29uc3QgQ0FSRVQ6IG51bWJlciA9IFIrKztcbnNyY1tDQVJFVF0gPSBcIl5cIiArIHNyY1tMT05FQ0FSRVRdICsgc3JjW1hSQU5HRVBMQUlOXSArIFwiJFwiO1xuY29uc3QgQ0FSRVRMT09TRTogbnVtYmVyID0gUisrO1xuc3JjW0NBUkVUTE9PU0VdID0gXCJeXCIgKyBzcmNbTE9ORUNBUkVUXSArIHNyY1tYUkFOR0VQTEFJTkxPT1NFXSArIFwiJFwiO1xuXG4vLyBBIHNpbXBsZSBndC9sdC9lcSB0aGluZywgb3IganVzdCBcIlwiIHRvIGluZGljYXRlIFwiYW55IHZlcnNpb25cIlxuY29uc3QgQ09NUEFSQVRPUkxPT1NFOiBudW1iZXIgPSBSKys7XG5zcmNbQ09NUEFSQVRPUkxPT1NFXSA9IFwiXlwiICsgc3JjW0dUTFRdICsgXCJcXFxccyooXCIgKyBMT09TRVBMQUlOICsgXCIpJHxeJFwiO1xuY29uc3QgQ09NUEFSQVRPUjogbnVtYmVyID0gUisrO1xuc3JjW0NPTVBBUkFUT1JdID0gXCJeXCIgKyBzcmNbR1RMVF0gKyBcIlxcXFxzKihcIiArIEZVTExQTEFJTiArIFwiKSR8XiRcIjtcblxuLy8gQW4gZXhwcmVzc2lvbiB0byBzdHJpcCBhbnkgd2hpdGVzcGFjZSBiZXR3ZWVuIHRoZSBndGx0IGFuZCB0aGUgdGhpbmdcbi8vIGl0IG1vZGlmaWVzLCBzbyB0aGF0IGA+IDEuMi4zYCA9PT4gYD4xLjIuM2BcbmNvbnN0IENPTVBBUkFUT1JUUklNOiBudW1iZXIgPSBSKys7XG5zcmNbQ09NUEFSQVRPUlRSSU1dID0gXCIoXFxcXHMqKVwiICsgc3JjW0dUTFRdICsgXCJcXFxccyooXCIgKyBMT09TRVBMQUlOICsgXCJ8XCIgK1xuICBzcmNbWFJBTkdFUExBSU5dICsgXCIpXCI7XG5cbi8vIHRoaXMgb25lIGhhcyB0byB1c2UgdGhlIC9nIGZsYWdcbnJlW0NPTVBBUkFUT1JUUklNXSA9IG5ldyBSZWdFeHAoc3JjW0NPTVBBUkFUT1JUUklNXSwgXCJnXCIpO1xuY29uc3QgY29tcGFyYXRvclRyaW1SZXBsYWNlOiBzdHJpbmcgPSBcIiQxJDIkM1wiO1xuXG4vLyBTb21ldGhpbmcgbGlrZSBgMS4yLjMgLSAxLjIuNGBcbi8vIE5vdGUgdGhhdCB0aGVzZSBhbGwgdXNlIHRoZSBsb29zZSBmb3JtLCBiZWNhdXNlIHRoZXknbGwgYmVcbi8vIGNoZWNrZWQgYWdhaW5zdCBlaXRoZXIgdGhlIHN0cmljdCBvciBsb29zZSBjb21wYXJhdG9yIGZvcm1cbi8vIGxhdGVyLlxuY29uc3QgSFlQSEVOUkFOR0U6IG51bWJlciA9IFIrKztcbnNyY1tIWVBIRU5SQU5HRV0gPSBcIl5cXFxccyooXCIgK1xuICBzcmNbWFJBTkdFUExBSU5dICtcbiAgXCIpXCIgK1xuICBcIlxcXFxzKy1cXFxccytcIiArXG4gIFwiKFwiICtcbiAgc3JjW1hSQU5HRVBMQUlOXSArXG4gIFwiKVwiICtcbiAgXCJcXFxccyokXCI7XG5cbmNvbnN0IEhZUEhFTlJBTkdFTE9PU0U6IG51bWJlciA9IFIrKztcbnNyY1tIWVBIRU5SQU5HRUxPT1NFXSA9IFwiXlxcXFxzKihcIiArXG4gIHNyY1tYUkFOR0VQTEFJTkxPT1NFXSArXG4gIFwiKVwiICtcbiAgXCJcXFxccystXFxcXHMrXCIgK1xuICBcIihcIiArXG4gIHNyY1tYUkFOR0VQTEFJTkxPT1NFXSArXG4gIFwiKVwiICtcbiAgXCJcXFxccyokXCI7XG5cbi8vIFN0YXIgcmFuZ2VzIGJhc2ljYWxseSBqdXN0IGFsbG93IGFueXRoaW5nIGF0IGFsbC5cbmNvbnN0IFNUQVI6IG51bWJlciA9IFIrKztcbnNyY1tTVEFSXSA9IFwiKDx8Pik/PT9cXFxccypcXFxcKlwiO1xuXG4vLyBDb21waWxlIHRvIGFjdHVhbCByZWdleHAgb2JqZWN0cy5cbi8vIEFsbCBhcmUgZmxhZy1mcmVlLCB1bmxlc3MgdGhleSB3ZXJlIGNyZWF0ZWQgYWJvdmUgd2l0aCBhIGZsYWcuXG5mb3IgKGxldCBpOiBudW1iZXIgPSAwOyBpIDwgUjsgaSsrKSB7XG4gIGlmICghcmVbaV0pIHtcbiAgICByZVtpXSA9IG5ldyBSZWdFeHAoc3JjW2ldKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2UoXG4gIHZlcnNpb246IHN0cmluZyB8IFNlbVZlciB8IG51bGwsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBTZW1WZXIgfCBudWxsIHtcbiAgaWYgKCFvcHRpb25zT3JMb29zZSB8fCB0eXBlb2Ygb3B0aW9uc09yTG9vc2UgIT09IFwib2JqZWN0XCIpIHtcbiAgICBvcHRpb25zT3JMb29zZSA9IHtcbiAgICAgIGxvb3NlOiAhIW9wdGlvbnNPckxvb3NlLFxuICAgICAgaW5jbHVkZVByZXJlbGVhc2U6IGZhbHNlLFxuICAgIH07XG4gIH1cblxuICBpZiAodmVyc2lvbiBpbnN0YW5jZW9mIFNlbVZlcikge1xuICAgIHJldHVybiB2ZXJzaW9uO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2ZXJzaW9uICE9PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBpZiAodmVyc2lvbi5sZW5ndGggPiBNQVhfTEVOR1RIKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCByOiBSZWdFeHAgPSBvcHRpb25zT3JMb29zZS5sb29zZSA/IHJlW0xPT1NFXSA6IHJlW0ZVTExdO1xuICBpZiAoIXIudGVzdCh2ZXJzaW9uKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gbmV3IFNlbVZlcih2ZXJzaW9uLCBvcHRpb25zT3JMb29zZSk7XG4gIH0gY2F0Y2ggKGVyKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkKFxuICB2ZXJzaW9uOiBzdHJpbmcgfCBTZW1WZXIgfCBudWxsLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICh2ZXJzaW9uID09PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgdjogU2VtVmVyIHwgbnVsbCA9IHBhcnNlKHZlcnNpb24sIG9wdGlvbnNPckxvb3NlKTtcbiAgcmV0dXJuIHYgPyB2LnZlcnNpb24gOiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYW4oXG4gIHZlcnNpb246IHN0cmluZyxcbiAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbik6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBzOiBTZW1WZXIgfCBudWxsID0gcGFyc2UoXG4gICAgdmVyc2lvbi50cmltKCkucmVwbGFjZSgvXls9dl0rLywgXCJcIiksXG4gICAgb3B0aW9uc09yTG9vc2UsXG4gICk7XG4gIHJldHVybiBzID8gcy52ZXJzaW9uIDogbnVsbDtcbn1cblxuZXhwb3J0IGNsYXNzIFNlbVZlciB7XG4gIHJhdyE6IHN0cmluZztcbiAgbG9vc2UhOiBib29sZWFuO1xuICBvcHRpb25zITogT3B0aW9ucztcblxuICBtYWpvciE6IG51bWJlcjtcbiAgbWlub3IhOiBudW1iZXI7XG4gIHBhdGNoITogbnVtYmVyO1xuICB2ZXJzaW9uITogc3RyaW5nO1xuICBidWlsZCE6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPjtcbiAgcHJlcmVsZWFzZSE6IEFycmF5PHN0cmluZyB8IG51bWJlcj47XG5cbiAgY29uc3RydWN0b3IodmVyc2lvbjogc3RyaW5nIHwgU2VtVmVyLCBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zT3JMb29zZSB8fCB0eXBlb2Ygb3B0aW9uc09yTG9vc2UgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgIG9wdGlvbnNPckxvb3NlID0ge1xuICAgICAgICBsb29zZTogISFvcHRpb25zT3JMb29zZSxcbiAgICAgICAgaW5jbHVkZVByZXJlbGVhc2U6IGZhbHNlLFxuICAgICAgfTtcbiAgICB9XG4gICAgaWYgKHZlcnNpb24gaW5zdGFuY2VvZiBTZW1WZXIpIHtcbiAgICAgIGlmICh2ZXJzaW9uLmxvb3NlID09PSBvcHRpb25zT3JMb29zZS5sb29zZSkge1xuICAgICAgICByZXR1cm4gdmVyc2lvbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZlcnNpb24gPSB2ZXJzaW9uLnZlcnNpb247XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmVyc2lvbiAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgVmVyc2lvbjogXCIgKyB2ZXJzaW9uKTtcbiAgICB9XG5cbiAgICBpZiAodmVyc2lvbi5sZW5ndGggPiBNQVhfTEVOR1RIKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcInZlcnNpb24gaXMgbG9uZ2VyIHRoYW4gXCIgKyBNQVhfTEVOR1RIICsgXCIgY2hhcmFjdGVyc1wiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU2VtVmVyKSkge1xuICAgICAgcmV0dXJuIG5ldyBTZW1WZXIodmVyc2lvbiwgb3B0aW9uc09yTG9vc2UpO1xuICAgIH1cblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnNPckxvb3NlO1xuICAgIHRoaXMubG9vc2UgPSAhIW9wdGlvbnNPckxvb3NlLmxvb3NlO1xuXG4gICAgY29uc3QgbSA9IHZlcnNpb24udHJpbSgpLm1hdGNoKG9wdGlvbnNPckxvb3NlLmxvb3NlID8gcmVbTE9PU0VdIDogcmVbRlVMTF0pO1xuXG4gICAgaWYgKCFtKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBWZXJzaW9uOiBcIiArIHZlcnNpb24pO1xuICAgIH1cblxuICAgIHRoaXMucmF3ID0gdmVyc2lvbjtcblxuICAgIC8vIHRoZXNlIGFyZSBhY3R1YWxseSBudW1iZXJzXG4gICAgdGhpcy5tYWpvciA9ICttWzFdO1xuICAgIHRoaXMubWlub3IgPSArbVsyXTtcbiAgICB0aGlzLnBhdGNoID0gK21bM107XG5cbiAgICBpZiAodGhpcy5tYWpvciA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSIHx8IHRoaXMubWFqb3IgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBtYWpvciB2ZXJzaW9uXCIpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm1pbm9yID4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIgfHwgdGhpcy5taW5vciA8IDApIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIG1pbm9yIHZlcnNpb25cIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucGF0Y2ggPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiB8fCB0aGlzLnBhdGNoIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgcGF0Y2ggdmVyc2lvblwiKTtcbiAgICB9XG5cbiAgICAvLyBudW1iZXJpZnkgYW55IHByZXJlbGVhc2UgbnVtZXJpYyBpZHNcbiAgICBpZiAoIW1bNF0pIHtcbiAgICAgIHRoaXMucHJlcmVsZWFzZSA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByZXJlbGVhc2UgPSBtWzRdLnNwbGl0KFwiLlwiKS5tYXAoKGlkOiBzdHJpbmcpID0+IHtcbiAgICAgICAgaWYgKC9eWzAtOV0rJC8udGVzdChpZCkpIHtcbiAgICAgICAgICBjb25zdCBudW06IG51bWJlciA9ICtpZDtcbiAgICAgICAgICBpZiAobnVtID49IDAgJiYgbnVtIDwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHtcbiAgICAgICAgICAgIHJldHVybiBudW07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpZDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuYnVpbGQgPSBtWzVdID8gbVs1XS5zcGxpdChcIi5cIikgOiBbXTtcbiAgICB0aGlzLmZvcm1hdCgpO1xuICB9XG5cbiAgZm9ybWF0KCk6IHN0cmluZyB7XG4gICAgdGhpcy52ZXJzaW9uID0gdGhpcy5tYWpvciArIFwiLlwiICsgdGhpcy5taW5vciArIFwiLlwiICsgdGhpcy5wYXRjaDtcbiAgICBpZiAodGhpcy5wcmVyZWxlYXNlLmxlbmd0aCkge1xuICAgICAgdGhpcy52ZXJzaW9uICs9IFwiLVwiICsgdGhpcy5wcmVyZWxlYXNlLmpvaW4oXCIuXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52ZXJzaW9uO1xuICB9XG5cbiAgY29tcGFyZShvdGhlcjogc3RyaW5nIHwgU2VtVmVyKTogMSB8IDAgfCAtMSB7XG4gICAgaWYgKCEob3RoZXIgaW5zdGFuY2VvZiBTZW1WZXIpKSB7XG4gICAgICBvdGhlciA9IG5ldyBTZW1WZXIob3RoZXIsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY29tcGFyZU1haW4ob3RoZXIpIHx8IHRoaXMuY29tcGFyZVByZShvdGhlcik7XG4gIH1cblxuICBjb21wYXJlTWFpbihvdGhlcjogc3RyaW5nIHwgU2VtVmVyKTogMSB8IDAgfCAtMSB7XG4gICAgaWYgKCEob3RoZXIgaW5zdGFuY2VvZiBTZW1WZXIpKSB7XG4gICAgICBvdGhlciA9IG5ldyBTZW1WZXIob3RoZXIsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIChcbiAgICAgIGNvbXBhcmVJZGVudGlmaWVycyh0aGlzLm1ham9yLCBvdGhlci5tYWpvcikgfHxcbiAgICAgIGNvbXBhcmVJZGVudGlmaWVycyh0aGlzLm1pbm9yLCBvdGhlci5taW5vcikgfHxcbiAgICAgIGNvbXBhcmVJZGVudGlmaWVycyh0aGlzLnBhdGNoLCBvdGhlci5wYXRjaClcbiAgICApO1xuICB9XG5cbiAgY29tcGFyZVByZShvdGhlcjogc3RyaW5nIHwgU2VtVmVyKTogMSB8IDAgfCAtMSB7XG4gICAgaWYgKCEob3RoZXIgaW5zdGFuY2VvZiBTZW1WZXIpKSB7XG4gICAgICBvdGhlciA9IG5ldyBTZW1WZXIob3RoZXIsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gTk9UIGhhdmluZyBhIHByZXJlbGVhc2UgaXMgPiBoYXZpbmcgb25lXG4gICAgaWYgKHRoaXMucHJlcmVsZWFzZS5sZW5ndGggJiYgIW90aGVyLnByZXJlbGVhc2UubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfSBlbHNlIGlmICghdGhpcy5wcmVyZWxlYXNlLmxlbmd0aCAmJiBvdGhlci5wcmVyZWxlYXNlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfSBlbHNlIGlmICghdGhpcy5wcmVyZWxlYXNlLmxlbmd0aCAmJiAhb3RoZXIucHJlcmVsZWFzZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGxldCBpOiBudW1iZXIgPSAwO1xuICAgIGRvIHtcbiAgICAgIGNvbnN0IGE6IHN0cmluZyB8IG51bWJlciA9IHRoaXMucHJlcmVsZWFzZVtpXTtcbiAgICAgIGNvbnN0IGI6IHN0cmluZyB8IG51bWJlciA9IG90aGVyLnByZXJlbGVhc2VbaV07XG4gICAgICBpZiAoYSA9PT0gdW5kZWZpbmVkICYmIGIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICAgIH0gZWxzZSBpZiAoYiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgICAgfSBlbHNlIGlmIChhID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfSBlbHNlIGlmIChhID09PSBiKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNvbXBhcmVJZGVudGlmaWVycyhhLCBiKTtcbiAgICAgIH1cbiAgICB9IHdoaWxlICgrK2kpO1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgY29tcGFyZUJ1aWxkKG90aGVyOiBzdHJpbmcgfCBTZW1WZXIpOiAxIHwgMCB8IC0xIHtcbiAgICBpZiAoIShvdGhlciBpbnN0YW5jZW9mIFNlbVZlcikpIHtcbiAgICAgIG90aGVyID0gbmV3IFNlbVZlcihvdGhlciwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG5cbiAgICBsZXQgaTogbnVtYmVyID0gMDtcbiAgICBkbyB7XG4gICAgICBjb25zdCBhOiBzdHJpbmcgPSB0aGlzLmJ1aWxkW2ldO1xuICAgICAgY29uc3QgYjogc3RyaW5nID0gb3RoZXIuYnVpbGRbaV07XG4gICAgICBpZiAoYSA9PT0gdW5kZWZpbmVkICYmIGIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICAgIH0gZWxzZSBpZiAoYiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgICAgfSBlbHNlIGlmIChhID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfSBlbHNlIGlmIChhID09PSBiKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNvbXBhcmVJZGVudGlmaWVycyhhLCBiKTtcbiAgICAgIH1cbiAgICB9IHdoaWxlICgrK2kpO1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgaW5jKHJlbGVhc2U6IFJlbGVhc2VUeXBlLCBpZGVudGlmaWVyPzogc3RyaW5nKTogU2VtVmVyIHtcbiAgICBzd2l0Y2ggKHJlbGVhc2UpIHtcbiAgICAgIGNhc2UgXCJwcmVtYWpvclwiOlxuICAgICAgICB0aGlzLnByZXJlbGVhc2UubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5wYXRjaCA9IDA7XG4gICAgICAgIHRoaXMubWlub3IgPSAwO1xuICAgICAgICB0aGlzLm1ham9yKys7XG4gICAgICAgIHRoaXMuaW5jKFwicHJlXCIsIGlkZW50aWZpZXIpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJwcmVtaW5vclwiOlxuICAgICAgICB0aGlzLnByZXJlbGVhc2UubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5wYXRjaCA9IDA7XG4gICAgICAgIHRoaXMubWlub3IrKztcbiAgICAgICAgdGhpcy5pbmMoXCJwcmVcIiwgaWRlbnRpZmllcik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInByZXBhdGNoXCI6XG4gICAgICAgIC8vIElmIHRoaXMgaXMgYWxyZWFkeSBhIHByZXJlbGVhc2UsIGl0IHdpbGwgYnVtcCB0byB0aGUgbmV4dCB2ZXJzaW9uXG4gICAgICAgIC8vIGRyb3AgYW55IHByZXJlbGVhc2VzIHRoYXQgbWlnaHQgYWxyZWFkeSBleGlzdCwgc2luY2UgdGhleSBhcmUgbm90XG4gICAgICAgIC8vIHJlbGV2YW50IGF0IHRoaXMgcG9pbnQuXG4gICAgICAgIHRoaXMucHJlcmVsZWFzZS5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmluYyhcInBhdGNoXCIsIGlkZW50aWZpZXIpO1xuICAgICAgICB0aGlzLmluYyhcInByZVwiLCBpZGVudGlmaWVyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBJZiB0aGUgaW5wdXQgaXMgYSBub24tcHJlcmVsZWFzZSB2ZXJzaW9uLCB0aGlzIGFjdHMgdGhlIHNhbWUgYXNcbiAgICAgIC8vIHByZXBhdGNoLlxuICAgICAgY2FzZSBcInByZXJlbGVhc2VcIjpcbiAgICAgICAgaWYgKHRoaXMucHJlcmVsZWFzZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aGlzLmluYyhcInBhdGNoXCIsIGlkZW50aWZpZXIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaW5jKFwicHJlXCIsIGlkZW50aWZpZXIpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcIm1ham9yXCI6XG4gICAgICAgIC8vIElmIHRoaXMgaXMgYSBwcmUtbWFqb3IgdmVyc2lvbiwgYnVtcCB1cCB0byB0aGUgc2FtZSBtYWpvciB2ZXJzaW9uLlxuICAgICAgICAvLyBPdGhlcndpc2UgaW5jcmVtZW50IG1ham9yLlxuICAgICAgICAvLyAxLjAuMC01IGJ1bXBzIHRvIDEuMC4wXG4gICAgICAgIC8vIDEuMS4wIGJ1bXBzIHRvIDIuMC4wXG4gICAgICAgIGlmIChcbiAgICAgICAgICB0aGlzLm1pbm9yICE9PSAwIHx8XG4gICAgICAgICAgdGhpcy5wYXRjaCAhPT0gMCB8fFxuICAgICAgICAgIHRoaXMucHJlcmVsZWFzZS5sZW5ndGggPT09IDBcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhpcy5tYWpvcisrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWlub3IgPSAwO1xuICAgICAgICB0aGlzLnBhdGNoID0gMDtcbiAgICAgICAgdGhpcy5wcmVyZWxlYXNlID0gW107XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIm1pbm9yXCI6XG4gICAgICAgIC8vIElmIHRoaXMgaXMgYSBwcmUtbWlub3IgdmVyc2lvbiwgYnVtcCB1cCB0byB0aGUgc2FtZSBtaW5vciB2ZXJzaW9uLlxuICAgICAgICAvLyBPdGhlcndpc2UgaW5jcmVtZW50IG1pbm9yLlxuICAgICAgICAvLyAxLjIuMC01IGJ1bXBzIHRvIDEuMi4wXG4gICAgICAgIC8vIDEuMi4xIGJ1bXBzIHRvIDEuMy4wXG4gICAgICAgIGlmICh0aGlzLnBhdGNoICE9PSAwIHx8IHRoaXMucHJlcmVsZWFzZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aGlzLm1pbm9yKys7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wYXRjaCA9IDA7XG4gICAgICAgIHRoaXMucHJlcmVsZWFzZSA9IFtdO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJwYXRjaFwiOlxuICAgICAgICAvLyBJZiB0aGlzIGlzIG5vdCBhIHByZS1yZWxlYXNlIHZlcnNpb24sIGl0IHdpbGwgaW5jcmVtZW50IHRoZSBwYXRjaC5cbiAgICAgICAgLy8gSWYgaXQgaXMgYSBwcmUtcmVsZWFzZSBpdCB3aWxsIGJ1bXAgdXAgdG8gdGhlIHNhbWUgcGF0Y2ggdmVyc2lvbi5cbiAgICAgICAgLy8gMS4yLjAtNSBwYXRjaGVzIHRvIDEuMi4wXG4gICAgICAgIC8vIDEuMi4wIHBhdGNoZXMgdG8gMS4yLjFcbiAgICAgICAgaWYgKHRoaXMucHJlcmVsZWFzZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aGlzLnBhdGNoKys7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcmVyZWxlYXNlID0gW107XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gVGhpcyBwcm9iYWJseSBzaG91bGRuJ3QgYmUgdXNlZCBwdWJsaWNseS5cbiAgICAgIC8vIDEuMC4wIFwicHJlXCIgd291bGQgYmVjb21lIDEuMC4wLTAgd2hpY2ggaXMgdGhlIHdyb25nIGRpcmVjdGlvbi5cbiAgICAgIGNhc2UgXCJwcmVcIjpcbiAgICAgICAgaWYgKHRoaXMucHJlcmVsZWFzZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aGlzLnByZXJlbGVhc2UgPSBbMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGk6IG51bWJlciA9IHRoaXMucHJlcmVsZWFzZS5sZW5ndGg7XG4gICAgICAgICAgd2hpbGUgKC0taSA+PSAwKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMucHJlcmVsZWFzZVtpXSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAodGhpcy5wcmVyZWxlYXNlW2ldIGFzIG51bWJlcikrKztcbiAgICAgICAgICAgICAgaSA9IC0yO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICAgIC8vIGRpZG4ndCBpbmNyZW1lbnQgYW55dGhpbmdcbiAgICAgICAgICAgIHRoaXMucHJlcmVsZWFzZS5wdXNoKDApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaWRlbnRpZmllcikge1xuICAgICAgICAgIC8vIDEuMi4wLWJldGEuMSBidW1wcyB0byAxLjIuMC1iZXRhLjIsXG4gICAgICAgICAgLy8gMS4yLjAtYmV0YS5mb29ibHogb3IgMS4yLjAtYmV0YSBidW1wcyB0byAxLjIuMC1iZXRhLjBcbiAgICAgICAgICBpZiAodGhpcy5wcmVyZWxlYXNlWzBdID09PSBpZGVudGlmaWVyKSB7XG4gICAgICAgICAgICBpZiAoaXNOYU4odGhpcy5wcmVyZWxlYXNlWzFdIGFzIG51bWJlcikpIHtcbiAgICAgICAgICAgICAgdGhpcy5wcmVyZWxlYXNlID0gW2lkZW50aWZpZXIsIDBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnByZXJlbGVhc2UgPSBbaWRlbnRpZmllciwgMF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIGluY3JlbWVudCBhcmd1bWVudDogXCIgKyByZWxlYXNlKTtcbiAgICB9XG4gICAgdGhpcy5mb3JtYXQoKTtcbiAgICB0aGlzLnJhdyA9IHRoaXMudmVyc2lvbjtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMudmVyc2lvbjtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybiB0aGUgdmVyc2lvbiBpbmNyZW1lbnRlZCBieSB0aGUgcmVsZWFzZSB0eXBlIChtYWpvciwgbWlub3IsIHBhdGNoLCBvciBwcmVyZWxlYXNlKSwgb3IgbnVsbCBpZiBpdCdzIG5vdCB2YWxpZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluYyhcbiAgdmVyc2lvbjogc3RyaW5nIHwgU2VtVmVyLFxuICByZWxlYXNlOiBSZWxlYXNlVHlwZSxcbiAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbiAgaWRlbnRpZmllcj86IHN0cmluZyxcbik6IHN0cmluZyB8IG51bGwge1xuICBpZiAodHlwZW9mIG9wdGlvbnNPckxvb3NlID09PSBcInN0cmluZ1wiKSB7XG4gICAgaWRlbnRpZmllciA9IG9wdGlvbnNPckxvb3NlO1xuICAgIG9wdGlvbnNPckxvb3NlID0gdW5kZWZpbmVkO1xuICB9XG4gIHRyeSB7XG4gICAgcmV0dXJuIG5ldyBTZW1WZXIodmVyc2lvbiwgb3B0aW9uc09yTG9vc2UpLmluYyhyZWxlYXNlLCBpZGVudGlmaWVyKS52ZXJzaW9uO1xuICB9IGNhdGNoIChlcikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkaWZmKFxuICB2ZXJzaW9uMTogc3RyaW5nIHwgU2VtVmVyLFxuICB2ZXJzaW9uMjogc3RyaW5nIHwgU2VtVmVyLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogUmVsZWFzZVR5cGUgfCBudWxsIHtcbiAgaWYgKGVxKHZlcnNpb24xLCB2ZXJzaW9uMiwgb3B0aW9uc09yTG9vc2UpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgdjE6IFNlbVZlciB8IG51bGwgPSBwYXJzZSh2ZXJzaW9uMSk7XG4gICAgY29uc3QgdjI6IFNlbVZlciB8IG51bGwgPSBwYXJzZSh2ZXJzaW9uMik7XG4gICAgbGV0IHByZWZpeDogc3RyaW5nID0gXCJcIjtcbiAgICBsZXQgZGVmYXVsdFJlc3VsdDogUmVsZWFzZVR5cGUgfCBudWxsID0gbnVsbDtcblxuICAgIGlmICh2MSAmJiB2Mikge1xuICAgICAgaWYgKHYxLnByZXJlbGVhc2UubGVuZ3RoIHx8IHYyLnByZXJlbGVhc2UubGVuZ3RoKSB7XG4gICAgICAgIHByZWZpeCA9IFwicHJlXCI7XG4gICAgICAgIGRlZmF1bHRSZXN1bHQgPSBcInByZXJlbGVhc2VcIjtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBrZXkgaW4gdjEpIHtcbiAgICAgICAgaWYgKGtleSA9PT0gXCJtYWpvclwiIHx8IGtleSA9PT0gXCJtaW5vclwiIHx8IGtleSA9PT0gXCJwYXRjaFwiKSB7XG4gICAgICAgICAgaWYgKHYxW2tleV0gIT09IHYyW2tleV0pIHtcbiAgICAgICAgICAgIHJldHVybiAocHJlZml4ICsga2V5KSBhcyBSZWxlYXNlVHlwZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlZmF1bHRSZXN1bHQ7IC8vIG1heSBiZSB1bmRlZmluZWRcbiAgfVxufVxuXG5jb25zdCBudW1lcmljOiBSZWdFeHAgPSAvXlswLTldKyQvO1xuXG5leHBvcnQgZnVuY3Rpb24gY29tcGFyZUlkZW50aWZpZXJzKFxuICBhOiBzdHJpbmcgfCBudW1iZXIgfCBudWxsLFxuICBiOiBzdHJpbmcgfCBudW1iZXIgfCBudWxsLFxuKTogMSB8IDAgfCAtMSB7XG4gIGNvbnN0IGFudW06IGJvb2xlYW4gPSBudW1lcmljLnRlc3QoYSBhcyBzdHJpbmcpO1xuICBjb25zdCBibnVtOiBib29sZWFuID0gbnVtZXJpYy50ZXN0KGIgYXMgc3RyaW5nKTtcblxuICBpZiAoYSA9PT0gbnVsbCB8fCBiID09PSBudWxsKSB0aHJvdyBcIkNvbXBhcmlzb24gYWdhaW5zdCBudWxsIGludmFsaWRcIjtcblxuICBpZiAoYW51bSAmJiBibnVtKSB7XG4gICAgYSA9ICthO1xuICAgIGIgPSArYjtcbiAgfVxuXG4gIHJldHVybiBhID09PSBiID8gMCA6IGFudW0gJiYgIWJudW0gPyAtMSA6IGJudW0gJiYgIWFudW0gPyAxIDogYSA8IGIgPyAtMSA6IDE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByY29tcGFyZUlkZW50aWZpZXJzKFxuICBhOiBzdHJpbmcgfCBudWxsLFxuICBiOiBzdHJpbmcgfCBudWxsLFxuKTogMSB8IDAgfCAtMSB7XG4gIHJldHVybiBjb21wYXJlSWRlbnRpZmllcnMoYiwgYSk7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBtYWpvciB2ZXJzaW9uIG51bWJlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ham9yKFxuICB2OiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBudW1iZXIge1xuICByZXR1cm4gbmV3IFNlbVZlcih2LCBvcHRpb25zT3JMb29zZSkubWFqb3I7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBtaW5vciB2ZXJzaW9uIG51bWJlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbm9yKFxuICB2OiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBudW1iZXIge1xuICByZXR1cm4gbmV3IFNlbVZlcih2LCBvcHRpb25zT3JMb29zZSkubWlub3I7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwYXRjaCB2ZXJzaW9uIG51bWJlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoKFxuICB2OiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBudW1iZXIge1xuICByZXR1cm4gbmV3IFNlbVZlcih2LCBvcHRpb25zT3JMb29zZSkucGF0Y2g7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wYXJlKFxuICB2MTogc3RyaW5nIHwgU2VtVmVyLFxuICB2Mjogc3RyaW5nIHwgU2VtVmVyLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogMSB8IDAgfCAtMSB7XG4gIHJldHVybiBuZXcgU2VtVmVyKHYxLCBvcHRpb25zT3JMb29zZSkuY29tcGFyZShuZXcgU2VtVmVyKHYyLCBvcHRpb25zT3JMb29zZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGFyZUxvb3NlKFxuICBhOiBzdHJpbmcgfCBTZW1WZXIsXG4gIGI6IHN0cmluZyB8IFNlbVZlcixcbik6IDEgfCAwIHwgLTEge1xuICByZXR1cm4gY29tcGFyZShhLCBiLCB0cnVlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhcmVCdWlsZChcbiAgYTogc3RyaW5nIHwgU2VtVmVyLFxuICBiOiBzdHJpbmcgfCBTZW1WZXIsXG4gIGxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiAxIHwgMCB8IC0xIHtcbiAgdmFyIHZlcnNpb25BID0gbmV3IFNlbVZlcihhLCBsb29zZSk7XG4gIHZhciB2ZXJzaW9uQiA9IG5ldyBTZW1WZXIoYiwgbG9vc2UpO1xuICByZXR1cm4gdmVyc2lvbkEuY29tcGFyZSh2ZXJzaW9uQikgfHwgdmVyc2lvbkEuY29tcGFyZUJ1aWxkKHZlcnNpb25CKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJjb21wYXJlKFxuICB2MTogc3RyaW5nIHwgU2VtVmVyLFxuICB2Mjogc3RyaW5nIHwgU2VtVmVyLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogMSB8IDAgfCAtMSB7XG4gIHJldHVybiBjb21wYXJlKHYyLCB2MSwgb3B0aW9uc09yTG9vc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc29ydDxUIGV4dGVuZHMgc3RyaW5nIHwgU2VtVmVyPihcbiAgbGlzdDogVFtdLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogVFtdIHtcbiAgcmV0dXJuIGxpc3Quc29ydCgoYSwgYikgPT4ge1xuICAgIHJldHVybiBjb21wYXJlQnVpbGQoYSwgYiwgb3B0aW9uc09yTG9vc2UpO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJzb3J0PFQgZXh0ZW5kcyBzdHJpbmcgfCBTZW1WZXI+KFxuICBsaXN0OiBUW10sXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBUW10ge1xuICByZXR1cm4gbGlzdC5zb3J0KChhLCBiKSA9PiB7XG4gICAgcmV0dXJuIGNvbXBhcmVCdWlsZChiLCBhLCBvcHRpb25zT3JMb29zZSk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ3QoXG4gIHYxOiBzdHJpbmcgfCBTZW1WZXIsXG4gIHYyOiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvbXBhcmUodjEsIHYyLCBvcHRpb25zT3JMb29zZSkgPiAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbHQoXG4gIHYxOiBzdHJpbmcgfCBTZW1WZXIsXG4gIHYyOiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvbXBhcmUodjEsIHYyLCBvcHRpb25zT3JMb29zZSkgPCAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXEoXG4gIHYxOiBzdHJpbmcgfCBTZW1WZXIsXG4gIHYyOiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvbXBhcmUodjEsIHYyLCBvcHRpb25zT3JMb29zZSkgPT09IDA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXEoXG4gIHYxOiBzdHJpbmcgfCBTZW1WZXIsXG4gIHYyOiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvbXBhcmUodjEsIHYyLCBvcHRpb25zT3JMb29zZSkgIT09IDA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBndGUoXG4gIHYxOiBzdHJpbmcgfCBTZW1WZXIsXG4gIHYyOiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvbXBhcmUodjEsIHYyLCBvcHRpb25zT3JMb29zZSkgPj0gMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGx0ZShcbiAgdjE6IHN0cmluZyB8IFNlbVZlcixcbiAgdjI6IHN0cmluZyB8IFNlbVZlcixcbiAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29tcGFyZSh2MSwgdjIsIG9wdGlvbnNPckxvb3NlKSA8PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY21wKFxuICB2MTogc3RyaW5nIHwgU2VtVmVyLFxuICBvcGVyYXRvcjogT3BlcmF0b3IsXG4gIHYyOiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgIGNhc2UgXCI9PT1cIjpcbiAgICAgIGlmICh0eXBlb2YgdjEgPT09IFwib2JqZWN0XCIpIHYxID0gdjEudmVyc2lvbjtcbiAgICAgIGlmICh0eXBlb2YgdjIgPT09IFwib2JqZWN0XCIpIHYyID0gdjIudmVyc2lvbjtcbiAgICAgIHJldHVybiB2MSA9PT0gdjI7XG5cbiAgICBjYXNlIFwiIT09XCI6XG4gICAgICBpZiAodHlwZW9mIHYxID09PSBcIm9iamVjdFwiKSB2MSA9IHYxLnZlcnNpb247XG4gICAgICBpZiAodHlwZW9mIHYyID09PSBcIm9iamVjdFwiKSB2MiA9IHYyLnZlcnNpb247XG4gICAgICByZXR1cm4gdjEgIT09IHYyO1xuXG4gICAgY2FzZSBcIlwiOlxuICAgIGNhc2UgXCI9XCI6XG4gICAgY2FzZSBcIj09XCI6XG4gICAgICByZXR1cm4gZXEodjEsIHYyLCBvcHRpb25zT3JMb29zZSk7XG5cbiAgICBjYXNlIFwiIT1cIjpcbiAgICAgIHJldHVybiBuZXEodjEsIHYyLCBvcHRpb25zT3JMb29zZSk7XG5cbiAgICBjYXNlIFwiPlwiOlxuICAgICAgcmV0dXJuIGd0KHYxLCB2Miwgb3B0aW9uc09yTG9vc2UpO1xuXG4gICAgY2FzZSBcIj49XCI6XG4gICAgICByZXR1cm4gZ3RlKHYxLCB2Miwgb3B0aW9uc09yTG9vc2UpO1xuXG4gICAgY2FzZSBcIjxcIjpcbiAgICAgIHJldHVybiBsdCh2MSwgdjIsIG9wdGlvbnNPckxvb3NlKTtcblxuICAgIGNhc2UgXCI8PVwiOlxuICAgICAgcmV0dXJuIGx0ZSh2MSwgdjIsIG9wdGlvbnNPckxvb3NlKTtcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBvcGVyYXRvcjogXCIgKyBvcGVyYXRvcik7XG4gIH1cbn1cblxuY29uc3QgQU5ZOiBTZW1WZXIgPSB7fSBhcyBTZW1WZXI7XG5cbmV4cG9ydCBjbGFzcyBDb21wYXJhdG9yIHtcbiAgc2VtdmVyITogU2VtVmVyO1xuICBvcGVyYXRvciE6IFwiXCIgfCBcIj1cIiB8IFwiPFwiIHwgXCI+XCIgfCBcIjw9XCIgfCBcIj49XCI7XG4gIHZhbHVlITogc3RyaW5nO1xuICBsb29zZSE6IGJvb2xlYW47XG4gIG9wdGlvbnMhOiBPcHRpb25zO1xuXG4gIGNvbnN0cnVjdG9yKGNvbXA6IHN0cmluZyB8IENvbXBhcmF0b3IsIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnNPckxvb3NlIHx8IHR5cGVvZiBvcHRpb25zT3JMb29zZSAhPT0gXCJvYmplY3RcIikge1xuICAgICAgb3B0aW9uc09yTG9vc2UgPSB7XG4gICAgICAgIGxvb3NlOiAhIW9wdGlvbnNPckxvb3NlLFxuICAgICAgICBpbmNsdWRlUHJlcmVsZWFzZTogZmFsc2UsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChjb21wIGluc3RhbmNlb2YgQ29tcGFyYXRvcikge1xuICAgICAgaWYgKGNvbXAubG9vc2UgPT09ICEhb3B0aW9uc09yTG9vc2UubG9vc2UpIHtcbiAgICAgICAgcmV0dXJuIGNvbXA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21wID0gY29tcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ29tcGFyYXRvcikpIHtcbiAgICAgIHJldHVybiBuZXcgQ29tcGFyYXRvcihjb21wLCBvcHRpb25zT3JMb29zZSk7XG4gICAgfVxuXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9uc09yTG9vc2U7XG4gICAgdGhpcy5sb29zZSA9ICEhb3B0aW9uc09yTG9vc2UubG9vc2U7XG4gICAgdGhpcy5wYXJzZShjb21wKTtcblxuICAgIGlmICh0aGlzLnNlbXZlciA9PT0gQU5ZKSB7XG4gICAgICB0aGlzLnZhbHVlID0gXCJcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52YWx1ZSA9IHRoaXMub3BlcmF0b3IgKyB0aGlzLnNlbXZlci52ZXJzaW9uO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlKGNvbXA6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHIgPSB0aGlzLm9wdGlvbnMubG9vc2UgPyByZVtDT01QQVJBVE9STE9PU0VdIDogcmVbQ09NUEFSQVRPUl07XG4gICAgY29uc3QgbSA9IGNvbXAubWF0Y2gocik7XG5cbiAgICBpZiAoIW0pIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGNvbXBhcmF0b3I6IFwiICsgY29tcCk7XG4gICAgfVxuXG4gICAgY29uc3QgbTEgPSBtWzFdIGFzIFwiXCIgfCBcIj1cIiB8IFwiPFwiIHwgXCI+XCIgfCBcIjw9XCIgfCBcIj49XCI7XG4gICAgdGhpcy5vcGVyYXRvciA9IG0xICE9PSB1bmRlZmluZWQgPyBtMSA6IFwiXCI7XG5cbiAgICBpZiAodGhpcy5vcGVyYXRvciA9PT0gXCI9XCIpIHtcbiAgICAgIHRoaXMub3BlcmF0b3IgPSBcIlwiO1xuICAgIH1cblxuICAgIC8vIGlmIGl0IGxpdGVyYWxseSBpcyBqdXN0ICc+JyBvciAnJyB0aGVuIGFsbG93IGFueXRoaW5nLlxuICAgIGlmICghbVsyXSkge1xuICAgICAgdGhpcy5zZW12ZXIgPSBBTlk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VtdmVyID0gbmV3IFNlbVZlcihtWzJdLCB0aGlzLm9wdGlvbnMubG9vc2UpO1xuICAgIH1cbiAgfVxuXG4gIHRlc3QodmVyc2lvbjogc3RyaW5nIHwgU2VtVmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuc2VtdmVyID09PSBBTlkgfHwgdmVyc2lvbiA9PT0gQU5ZKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHZlcnNpb24gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHZlcnNpb24gPSBuZXcgU2VtVmVyKHZlcnNpb24sIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNtcCh2ZXJzaW9uLCB0aGlzLm9wZXJhdG9yLCB0aGlzLnNlbXZlciwgdGhpcy5vcHRpb25zKTtcbiAgfVxuXG4gIGludGVyc2VjdHMoY29tcDogQ29tcGFyYXRvciwgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyk6IGJvb2xlYW4ge1xuICAgIGlmICghKGNvbXAgaW5zdGFuY2VvZiBDb21wYXJhdG9yKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImEgQ29tcGFyYXRvciBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnNPckxvb3NlIHx8IHR5cGVvZiBvcHRpb25zT3JMb29zZSAhPT0gXCJvYmplY3RcIikge1xuICAgICAgb3B0aW9uc09yTG9vc2UgPSB7XG4gICAgICAgIGxvb3NlOiAhIW9wdGlvbnNPckxvb3NlLFxuICAgICAgICBpbmNsdWRlUHJlcmVsZWFzZTogZmFsc2UsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGxldCByYW5nZVRtcDogUmFuZ2U7XG5cbiAgICBpZiAodGhpcy5vcGVyYXRvciA9PT0gXCJcIikge1xuICAgICAgaWYgKHRoaXMudmFsdWUgPT09IFwiXCIpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICByYW5nZVRtcCA9IG5ldyBSYW5nZShjb21wLnZhbHVlLCBvcHRpb25zT3JMb29zZSk7XG4gICAgICByZXR1cm4gc2F0aXNmaWVzKHRoaXMudmFsdWUsIHJhbmdlVG1wLCBvcHRpb25zT3JMb29zZSk7XG4gICAgfSBlbHNlIGlmIChjb21wLm9wZXJhdG9yID09PSBcIlwiKSB7XG4gICAgICBpZiAoY29tcC52YWx1ZSA9PT0gXCJcIikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJhbmdlVG1wID0gbmV3IFJhbmdlKHRoaXMudmFsdWUsIG9wdGlvbnNPckxvb3NlKTtcbiAgICAgIHJldHVybiBzYXRpc2ZpZXMoY29tcC5zZW12ZXIsIHJhbmdlVG1wLCBvcHRpb25zT3JMb29zZSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2FtZURpcmVjdGlvbkluY3JlYXNpbmc6IGJvb2xlYW4gPVxuICAgICAgKHRoaXMub3BlcmF0b3IgPT09IFwiPj1cIiB8fCB0aGlzLm9wZXJhdG9yID09PSBcIj5cIikgJiZcbiAgICAgIChjb21wLm9wZXJhdG9yID09PSBcIj49XCIgfHwgY29tcC5vcGVyYXRvciA9PT0gXCI+XCIpO1xuICAgIGNvbnN0IHNhbWVEaXJlY3Rpb25EZWNyZWFzaW5nOiBib29sZWFuID1cbiAgICAgICh0aGlzLm9wZXJhdG9yID09PSBcIjw9XCIgfHwgdGhpcy5vcGVyYXRvciA9PT0gXCI8XCIpICYmXG4gICAgICAoY29tcC5vcGVyYXRvciA9PT0gXCI8PVwiIHx8IGNvbXAub3BlcmF0b3IgPT09IFwiPFwiKTtcbiAgICBjb25zdCBzYW1lU2VtVmVyOiBib29sZWFuID0gdGhpcy5zZW12ZXIudmVyc2lvbiA9PT0gY29tcC5zZW12ZXIudmVyc2lvbjtcbiAgICBjb25zdCBkaWZmZXJlbnREaXJlY3Rpb25zSW5jbHVzaXZlOiBib29sZWFuID1cbiAgICAgICh0aGlzLm9wZXJhdG9yID09PSBcIj49XCIgfHwgdGhpcy5vcGVyYXRvciA9PT0gXCI8PVwiKSAmJlxuICAgICAgKGNvbXAub3BlcmF0b3IgPT09IFwiPj1cIiB8fCBjb21wLm9wZXJhdG9yID09PSBcIjw9XCIpO1xuICAgIGNvbnN0IG9wcG9zaXRlRGlyZWN0aW9uc0xlc3NUaGFuOiBib29sZWFuID1cbiAgICAgIGNtcCh0aGlzLnNlbXZlciwgXCI8XCIsIGNvbXAuc2VtdmVyLCBvcHRpb25zT3JMb29zZSkgJiZcbiAgICAgICh0aGlzLm9wZXJhdG9yID09PSBcIj49XCIgfHwgdGhpcy5vcGVyYXRvciA9PT0gXCI+XCIpICYmXG4gICAgICAoY29tcC5vcGVyYXRvciA9PT0gXCI8PVwiIHx8IGNvbXAub3BlcmF0b3IgPT09IFwiPFwiKTtcbiAgICBjb25zdCBvcHBvc2l0ZURpcmVjdGlvbnNHcmVhdGVyVGhhbjogYm9vbGVhbiA9XG4gICAgICBjbXAodGhpcy5zZW12ZXIsIFwiPlwiLCBjb21wLnNlbXZlciwgb3B0aW9uc09yTG9vc2UpICYmXG4gICAgICAodGhpcy5vcGVyYXRvciA9PT0gXCI8PVwiIHx8IHRoaXMub3BlcmF0b3IgPT09IFwiPFwiKSAmJlxuICAgICAgKGNvbXAub3BlcmF0b3IgPT09IFwiPj1cIiB8fCBjb21wLm9wZXJhdG9yID09PSBcIj5cIik7XG5cbiAgICByZXR1cm4gKFxuICAgICAgc2FtZURpcmVjdGlvbkluY3JlYXNpbmcgfHxcbiAgICAgIHNhbWVEaXJlY3Rpb25EZWNyZWFzaW5nIHx8XG4gICAgICAoc2FtZVNlbVZlciAmJiBkaWZmZXJlbnREaXJlY3Rpb25zSW5jbHVzaXZlKSB8fFxuICAgICAgb3Bwb3NpdGVEaXJlY3Rpb25zTGVzc1RoYW4gfHxcbiAgICAgIG9wcG9zaXRlRGlyZWN0aW9uc0dyZWF0ZXJUaGFuXG4gICAgKTtcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJhbmdlIHtcbiAgcmFuZ2UhOiBzdHJpbmc7XG4gIHJhdyE6IHN0cmluZztcbiAgbG9vc2UhOiBib29sZWFuO1xuICBvcHRpb25zITogT3B0aW9ucztcbiAgaW5jbHVkZVByZXJlbGVhc2UhOiBib29sZWFuO1xuICBzZXQhOiBSZWFkb25seUFycmF5PFJlYWRvbmx5QXJyYXk8Q29tcGFyYXRvcj4+O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHJhbmdlOiBzdHJpbmcgfCBSYW5nZSB8IENvbXBhcmF0b3IsXG4gICAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbiAgKSB7XG4gICAgaWYgKCFvcHRpb25zT3JMb29zZSB8fCB0eXBlb2Ygb3B0aW9uc09yTG9vc2UgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgIG9wdGlvbnNPckxvb3NlID0ge1xuICAgICAgICBsb29zZTogISFvcHRpb25zT3JMb29zZSxcbiAgICAgICAgaW5jbHVkZVByZXJlbGVhc2U6IGZhbHNlLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAocmFuZ2UgaW5zdGFuY2VvZiBSYW5nZSkge1xuICAgICAgaWYgKFxuICAgICAgICByYW5nZS5sb29zZSA9PT0gISFvcHRpb25zT3JMb29zZS5sb29zZSAmJlxuICAgICAgICByYW5nZS5pbmNsdWRlUHJlcmVsZWFzZSA9PT0gISFvcHRpb25zT3JMb29zZS5pbmNsdWRlUHJlcmVsZWFzZVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgUmFuZ2UocmFuZ2UucmF3LCBvcHRpb25zT3JMb29zZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJhbmdlIGluc3RhbmNlb2YgQ29tcGFyYXRvcikge1xuICAgICAgcmV0dXJuIG5ldyBSYW5nZShyYW5nZS52YWx1ZSwgb3B0aW9uc09yTG9vc2UpO1xuICAgIH1cblxuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSYW5nZSkpIHtcbiAgICAgIHJldHVybiBuZXcgUmFuZ2UocmFuZ2UsIG9wdGlvbnNPckxvb3NlKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zT3JMb29zZTtcbiAgICB0aGlzLmxvb3NlID0gISFvcHRpb25zT3JMb29zZS5sb29zZTtcbiAgICB0aGlzLmluY2x1ZGVQcmVyZWxlYXNlID0gISFvcHRpb25zT3JMb29zZS5pbmNsdWRlUHJlcmVsZWFzZTtcblxuICAgIC8vIEZpcnN0LCBzcGxpdCBiYXNlZCBvbiBib29sZWFuIG9yIHx8XG4gICAgdGhpcy5yYXcgPSByYW5nZTtcbiAgICB0aGlzLnNldCA9IHJhbmdlXG4gICAgICAuc3BsaXQoL1xccypcXHxcXHxcXHMqLylcbiAgICAgIC5tYXAoKHJhbmdlKSA9PiB0aGlzLnBhcnNlUmFuZ2UocmFuZ2UudHJpbSgpKSlcbiAgICAgIC5maWx0ZXIoKGMpID0+IHtcbiAgICAgICAgLy8gdGhyb3cgb3V0IGFueSB0aGF0IGFyZSBub3QgcmVsZXZhbnQgZm9yIHdoYXRldmVyIHJlYXNvblxuICAgICAgICByZXR1cm4gYy5sZW5ndGg7XG4gICAgICB9KTtcblxuICAgIGlmICghdGhpcy5zZXQubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBTZW1WZXIgUmFuZ2U6IFwiICsgcmFuZ2UpO1xuICAgIH1cblxuICAgIHRoaXMuZm9ybWF0KCk7XG4gIH1cblxuICBmb3JtYXQoKTogc3RyaW5nIHtcbiAgICB0aGlzLnJhbmdlID0gdGhpcy5zZXRcbiAgICAgIC5tYXAoKGNvbXBzKSA9PiBjb21wcy5qb2luKFwiIFwiKS50cmltKCkpXG4gICAgICAuam9pbihcInx8XCIpXG4gICAgICAudHJpbSgpO1xuICAgIHJldHVybiB0aGlzLnJhbmdlO1xuICB9XG5cbiAgcGFyc2VSYW5nZShyYW5nZTogc3RyaW5nKTogUmVhZG9ubHlBcnJheTxDb21wYXJhdG9yPiB7XG4gICAgY29uc3QgbG9vc2UgPSB0aGlzLm9wdGlvbnMubG9vc2U7XG4gICAgcmFuZ2UgPSByYW5nZS50cmltKCk7XG4gICAgLy8gYDEuMi4zIC0gMS4yLjRgID0+IGA+PTEuMi4zIDw9MS4yLjRgXG4gICAgY29uc3QgaHI6IFJlZ0V4cCA9IGxvb3NlID8gcmVbSFlQSEVOUkFOR0VMT09TRV0gOiByZVtIWVBIRU5SQU5HRV07XG4gICAgcmFuZ2UgPSByYW5nZS5yZXBsYWNlKGhyLCBoeXBoZW5SZXBsYWNlKTtcblxuICAgIC8vIGA+IDEuMi4zIDwgMS4yLjVgID0+IGA+MS4yLjMgPDEuMi41YFxuICAgIHJhbmdlID0gcmFuZ2UucmVwbGFjZShyZVtDT01QQVJBVE9SVFJJTV0sIGNvbXBhcmF0b3JUcmltUmVwbGFjZSk7XG5cbiAgICAvLyBgfiAxLjIuM2AgPT4gYH4xLjIuM2BcbiAgICByYW5nZSA9IHJhbmdlLnJlcGxhY2UocmVbVElMREVUUklNXSwgdGlsZGVUcmltUmVwbGFjZSk7XG5cbiAgICAvLyBgXiAxLjIuM2AgPT4gYF4xLjIuM2BcbiAgICByYW5nZSA9IHJhbmdlLnJlcGxhY2UocmVbQ0FSRVRUUklNXSwgY2FyZXRUcmltUmVwbGFjZSk7XG5cbiAgICAvLyBub3JtYWxpemUgc3BhY2VzXG4gICAgcmFuZ2UgPSByYW5nZS5zcGxpdCgvXFxzKy8pLmpvaW4oXCIgXCIpO1xuXG4gICAgLy8gQXQgdGhpcyBwb2ludCwgdGhlIHJhbmdlIGlzIGNvbXBsZXRlbHkgdHJpbW1lZCBhbmRcbiAgICAvLyByZWFkeSB0byBiZSBzcGxpdCBpbnRvIGNvbXBhcmF0b3JzLlxuXG4gICAgY29uc3QgY29tcFJlOiBSZWdFeHAgPSBsb29zZSA/IHJlW0NPTVBBUkFUT1JMT09TRV0gOiByZVtDT01QQVJBVE9SXTtcbiAgICBsZXQgc2V0OiBzdHJpbmdbXSA9IHJhbmdlXG4gICAgICAuc3BsaXQoXCIgXCIpXG4gICAgICAubWFwKChjb21wKSA9PiBwYXJzZUNvbXBhcmF0b3IoY29tcCwgdGhpcy5vcHRpb25zKSlcbiAgICAgIC5qb2luKFwiIFwiKVxuICAgICAgLnNwbGl0KC9cXHMrLyk7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5sb29zZSkge1xuICAgICAgLy8gaW4gbG9vc2UgbW9kZSwgdGhyb3cgb3V0IGFueSB0aGF0IGFyZSBub3QgdmFsaWQgY29tcGFyYXRvcnNcbiAgICAgIHNldCA9IHNldC5maWx0ZXIoKGNvbXApID0+IHtcbiAgICAgICAgcmV0dXJuICEhY29tcC5tYXRjaChjb21wUmUpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNldC5tYXAoKGNvbXApID0+IG5ldyBDb21wYXJhdG9yKGNvbXAsIHRoaXMub3B0aW9ucykpO1xuICB9XG5cbiAgdGVzdCh2ZXJzaW9uOiBzdHJpbmcgfCBTZW1WZXIpOiBib29sZWFuIHtcbiAgICBpZiAodHlwZW9mIHZlcnNpb24gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHZlcnNpb24gPSBuZXcgU2VtVmVyKHZlcnNpb24sIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnNldC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRlc3RTZXQodGhpcy5zZXRbaV0sIHZlcnNpb24sIHRoaXMub3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGludGVyc2VjdHMocmFuZ2U/OiBSYW5nZSwgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyk6IGJvb2xlYW4ge1xuICAgIGlmICghKHJhbmdlIGluc3RhbmNlb2YgUmFuZ2UpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYSBSYW5nZSBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zZXQuc29tZSgodGhpc0NvbXBhcmF0b3JzKSA9PiB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBpc1NhdGlzZmlhYmxlKHRoaXNDb21wYXJhdG9ycywgb3B0aW9uc09yTG9vc2UpICYmXG4gICAgICAgIHJhbmdlLnNldC5zb21lKChyYW5nZUNvbXBhcmF0b3JzKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIGlzU2F0aXNmaWFibGUocmFuZ2VDb21wYXJhdG9ycywgb3B0aW9uc09yTG9vc2UpICYmXG4gICAgICAgICAgICB0aGlzQ29tcGFyYXRvcnMuZXZlcnkoKHRoaXNDb21wYXJhdG9yKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiByYW5nZUNvbXBhcmF0b3JzLmV2ZXJ5KChyYW5nZUNvbXBhcmF0b3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpc0NvbXBhcmF0b3IuaW50ZXJzZWN0cyhcbiAgICAgICAgICAgICAgICAgIHJhbmdlQ29tcGFyYXRvcixcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnNPckxvb3NlLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMucmFuZ2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gdGVzdFNldChcbiAgc2V0OiBSZWFkb25seUFycmF5PENvbXBhcmF0b3I+LFxuICB2ZXJzaW9uOiBTZW1WZXIsXG4gIG9wdGlvbnM6IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgZm9yIChsZXQgaTogbnVtYmVyID0gMDsgaSA8IHNldC5sZW5ndGg7IGkrKykge1xuICAgIGlmICghc2V0W2ldLnRlc3QodmVyc2lvbikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBpZiAodmVyc2lvbi5wcmVyZWxlYXNlLmxlbmd0aCAmJiAhb3B0aW9ucy5pbmNsdWRlUHJlcmVsZWFzZSkge1xuICAgIC8vIEZpbmQgdGhlIHNldCBvZiB2ZXJzaW9ucyB0aGF0IGFyZSBhbGxvd2VkIHRvIGhhdmUgcHJlcmVsZWFzZXNcbiAgICAvLyBGb3IgZXhhbXBsZSwgXjEuMi4zLXByLjEgZGVzdWdhcnMgdG8gPj0xLjIuMy1wci4xIDwyLjAuMFxuICAgIC8vIFRoYXQgc2hvdWxkIGFsbG93IGAxLjIuMy1wci4yYCB0byBwYXNzLlxuICAgIC8vIEhvd2V2ZXIsIGAxLjIuNC1hbHBoYS5ub3RyZWFkeWAgc2hvdWxkIE5PVCBiZSBhbGxvd2VkLFxuICAgIC8vIGV2ZW4gdGhvdWdoIGl0J3Mgd2l0aGluIHRoZSByYW5nZSBzZXQgYnkgdGhlIGNvbXBhcmF0b3JzLlxuICAgIGZvciAobGV0IGk6IG51bWJlciA9IDA7IGkgPCBzZXQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChzZXRbaV0uc2VtdmVyID09PSBBTlkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzZXRbaV0uc2VtdmVyLnByZXJlbGVhc2UubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBhbGxvd2VkOiBTZW1WZXIgPSBzZXRbaV0uc2VtdmVyO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgYWxsb3dlZC5tYWpvciA9PT0gdmVyc2lvbi5tYWpvciAmJlxuICAgICAgICAgIGFsbG93ZWQubWlub3IgPT09IHZlcnNpb24ubWlub3IgJiZcbiAgICAgICAgICBhbGxvd2VkLnBhdGNoID09PSB2ZXJzaW9uLnBhdGNoXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVmVyc2lvbiBoYXMgYSAtcHJlLCBidXQgaXQncyBub3Qgb25lIG9mIHRoZSBvbmVzIHdlIGxpa2UuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIHRha2UgYSBzZXQgb2YgY29tcGFyYXRvcnMgYW5kIGRldGVybWluZSB3aGV0aGVyIHRoZXJlXG4vLyBleGlzdHMgYSB2ZXJzaW9uIHdoaWNoIGNhbiBzYXRpc2Z5IGl0XG5mdW5jdGlvbiBpc1NhdGlzZmlhYmxlKFxuICBjb21wYXJhdG9yczogcmVhZG9ubHkgQ29tcGFyYXRvcltdLFxuICBvcHRpb25zPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBib29sZWFuIHtcbiAgbGV0IHJlc3VsdDogYm9vbGVhbiA9IHRydWU7XG4gIGNvbnN0IHJlbWFpbmluZ0NvbXBhcmF0b3JzOiBDb21wYXJhdG9yW10gPSBjb21wYXJhdG9ycy5zbGljZSgpO1xuICBsZXQgdGVzdENvbXBhcmF0b3IgPSByZW1haW5pbmdDb21wYXJhdG9ycy5wb3AoKTtcblxuICB3aGlsZSAocmVzdWx0ICYmIHJlbWFpbmluZ0NvbXBhcmF0b3JzLmxlbmd0aCkge1xuICAgIHJlc3VsdCA9IHJlbWFpbmluZ0NvbXBhcmF0b3JzLmV2ZXJ5KChvdGhlckNvbXBhcmF0b3IpID0+IHtcbiAgICAgIHJldHVybiB0ZXN0Q29tcGFyYXRvcj8uaW50ZXJzZWN0cyhvdGhlckNvbXBhcmF0b3IsIG9wdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgdGVzdENvbXBhcmF0b3IgPSByZW1haW5pbmdDb21wYXJhdG9ycy5wb3AoKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIE1vc3RseSBqdXN0IGZvciB0ZXN0aW5nIGFuZCBsZWdhY3kgQVBJIHJlYXNvbnNcbmV4cG9ydCBmdW5jdGlvbiB0b0NvbXBhcmF0b3JzKFxuICByYW5nZTogc3RyaW5nIHwgUmFuZ2UsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBzdHJpbmdbXVtdIHtcbiAgcmV0dXJuIG5ldyBSYW5nZShyYW5nZSwgb3B0aW9uc09yTG9vc2UpLnNldC5tYXAoKGNvbXApID0+IHtcbiAgICByZXR1cm4gY29tcFxuICAgICAgLm1hcCgoYykgPT4gYy52YWx1ZSlcbiAgICAgIC5qb2luKFwiIFwiKVxuICAgICAgLnRyaW0oKVxuICAgICAgLnNwbGl0KFwiIFwiKTtcbiAgfSk7XG59XG5cbi8vIGNvbXByaXNlZCBvZiB4cmFuZ2VzLCB0aWxkZXMsIHN0YXJzLCBhbmQgZ3RsdCdzIGF0IHRoaXMgcG9pbnQuXG4vLyBhbHJlYWR5IHJlcGxhY2VkIHRoZSBoeXBoZW4gcmFuZ2VzXG4vLyB0dXJuIGludG8gYSBzZXQgb2YgSlVTVCBjb21wYXJhdG9ycy5cbmZ1bmN0aW9uIHBhcnNlQ29tcGFyYXRvcihjb21wOiBzdHJpbmcsIG9wdGlvbnM6IE9wdGlvbnMpOiBzdHJpbmcge1xuICBjb21wID0gcmVwbGFjZUNhcmV0cyhjb21wLCBvcHRpb25zKTtcbiAgY29tcCA9IHJlcGxhY2VUaWxkZXMoY29tcCwgb3B0aW9ucyk7XG4gIGNvbXAgPSByZXBsYWNlWFJhbmdlcyhjb21wLCBvcHRpb25zKTtcbiAgY29tcCA9IHJlcGxhY2VTdGFycyhjb21wLCBvcHRpb25zKTtcbiAgcmV0dXJuIGNvbXA7XG59XG5cbmZ1bmN0aW9uIGlzWChpZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiAhaWQgfHwgaWQudG9Mb3dlckNhc2UoKSA9PT0gXCJ4XCIgfHwgaWQgPT09IFwiKlwiO1xufVxuXG4vLyB+LCB+PiAtLT4gKiAoYW55LCBraW5kYSBzaWxseSlcbi8vIH4yLCB+Mi54LCB+Mi54LngsIH4+Miwgfj4yLnggfj4yLngueCAtLT4gPj0yLjAuMCA8My4wLjBcbi8vIH4yLjAsIH4yLjAueCwgfj4yLjAsIH4+Mi4wLnggLS0+ID49Mi4wLjAgPDIuMS4wXG4vLyB+MS4yLCB+MS4yLngsIH4+MS4yLCB+PjEuMi54IC0tPiA+PTEuMi4wIDwxLjMuMFxuLy8gfjEuMi4zLCB+PjEuMi4zIC0tPiA+PTEuMi4zIDwxLjMuMFxuLy8gfjEuMi4wLCB+PjEuMi4wIC0tPiA+PTEuMi4wIDwxLjMuMFxuZnVuY3Rpb24gcmVwbGFjZVRpbGRlcyhjb21wOiBzdHJpbmcsIG9wdGlvbnM6IE9wdGlvbnMpOiBzdHJpbmcge1xuICByZXR1cm4gY29tcFxuICAgIC50cmltKClcbiAgICAuc3BsaXQoL1xccysvKVxuICAgIC5tYXAoKGNvbXApID0+IHJlcGxhY2VUaWxkZShjb21wLCBvcHRpb25zKSlcbiAgICAuam9pbihcIiBcIik7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VUaWxkZShjb21wOiBzdHJpbmcsIG9wdGlvbnM6IE9wdGlvbnMpOiBzdHJpbmcge1xuICBjb25zdCByOiBSZWdFeHAgPSBvcHRpb25zLmxvb3NlID8gcmVbVElMREVMT09TRV0gOiByZVtUSUxERV07XG4gIHJldHVybiBjb21wLnJlcGxhY2UoXG4gICAgcixcbiAgICAoXzogc3RyaW5nLCBNOiBzdHJpbmcsIG06IHN0cmluZywgcDogc3RyaW5nLCBwcjogc3RyaW5nKSA9PiB7XG4gICAgICBsZXQgcmV0OiBzdHJpbmc7XG5cbiAgICAgIGlmIChpc1goTSkpIHtcbiAgICAgICAgcmV0ID0gXCJcIjtcbiAgICAgIH0gZWxzZSBpZiAoaXNYKG0pKSB7XG4gICAgICAgIHJldCA9IFwiPj1cIiArIE0gKyBcIi4wLjAgPFwiICsgKCtNICsgMSkgKyBcIi4wLjBcIjtcbiAgICAgIH0gZWxzZSBpZiAoaXNYKHApKSB7XG4gICAgICAgIC8vIH4xLjIgPT0gPj0xLjIuMCA8MS4zLjBcbiAgICAgICAgcmV0ID0gXCI+PVwiICsgTSArIFwiLlwiICsgbSArIFwiLjAgPFwiICsgTSArIFwiLlwiICsgKCttICsgMSkgKyBcIi4wXCI7XG4gICAgICB9IGVsc2UgaWYgKHByKSB7XG4gICAgICAgIHJldCA9IFwiPj1cIiArXG4gICAgICAgICAgTSArXG4gICAgICAgICAgXCIuXCIgK1xuICAgICAgICAgIG0gK1xuICAgICAgICAgIFwiLlwiICtcbiAgICAgICAgICBwICtcbiAgICAgICAgICBcIi1cIiArXG4gICAgICAgICAgcHIgK1xuICAgICAgICAgIFwiIDxcIiArXG4gICAgICAgICAgTSArXG4gICAgICAgICAgXCIuXCIgK1xuICAgICAgICAgICgrbSArIDEpICtcbiAgICAgICAgICBcIi4wXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB+MS4yLjMgPT0gPj0xLjIuMyA8MS4zLjBcbiAgICAgICAgcmV0ID0gXCI+PVwiICsgTSArIFwiLlwiICsgbSArIFwiLlwiICsgcCArIFwiIDxcIiArIE0gKyBcIi5cIiArICgrbSArIDEpICsgXCIuMFwiO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG4gICk7XG59XG5cbi8vIF4gLS0+ICogKGFueSwga2luZGEgc2lsbHkpXG4vLyBeMiwgXjIueCwgXjIueC54IC0tPiA+PTIuMC4wIDwzLjAuMFxuLy8gXjIuMCwgXjIuMC54IC0tPiA+PTIuMC4wIDwzLjAuMFxuLy8gXjEuMiwgXjEuMi54IC0tPiA+PTEuMi4wIDwyLjAuMFxuLy8gXjEuMi4zIC0tPiA+PTEuMi4zIDwyLjAuMFxuLy8gXjEuMi4wIC0tPiA+PTEuMi4wIDwyLjAuMFxuZnVuY3Rpb24gcmVwbGFjZUNhcmV0cyhjb21wOiBzdHJpbmcsIG9wdGlvbnM6IE9wdGlvbnMpOiBzdHJpbmcge1xuICByZXR1cm4gY29tcFxuICAgIC50cmltKClcbiAgICAuc3BsaXQoL1xccysvKVxuICAgIC5tYXAoKGNvbXApID0+IHJlcGxhY2VDYXJldChjb21wLCBvcHRpb25zKSlcbiAgICAuam9pbihcIiBcIik7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VDYXJldChjb21wOiBzdHJpbmcsIG9wdGlvbnM6IE9wdGlvbnMpOiBzdHJpbmcge1xuICBjb25zdCByOiBSZWdFeHAgPSBvcHRpb25zLmxvb3NlID8gcmVbQ0FSRVRMT09TRV0gOiByZVtDQVJFVF07XG4gIHJldHVybiBjb21wLnJlcGxhY2UociwgKF86IHN0cmluZywgTSwgbSwgcCwgcHIpID0+IHtcbiAgICBsZXQgcmV0OiBzdHJpbmc7XG5cbiAgICBpZiAoaXNYKE0pKSB7XG4gICAgICByZXQgPSBcIlwiO1xuICAgIH0gZWxzZSBpZiAoaXNYKG0pKSB7XG4gICAgICByZXQgPSBcIj49XCIgKyBNICsgXCIuMC4wIDxcIiArICgrTSArIDEpICsgXCIuMC4wXCI7XG4gICAgfSBlbHNlIGlmIChpc1gocCkpIHtcbiAgICAgIGlmIChNID09PSBcIjBcIikge1xuICAgICAgICByZXQgPSBcIj49XCIgKyBNICsgXCIuXCIgKyBtICsgXCIuMCA8XCIgKyBNICsgXCIuXCIgKyAoK20gKyAxKSArIFwiLjBcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldCA9IFwiPj1cIiArIE0gKyBcIi5cIiArIG0gKyBcIi4wIDxcIiArICgrTSArIDEpICsgXCIuMC4wXCI7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcikge1xuICAgICAgaWYgKE0gPT09IFwiMFwiKSB7XG4gICAgICAgIGlmIChtID09PSBcIjBcIikge1xuICAgICAgICAgIHJldCA9IFwiPj1cIiArXG4gICAgICAgICAgICBNICtcbiAgICAgICAgICAgIFwiLlwiICtcbiAgICAgICAgICAgIG0gK1xuICAgICAgICAgICAgXCIuXCIgK1xuICAgICAgICAgICAgcCArXG4gICAgICAgICAgICBcIi1cIiArXG4gICAgICAgICAgICBwciArXG4gICAgICAgICAgICBcIiA8XCIgK1xuICAgICAgICAgICAgTSArXG4gICAgICAgICAgICBcIi5cIiArXG4gICAgICAgICAgICBtICtcbiAgICAgICAgICAgIFwiLlwiICtcbiAgICAgICAgICAgICgrcCArIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldCA9IFwiPj1cIiArXG4gICAgICAgICAgICBNICtcbiAgICAgICAgICAgIFwiLlwiICtcbiAgICAgICAgICAgIG0gK1xuICAgICAgICAgICAgXCIuXCIgK1xuICAgICAgICAgICAgcCArXG4gICAgICAgICAgICBcIi1cIiArXG4gICAgICAgICAgICBwciArXG4gICAgICAgICAgICBcIiA8XCIgK1xuICAgICAgICAgICAgTSArXG4gICAgICAgICAgICBcIi5cIiArXG4gICAgICAgICAgICAoK20gKyAxKSArXG4gICAgICAgICAgICBcIi4wXCI7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldCA9IFwiPj1cIiArIE0gKyBcIi5cIiArIG0gKyBcIi5cIiArIHAgKyBcIi1cIiArIHByICsgXCIgPFwiICsgKCtNICsgMSkgK1xuICAgICAgICAgIFwiLjAuMFwiO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoTSA9PT0gXCIwXCIpIHtcbiAgICAgICAgaWYgKG0gPT09IFwiMFwiKSB7XG4gICAgICAgICAgcmV0ID0gXCI+PVwiICsgTSArIFwiLlwiICsgbSArIFwiLlwiICsgcCArIFwiIDxcIiArIE0gKyBcIi5cIiArIG0gKyBcIi5cIiArXG4gICAgICAgICAgICAoK3AgKyAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXQgPSBcIj49XCIgKyBNICsgXCIuXCIgKyBtICsgXCIuXCIgKyBwICsgXCIgPFwiICsgTSArIFwiLlwiICsgKCttICsgMSkgKyBcIi4wXCI7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldCA9IFwiPj1cIiArIE0gKyBcIi5cIiArIG0gKyBcIi5cIiArIHAgKyBcIiA8XCIgKyAoK00gKyAxKSArIFwiLjAuMFwiO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZXBsYWNlWFJhbmdlcyhjb21wOiBzdHJpbmcsIG9wdGlvbnM6IE9wdGlvbnMpOiBzdHJpbmcge1xuICByZXR1cm4gY29tcFxuICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgLm1hcCgoY29tcCkgPT4gcmVwbGFjZVhSYW5nZShjb21wLCBvcHRpb25zKSlcbiAgICAuam9pbihcIiBcIik7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VYUmFuZ2UoY29tcDogc3RyaW5nLCBvcHRpb25zOiBPcHRpb25zKTogc3RyaW5nIHtcbiAgY29tcCA9IGNvbXAudHJpbSgpO1xuICBjb25zdCByOiBSZWdFeHAgPSBvcHRpb25zLmxvb3NlID8gcmVbWFJBTkdFTE9PU0VdIDogcmVbWFJBTkdFXTtcbiAgcmV0dXJuIGNvbXAucmVwbGFjZShyLCAocmV0OiBzdHJpbmcsIGd0bHQsIE0sIG0sIHAsIHByKSA9PiB7XG4gICAgY29uc3QgeE06IGJvb2xlYW4gPSBpc1goTSk7XG4gICAgY29uc3QgeG06IGJvb2xlYW4gPSB4TSB8fCBpc1gobSk7XG4gICAgY29uc3QgeHA6IGJvb2xlYW4gPSB4bSB8fCBpc1gocCk7XG4gICAgY29uc3QgYW55WDogYm9vbGVhbiA9IHhwO1xuXG4gICAgaWYgKGd0bHQgPT09IFwiPVwiICYmIGFueVgpIHtcbiAgICAgIGd0bHQgPSBcIlwiO1xuICAgIH1cblxuICAgIGlmICh4TSkge1xuICAgICAgaWYgKGd0bHQgPT09IFwiPlwiIHx8IGd0bHQgPT09IFwiPFwiKSB7XG4gICAgICAgIC8vIG5vdGhpbmcgaXMgYWxsb3dlZFxuICAgICAgICByZXQgPSBcIjwwLjAuMFwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbm90aGluZyBpcyBmb3JiaWRkZW5cbiAgICAgICAgcmV0ID0gXCIqXCI7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChndGx0ICYmIGFueVgpIHtcbiAgICAgIC8vIHdlIGtub3cgcGF0Y2ggaXMgYW4geCwgYmVjYXVzZSB3ZSBoYXZlIGFueSB4IGF0IGFsbC5cbiAgICAgIC8vIHJlcGxhY2UgWCB3aXRoIDBcbiAgICAgIGlmICh4bSkge1xuICAgICAgICBtID0gMDtcbiAgICAgIH1cbiAgICAgIHAgPSAwO1xuXG4gICAgICBpZiAoZ3RsdCA9PT0gXCI+XCIpIHtcbiAgICAgICAgLy8gPjEgPT4gPj0yLjAuMFxuICAgICAgICAvLyA+MS4yID0+ID49MS4zLjBcbiAgICAgICAgLy8gPjEuMi4zID0+ID49IDEuMi40XG4gICAgICAgIGd0bHQgPSBcIj49XCI7XG4gICAgICAgIGlmICh4bSkge1xuICAgICAgICAgIE0gPSArTSArIDE7XG4gICAgICAgICAgbSA9IDA7XG4gICAgICAgICAgcCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbSA9ICttICsgMTtcbiAgICAgICAgICBwID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChndGx0ID09PSBcIjw9XCIpIHtcbiAgICAgICAgLy8gPD0wLjcueCBpcyBhY3R1YWxseSA8MC44LjAsIHNpbmNlIGFueSAwLjcueCBzaG91bGRcbiAgICAgICAgLy8gcGFzcy4gIFNpbWlsYXJseSwgPD03LnggaXMgYWN0dWFsbHkgPDguMC4wLCBldGMuXG4gICAgICAgIGd0bHQgPSBcIjxcIjtcbiAgICAgICAgaWYgKHhtKSB7XG4gICAgICAgICAgTSA9ICtNICsgMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtID0gK20gKyAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldCA9IGd0bHQgKyBNICsgXCIuXCIgKyBtICsgXCIuXCIgKyBwO1xuICAgIH0gZWxzZSBpZiAoeG0pIHtcbiAgICAgIHJldCA9IFwiPj1cIiArIE0gKyBcIi4wLjAgPFwiICsgKCtNICsgMSkgKyBcIi4wLjBcIjtcbiAgICB9IGVsc2UgaWYgKHhwKSB7XG4gICAgICByZXQgPSBcIj49XCIgKyBNICsgXCIuXCIgKyBtICsgXCIuMCA8XCIgKyBNICsgXCIuXCIgKyAoK20gKyAxKSArIFwiLjBcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0O1xuICB9KTtcbn1cblxuLy8gQmVjYXVzZSAqIGlzIEFORC1lZCB3aXRoIGV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgY29tcGFyYXRvcixcbi8vIGFuZCAnJyBtZWFucyBcImFueSB2ZXJzaW9uXCIsIGp1c3QgcmVtb3ZlIHRoZSAqcyBlbnRpcmVseS5cbmZ1bmN0aW9uIHJlcGxhY2VTdGFycyhjb21wOiBzdHJpbmcsIG9wdGlvbnM6IE9wdGlvbnMpOiBzdHJpbmcge1xuICAvLyBMb29zZW5lc3MgaXMgaWdub3JlZCBoZXJlLiAgc3RhciBpcyBhbHdheXMgYXMgbG9vc2UgYXMgaXQgZ2V0cyFcbiAgcmV0dXJuIGNvbXAudHJpbSgpLnJlcGxhY2UocmVbU1RBUl0sIFwiXCIpO1xufVxuXG4vLyBUaGlzIGZ1bmN0aW9uIGlzIHBhc3NlZCB0byBzdHJpbmcucmVwbGFjZShyZVtIWVBIRU5SQU5HRV0pXG4vLyBNLCBtLCBwYXRjaCwgcHJlcmVsZWFzZSwgYnVpbGRcbi8vIDEuMiAtIDMuNC41ID0+ID49MS4yLjAgPD0zLjQuNVxuLy8gMS4yLjMgLSAzLjQgPT4gPj0xLjIuMCA8My41LjAgQW55IDMuNC54IHdpbGwgZG9cbi8vIDEuMiAtIDMuNCA9PiA+PTEuMi4wIDwzLjUuMFxuZnVuY3Rpb24gaHlwaGVuUmVwbGFjZShcbiAgJDA6IGFueSxcbiAgZnJvbTogYW55LFxuICBmTTogYW55LFxuICBmbTogYW55LFxuICBmcDogYW55LFxuICBmcHI6IGFueSxcbiAgZmI6IGFueSxcbiAgdG86IGFueSxcbiAgdE06IGFueSxcbiAgdG06IGFueSxcbiAgdHA6IGFueSxcbiAgdHByOiBhbnksXG4gIHRiOiBhbnksXG4pIHtcbiAgaWYgKGlzWChmTSkpIHtcbiAgICBmcm9tID0gXCJcIjtcbiAgfSBlbHNlIGlmIChpc1goZm0pKSB7XG4gICAgZnJvbSA9IFwiPj1cIiArIGZNICsgXCIuMC4wXCI7XG4gIH0gZWxzZSBpZiAoaXNYKGZwKSkge1xuICAgIGZyb20gPSBcIj49XCIgKyBmTSArIFwiLlwiICsgZm0gKyBcIi4wXCI7XG4gIH0gZWxzZSB7XG4gICAgZnJvbSA9IFwiPj1cIiArIGZyb207XG4gIH1cblxuICBpZiAoaXNYKHRNKSkge1xuICAgIHRvID0gXCJcIjtcbiAgfSBlbHNlIGlmIChpc1godG0pKSB7XG4gICAgdG8gPSBcIjxcIiArICgrdE0gKyAxKSArIFwiLjAuMFwiO1xuICB9IGVsc2UgaWYgKGlzWCh0cCkpIHtcbiAgICB0byA9IFwiPFwiICsgdE0gKyBcIi5cIiArICgrdG0gKyAxKSArIFwiLjBcIjtcbiAgfSBlbHNlIGlmICh0cHIpIHtcbiAgICB0byA9IFwiPD1cIiArIHRNICsgXCIuXCIgKyB0bSArIFwiLlwiICsgdHAgKyBcIi1cIiArIHRwcjtcbiAgfSBlbHNlIHtcbiAgICB0byA9IFwiPD1cIiArIHRvO1xuICB9XG5cbiAgcmV0dXJuIChmcm9tICsgXCIgXCIgKyB0bykudHJpbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2F0aXNmaWVzKFxuICB2ZXJzaW9uOiBzdHJpbmcgfCBTZW1WZXIsXG4gIHJhbmdlOiBzdHJpbmcgfCBSYW5nZSxcbiAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbik6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIHJhbmdlID0gbmV3IFJhbmdlKHJhbmdlLCBvcHRpb25zT3JMb29zZSk7XG4gIH0gY2F0Y2ggKGVyKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiByYW5nZS50ZXN0KHZlcnNpb24pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF4U2F0aXNmeWluZzxUIGV4dGVuZHMgc3RyaW5nIHwgU2VtVmVyPihcbiAgdmVyc2lvbnM6IFJlYWRvbmx5QXJyYXk8VD4sXG4gIHJhbmdlOiBzdHJpbmcgfCBSYW5nZSxcbiAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbik6IFQgfCBudWxsIHtcbiAgLy90b2RvXG4gIHZhciBtYXg6IFQgfCBTZW1WZXIgfCBudWxsID0gbnVsbDtcbiAgdmFyIG1heFNWOiBTZW1WZXIgfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICB2YXIgcmFuZ2VPYmogPSBuZXcgUmFuZ2UocmFuZ2UsIG9wdGlvbnNPckxvb3NlKTtcbiAgfSBjYXRjaCAoZXIpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2ZXJzaW9ucy5mb3JFYWNoKCh2KSA9PiB7XG4gICAgaWYgKHJhbmdlT2JqLnRlc3QodikpIHtcbiAgICAgIC8vIHNhdGlzZmllcyh2LCByYW5nZSwgb3B0aW9ucylcbiAgICAgIGlmICghbWF4IHx8IChtYXhTViAmJiBtYXhTVi5jb21wYXJlKHYpID09PSAtMSkpIHtcbiAgICAgICAgLy8gY29tcGFyZShtYXgsIHYsIHRydWUpXG4gICAgICAgIG1heCA9IHY7XG4gICAgICAgIG1heFNWID0gbmV3IFNlbVZlcihtYXgsIG9wdGlvbnNPckxvb3NlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICByZXR1cm4gbWF4O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWluU2F0aXNmeWluZzxUIGV4dGVuZHMgc3RyaW5nIHwgU2VtVmVyPihcbiAgdmVyc2lvbnM6IFJlYWRvbmx5QXJyYXk8VD4sXG4gIHJhbmdlOiBzdHJpbmcgfCBSYW5nZSxcbiAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbik6IFQgfCBudWxsIHtcbiAgLy90b2RvXG4gIHZhciBtaW46IGFueSA9IG51bGw7XG4gIHZhciBtaW5TVjogYW55ID0gbnVsbDtcbiAgdHJ5IHtcbiAgICB2YXIgcmFuZ2VPYmogPSBuZXcgUmFuZ2UocmFuZ2UsIG9wdGlvbnNPckxvb3NlKTtcbiAgfSBjYXRjaCAoZXIpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2ZXJzaW9ucy5mb3JFYWNoKCh2KSA9PiB7XG4gICAgaWYgKHJhbmdlT2JqLnRlc3QodikpIHtcbiAgICAgIC8vIHNhdGlzZmllcyh2LCByYW5nZSwgb3B0aW9ucylcbiAgICAgIGlmICghbWluIHx8IG1pblNWLmNvbXBhcmUodikgPT09IDEpIHtcbiAgICAgICAgLy8gY29tcGFyZShtaW4sIHYsIHRydWUpXG4gICAgICAgIG1pbiA9IHY7XG4gICAgICAgIG1pblNWID0gbmV3IFNlbVZlcihtaW4sIG9wdGlvbnNPckxvb3NlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICByZXR1cm4gbWluO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWluVmVyc2lvbihcbiAgcmFuZ2U6IHN0cmluZyB8IFJhbmdlLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogU2VtVmVyIHwgbnVsbCB7XG4gIHJhbmdlID0gbmV3IFJhbmdlKHJhbmdlLCBvcHRpb25zT3JMb29zZSk7XG5cbiAgdmFyIG1pbnZlcjogU2VtVmVyIHwgbnVsbCA9IG5ldyBTZW1WZXIoXCIwLjAuMFwiKTtcbiAgaWYgKHJhbmdlLnRlc3QobWludmVyKSkge1xuICAgIHJldHVybiBtaW52ZXI7XG4gIH1cblxuICBtaW52ZXIgPSBuZXcgU2VtVmVyKFwiMC4wLjAtMFwiKTtcbiAgaWYgKHJhbmdlLnRlc3QobWludmVyKSkge1xuICAgIHJldHVybiBtaW52ZXI7XG4gIH1cblxuICBtaW52ZXIgPSBudWxsO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlLnNldC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBjb21wYXJhdG9ycyA9IHJhbmdlLnNldFtpXTtcblxuICAgIGNvbXBhcmF0b3JzLmZvckVhY2goKGNvbXBhcmF0b3IpID0+IHtcbiAgICAgIC8vIENsb25lIHRvIGF2b2lkIG1hbmlwdWxhdGluZyB0aGUgY29tcGFyYXRvcidzIHNlbXZlciBvYmplY3QuXG4gICAgICB2YXIgY29tcHZlciA9IG5ldyBTZW1WZXIoY29tcGFyYXRvci5zZW12ZXIudmVyc2lvbik7XG4gICAgICBzd2l0Y2ggKGNvbXBhcmF0b3Iub3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSBcIj5cIjpcbiAgICAgICAgICBpZiAoY29tcHZlci5wcmVyZWxlYXNlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29tcHZlci5wYXRjaCsrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb21wdmVyLnByZXJlbGVhc2UucHVzaCgwKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29tcHZlci5yYXcgPSBjb21wdmVyLmZvcm1hdCgpO1xuICAgICAgICAvKiBmYWxsdGhyb3VnaCAqL1xuICAgICAgICBjYXNlIFwiXCI6XG4gICAgICAgIGNhc2UgXCI+PVwiOlxuICAgICAgICAgIGlmICghbWludmVyIHx8IGd0KG1pbnZlciwgY29tcHZlcikpIHtcbiAgICAgICAgICAgIG1pbnZlciA9IGNvbXB2ZXI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiPFwiOlxuICAgICAgICBjYXNlIFwiPD1cIjpcbiAgICAgICAgICAvKiBJZ25vcmUgbWF4aW11bSB2ZXJzaW9ucyAqL1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb3BlcmF0aW9uOiBcIiArIGNvbXBhcmF0b3Iub3BlcmF0b3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1pbnZlciAmJiByYW5nZS50ZXN0KG1pbnZlcikpIHtcbiAgICByZXR1cm4gbWludmVyO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZFJhbmdlKFxuICByYW5nZTogc3RyaW5nIHwgUmFuZ2UgfCBudWxsLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogc3RyaW5nIHwgbnVsbCB7XG4gIHRyeSB7XG4gICAgaWYgKHJhbmdlID09PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICAvLyBSZXR1cm4gJyonIGluc3RlYWQgb2YgJycgc28gdGhhdCB0cnV0aGluZXNzIHdvcmtzLlxuICAgIC8vIFRoaXMgd2lsbCB0aHJvdyBpZiBpdCdzIGludmFsaWQgYW55d2F5XG4gICAgcmV0dXJuIG5ldyBSYW5nZShyYW5nZSwgb3B0aW9uc09yTG9vc2UpLnJhbmdlIHx8IFwiKlwiO1xuICB9IGNhdGNoIChlcikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogUmV0dXJuIHRydWUgaWYgdmVyc2lvbiBpcyBsZXNzIHRoYW4gYWxsIHRoZSB2ZXJzaW9ucyBwb3NzaWJsZSBpbiB0aGUgcmFuZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsdHIoXG4gIHZlcnNpb246IHN0cmluZyB8IFNlbVZlcixcbiAgcmFuZ2U6IHN0cmluZyB8IFJhbmdlLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogYm9vbGVhbiB7XG4gIHJldHVybiBvdXRzaWRlKHZlcnNpb24sIHJhbmdlLCBcIjxcIiwgb3B0aW9uc09yTG9vc2UpO1xufVxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIHZlcnNpb24gaXMgZ3JlYXRlciB0aGFuIGFsbCB0aGUgdmVyc2lvbnMgcG9zc2libGUgaW4gdGhlIHJhbmdlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ3RyKFxuICB2ZXJzaW9uOiBzdHJpbmcgfCBTZW1WZXIsXG4gIHJhbmdlOiBzdHJpbmcgfCBSYW5nZSxcbiAgb3B0aW9uc09yTG9vc2U/OiBib29sZWFuIHwgT3B0aW9ucyxcbik6IGJvb2xlYW4ge1xuICByZXR1cm4gb3V0c2lkZSh2ZXJzaW9uLCByYW5nZSwgXCI+XCIsIG9wdGlvbnNPckxvb3NlKTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgdmVyc2lvbiBpcyBvdXRzaWRlIHRoZSBib3VuZHMgb2YgdGhlIHJhbmdlIGluIGVpdGhlciB0aGUgaGlnaCBvciBsb3cgZGlyZWN0aW9uLlxuICogVGhlIGhpbG8gYXJndW1lbnQgbXVzdCBiZSBlaXRoZXIgdGhlIHN0cmluZyAnPicgb3IgJzwnLiAoVGhpcyBpcyB0aGUgZnVuY3Rpb24gY2FsbGVkIGJ5IGd0ciBhbmQgbHRyLilcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG91dHNpZGUoXG4gIHZlcnNpb246IHN0cmluZyB8IFNlbVZlcixcbiAgcmFuZ2U6IHN0cmluZyB8IFJhbmdlLFxuICBoaWxvOiBcIj5cIiB8IFwiPFwiLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogYm9vbGVhbiB7XG4gIHZlcnNpb24gPSBuZXcgU2VtVmVyKHZlcnNpb24sIG9wdGlvbnNPckxvb3NlKTtcbiAgcmFuZ2UgPSBuZXcgUmFuZ2UocmFuZ2UsIG9wdGlvbnNPckxvb3NlKTtcblxuICBsZXQgZ3RmbjogdHlwZW9mIGd0O1xuICBsZXQgbHRlZm46IHR5cGVvZiBsdGU7XG4gIGxldCBsdGZuOiB0eXBlb2YgbHQ7XG4gIGxldCBjb21wOiBzdHJpbmc7XG4gIGxldCBlY29tcDogc3RyaW5nO1xuICBzd2l0Y2ggKGhpbG8pIHtcbiAgICBjYXNlIFwiPlwiOlxuICAgICAgZ3RmbiA9IGd0O1xuICAgICAgbHRlZm4gPSBsdGU7XG4gICAgICBsdGZuID0gbHQ7XG4gICAgICBjb21wID0gXCI+XCI7XG4gICAgICBlY29tcCA9IFwiPj1cIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCI8XCI6XG4gICAgICBndGZuID0gbHQ7XG4gICAgICBsdGVmbiA9IGd0ZTtcbiAgICAgIGx0Zm4gPSBndDtcbiAgICAgIGNvbXAgPSBcIjxcIjtcbiAgICAgIGVjb21wID0gXCI8PVwiO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ011c3QgcHJvdmlkZSBhIGhpbG8gdmFsIG9mIFwiPFwiIG9yIFwiPlwiJyk7XG4gIH1cblxuICAvLyBJZiBpdCBzYXRpc2lmZXMgdGhlIHJhbmdlIGl0IGlzIG5vdCBvdXRzaWRlXG4gIGlmIChzYXRpc2ZpZXModmVyc2lvbiwgcmFuZ2UsIG9wdGlvbnNPckxvb3NlKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEZyb20gbm93IG9uLCB2YXJpYWJsZSB0ZXJtcyBhcmUgYXMgaWYgd2UncmUgaW4gXCJndHJcIiBtb2RlLlxuICAvLyBidXQgbm90ZSB0aGF0IGV2ZXJ5dGhpbmcgaXMgZmxpcHBlZCBmb3IgdGhlIFwibHRyXCIgZnVuY3Rpb24uXG5cbiAgZm9yIChsZXQgaTogbnVtYmVyID0gMDsgaSA8IHJhbmdlLnNldC5sZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IGNvbXBhcmF0b3JzOiByZWFkb25seSBDb21wYXJhdG9yW10gPSByYW5nZS5zZXRbaV07XG5cbiAgICBsZXQgaGlnaDogQ29tcGFyYXRvciB8IG51bGwgPSBudWxsO1xuICAgIGxldCBsb3c6IENvbXBhcmF0b3IgfCBudWxsID0gbnVsbDtcblxuICAgIGZvciAobGV0IGNvbXBhcmF0b3Igb2YgY29tcGFyYXRvcnMpIHtcbiAgICAgIGlmIChjb21wYXJhdG9yLnNlbXZlciA9PT0gQU5ZKSB7XG4gICAgICAgIGNvbXBhcmF0b3IgPSBuZXcgQ29tcGFyYXRvcihcIj49MC4wLjBcIik7XG4gICAgICB9XG4gICAgICBoaWdoID0gaGlnaCB8fCBjb21wYXJhdG9yO1xuICAgICAgbG93ID0gbG93IHx8IGNvbXBhcmF0b3I7XG4gICAgICBpZiAoZ3Rmbihjb21wYXJhdG9yLnNlbXZlciwgaGlnaC5zZW12ZXIsIG9wdGlvbnNPckxvb3NlKSkge1xuICAgICAgICBoaWdoID0gY29tcGFyYXRvcjtcbiAgICAgIH0gZWxzZSBpZiAobHRmbihjb21wYXJhdG9yLnNlbXZlciwgbG93LnNlbXZlciwgb3B0aW9uc09yTG9vc2UpKSB7XG4gICAgICAgIGxvdyA9IGNvbXBhcmF0b3I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGhpZ2ggPT09IG51bGwgfHwgbG93ID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIElmIHRoZSBlZGdlIHZlcnNpb24gY29tcGFyYXRvciBoYXMgYSBvcGVyYXRvciB0aGVuIG91ciB2ZXJzaW9uXG4gICAgLy8gaXNuJ3Qgb3V0c2lkZSBpdFxuICAgIGlmIChoaWdoIS5vcGVyYXRvciA9PT0gY29tcCB8fCBoaWdoIS5vcGVyYXRvciA9PT0gZWNvbXApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgbG93ZXN0IHZlcnNpb24gY29tcGFyYXRvciBoYXMgYW4gb3BlcmF0b3IgYW5kIG91ciB2ZXJzaW9uXG4gICAgLy8gaXMgbGVzcyB0aGFuIGl0IHRoZW4gaXQgaXNuJ3QgaGlnaGVyIHRoYW4gdGhlIHJhbmdlXG4gICAgaWYgKFxuICAgICAgKCFsb3chLm9wZXJhdG9yIHx8IGxvdyEub3BlcmF0b3IgPT09IGNvbXApICYmXG4gICAgICBsdGVmbih2ZXJzaW9uLCBsb3chLnNlbXZlcilcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2UgaWYgKGxvdyEub3BlcmF0b3IgPT09IGVjb21wICYmIGx0Zm4odmVyc2lvbiwgbG93IS5zZW12ZXIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcmVsZWFzZShcbiAgdmVyc2lvbjogc3RyaW5nIHwgU2VtVmVyLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogUmVhZG9ubHlBcnJheTxzdHJpbmcgfCBudW1iZXI+IHwgbnVsbCB7XG4gIHZhciBwYXJzZWQgPSBwYXJzZSh2ZXJzaW9uLCBvcHRpb25zT3JMb29zZSk7XG4gIHJldHVybiBwYXJzZWQgJiYgcGFyc2VkLnByZXJlbGVhc2UubGVuZ3RoID8gcGFyc2VkLnByZXJlbGVhc2UgOiBudWxsO1xufVxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIGFueSBvZiB0aGUgcmFuZ2VzIGNvbXBhcmF0b3JzIGludGVyc2VjdFxuICovXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJzZWN0cyhcbiAgcmFuZ2UxOiBzdHJpbmcgfCBSYW5nZSB8IENvbXBhcmF0b3IsXG4gIHJhbmdlMjogc3RyaW5nIHwgUmFuZ2UgfCBDb21wYXJhdG9yLFxuICBvcHRpb25zT3JMb29zZT86IGJvb2xlYW4gfCBPcHRpb25zLFxuKTogYm9vbGVhbiB7XG4gIHJhbmdlMSA9IG5ldyBSYW5nZShyYW5nZTEsIG9wdGlvbnNPckxvb3NlKTtcbiAgcmFuZ2UyID0gbmV3IFJhbmdlKHJhbmdlMiwgb3B0aW9uc09yTG9vc2UpO1xuICByZXR1cm4gcmFuZ2UxLmludGVyc2VjdHMocmFuZ2UyKTtcbn1cblxuLyoqXG4gKiBDb2VyY2VzIGEgc3RyaW5nIHRvIHNlbXZlciBpZiBwb3NzaWJsZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY29lcmNlKFxuICB2ZXJzaW9uOiBzdHJpbmcgfCBTZW1WZXIsXG4gIG9wdGlvbnNPckxvb3NlPzogYm9vbGVhbiB8IE9wdGlvbnMsXG4pOiBTZW1WZXIgfCBudWxsIHtcbiAgaWYgKHZlcnNpb24gaW5zdGFuY2VvZiBTZW1WZXIpIHtcbiAgICByZXR1cm4gdmVyc2lvbjtcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmVyc2lvbiAhPT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF0Y2ggPSB2ZXJzaW9uLm1hdGNoKHJlW0NPRVJDRV0pO1xuXG4gIGlmIChtYXRjaCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gcGFyc2UoXG4gICAgbWF0Y2hbMV0gKyBcIi5cIiArIChtYXRjaFsyXSB8fCBcIjBcIikgKyBcIi5cIiArIChtYXRjaFszXSB8fCBcIjBcIiksXG4gICAgb3B0aW9uc09yTG9vc2UsXG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlbVZlcjtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEyQkEsc0VBQXNFO0FBQ3RFLG9EQUFvRDtBQUNwRCxPQUFPLE1BQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDO0FBRTNDLE1BQU0sVUFBVSxHQUFXLEdBQUcsQUFBQztBQUUvQix3Q0FBd0M7QUFDeEMsTUFBTSx5QkFBeUIsR0FBVyxFQUFFLEFBQUM7QUFFN0MscUJBQXFCO0FBQ3JCLE1BQU0sRUFBRSxHQUFhLEVBQUUsQUFBQztBQUN4QixNQUFNLEdBQUcsR0FBYSxFQUFFLEFBQUM7QUFDekIsSUFBSSxDQUFDLEdBQVcsQ0FBQyxBQUFDO0FBRWxCLGdFQUFnRTtBQUNoRSxrREFBa0Q7QUFFbEQsd0JBQXdCO0FBQ3hCLHFFQUFxRTtBQUVyRSxNQUFNLGlCQUFpQixHQUFXLENBQUMsRUFBRSxBQUFDO0FBQ3RDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLGFBQWEsQ0FBQztBQUN2QyxNQUFNLHNCQUFzQixHQUFXLENBQUMsRUFBRSxBQUFDO0FBQzNDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLFFBQVEsQ0FBQztBQUV2Qyw0QkFBNEI7QUFDNUIsd0VBQXdFO0FBQ3hFLG9DQUFvQztBQUVwQyxNQUFNLG9CQUFvQixHQUFXLENBQUMsRUFBRSxBQUFDO0FBQ3pD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