export type ProblemImageRefMap = Record<string, string>;

export const BASE64_SECTION_START = "<!-- BASE64_IMAGE_REFERENCES_START -->";
export const BASE64_SECTION_END = "<!-- BASE64_IMAGE_REFERENCES_END -->";

const IMAGE_REF_LINE_PATTERN = /^\[([^\]]+)\]:\s*(.+)$/;

const BASE64_PADDING_RE = /=+$/;

export const estimateDataUrlBytes = (value: string) => {
    const firstComma = value.indexOf(",");
    if (firstComma === -1) {
        return 0;
    }

    const encoded = value.slice(firstComma + 1).trim().replace(/\s/g, "");
    if (!encoded.length) {
        return 0;
    }

    const padding = encoded.match(BASE64_PADDING_RE)?.[0].length ?? 0;
    return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
};

export const estimateImageRefBytes = (imageRefs: ProblemImageRefMap) =>
    Object.values(imageRefs).reduce(
        (sum, value) => sum + estimateDataUrlBytes(value),
        0,
    );

export const formatByteCount = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const toOrderedAliases = (imageRefs: ProblemImageRefMap) =>
    Object.keys(imageRefs).sort((a, b) => {
        const ai = a.match(/^image(\d+)$/i);
        const bi = b.match(/^image(\d+)$/i);
        if (ai && bi) return Number(ai[1]) - Number(bi[1]);
        if (ai) return -1;
        if (bi) return 1;
        return a.localeCompare(b);
    });

export const splitDescriptionAndImageRefs = (content: string) => {
    const startIndex = content.indexOf(BASE64_SECTION_START);
    const endIndex = content.indexOf(BASE64_SECTION_END);

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        return {
            body: content.trimEnd(),
            imageRefs: {} as ProblemImageRefMap,
        };
    }

    const body = content.slice(0, startIndex).trimEnd();
    const refBlock = content
        .slice(startIndex + BASE64_SECTION_START.length, endIndex)
        .trim();

    const imageRefs: ProblemImageRefMap = {};
    for (const line of refBlock.split(/\r?\n/)) {
        const parsed = line.trim().match(IMAGE_REF_LINE_PATTERN);
        if (!parsed) continue;

        const alias = parsed[1]?.trim();
        const refValue = parsed[2]?.trim();
        if (!alias || !refValue) continue;

        imageRefs[alias] = refValue;
    }

    return { body, imageRefs };
};

export const getNextImageAlias = (
    body: string,
    imageRefs: ProblemImageRefMap,
) => {
    let maxNumber = 0;
    const readMax = (target: string) => {
        for (const match of target.matchAll(/image(\d+)/gi)) {
            const parsed = Number(match[1]);
            if (Number.isFinite(parsed)) {
                maxNumber = Math.max(maxNumber, parsed);
            }
        }
    };

    readMax(body);
    readMax(Object.keys(imageRefs).join(" "));

    return `image${maxNumber + 1}`;
};

export const migrateInlineBase64Images = (
    body: string,
    imageRefs: ProblemImageRefMap,
) => {
    const nextImageRefs: ProblemImageRefMap = { ...imageRefs };
    let convertedCount = 0;
    let nextAlias = getNextImageAlias(body, nextImageRefs);

    const nextBody = body.replace(
        /!\[[^\]]*]\((data:image\/[^)]+)\)/gi,
        (_full, dataUri: string) => {
            const alias = nextAlias;
            nextImageRefs[alias] = dataUri;
            convertedCount += 1;
            nextAlias = getNextImageAlias(body, nextImageRefs);
            return `![${alias}][${alias}]`;
        },
    );

    return {
        body: nextBody,
        imageRefs: nextImageRefs,
        convertedCount,
    };
};

export const pruneUnusedImageRefs = (
    body: string,
    imageRefs: ProblemImageRefMap,
) => {
    const usedAliases = new Set<string>();
    for (const match of body.matchAll(/!\[[^\]]*]\[([^\]]+)\]/gi)) {
        const alias = match[1]?.trim();
        if (alias) usedAliases.add(alias);
    }

    if (!usedAliases.size) return {};

    const pruned: ProblemImageRefMap = {};
    for (const [alias, refValue] of Object.entries(imageRefs)) {
        if (usedAliases.has(alias)) {
            pruned[alias] = refValue;
        }
    }
    return pruned;
};

export const composeDescriptionWithImageRefs = (
    body: string,
    imageRefs: ProblemImageRefMap,
    options?: { pruneUnused?: boolean },
) => {
    const trimmedBody = body.trimEnd();
    const refsToUse = options?.pruneUnused
        ? pruneUnusedImageRefs(trimmedBody, imageRefs)
        : imageRefs;

    const orderedAliases = toOrderedAliases(refsToUse);
    if (!orderedAliases.length) {
        return trimmedBody;
    }

    const refLines = orderedAliases
        .map((alias) => `[${alias}]: ${refsToUse[alias]}`)
        .join("\n");

    if (!trimmedBody) {
        return `${BASE64_SECTION_START}\n${refLines}\n${BASE64_SECTION_END}`;
    }

    return `${trimmedBody}\n\n${BASE64_SECTION_START}\n${refLines}\n${BASE64_SECTION_END}`;
};
