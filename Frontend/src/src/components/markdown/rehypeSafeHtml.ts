// src/components/markdown/rehypeSafeHtml.ts
// Minimal, dependency-free sanitizer for raw HTML in markdown preview.
// - Drops dangerous tags
// - Strips inline event handlers
// - Blocks javascript: URLs
// - Normalizes smart quotes in attribute values (fixes pasted HTML)

type HastNode = {
    type?: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
    value?: string;
};

const BLOCKED_TAGS = new Set([
    "script",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
]);

const stripEdgeQuotes = (value: string) =>
    value
        .replace(/^[\"'“”‘’]+/, "")
        .replace(/[\"'“”‘’]+$/, "")
        .trim();

const sanitizeUrl = (value: string) => {
    const cleaned = stripEdgeQuotes(value);
    if (cleaned.toLowerCase().startsWith("javascript:")) return "";
    return cleaned;
};

const normalizeValue = (value: unknown) => {
    if (typeof value === "string") return stripEdgeQuotes(value);
    if (Array.isArray(value)) {
        const normalized = value
            .map((item) => (typeof item === "string" ? stripEdgeQuotes(item) : item))
            .filter((item) => item !== "");
        return normalized.length > 0 ? normalized : undefined;
    }
    return value;
};

const sanitizeProperties = (properties: Record<string, unknown>) => {
    for (const key of Object.keys(properties)) {
        const lowerKey = key.toLowerCase();
        const rawValue = properties[key];

        if (lowerKey.startsWith("on")) {
            delete properties[key];
            continue;
        }

        if (lowerKey === "href" || lowerKey === "src" || lowerKey === "xlinkhref") {
            if (typeof rawValue === "string") {
                const cleaned = sanitizeUrl(rawValue);
                if (!cleaned) delete properties[key];
                else properties[key] = cleaned;
            } else if (Array.isArray(rawValue)) {
                const cleanedList = rawValue
                    .map((item) =>
                        typeof item === "string" ? sanitizeUrl(item) : item
                    )
                    .filter((item) => item !== "");
                if (cleanedList.length === 0) delete properties[key];
                else properties[key] = cleanedList;
            }
            continue;
        }

        if (lowerKey === "style" && typeof rawValue === "string") {
            const cleaned = stripEdgeQuotes(rawValue);
            if (/expression\s*\(|javascript:/i.test(cleaned)) {
                delete properties[key];
            } else {
                properties[key] = cleaned;
            }
            continue;
        }

        const normalized = normalizeValue(rawValue);
        if (normalized === undefined || normalized === "") {
            delete properties[key];
        } else {
            properties[key] = normalized;
        }
    }
};

const sanitizeTree = (node: HastNode) => {
    if (!node || !node.children) return;

    node.children = node.children.filter((child) => {
        if (child.type !== "element") return true;
        const tag = (child.tagName ?? "").toLowerCase();
        return !BLOCKED_TAGS.has(tag);
    });

    for (const child of node.children) {
        if (child.type === "element") {
            if (!child.properties) child.properties = {};
            sanitizeProperties(child.properties);
        }
        sanitizeTree(child);
    }
};

const rehypeSafeHtml = () => {
    return (tree: HastNode) => {
        sanitizeTree(tree);
    };
};

export default rehypeSafeHtml;
