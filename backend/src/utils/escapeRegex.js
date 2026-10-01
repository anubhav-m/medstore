// User text becomes literal text inside a RegExp: every metacharacter is escaped, so input such
// as `.*` or `(a+)+$` can't change the pattern or make it slow.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// An anchored prefix match, which an index can serve.
export const prefixPattern = (text) => `^${escapeRegex(text)}`;
