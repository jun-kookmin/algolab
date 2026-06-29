export interface ProblemCopyCaseBlock {
  id: string;
  title: string;
  input: string;
  output: string;
}

export interface ParsedProblemCopyInputBlocks {
  markdownBody: string;
  copyCases: ProblemCopyCaseBlock[];
}

const COPY_BLOCK_REGEX = /:::(copy-input|copy-io)(?:[ \t]+([^\n]*))?\n([\s\S]*?)\n:::/g;
const DEFAULT_TITLE_PREFIX = "테스트케이스";
const IO_SECTION_REGEX = /\[(input|output)\][ \t]*\n([\s\S]*?)\n\[\/\1\]/gi;

export const buildCopyCaseBlockTemplate = (title = "테스트케이스 1") =>
  `:::copy-io ${title}\n[input]\n1 2 3\n4 5 6\n[/input]\n[output]\n6\n[/output]\n:::`;

export const buildCopyInputBlockTemplate = (title = "샘플 입력 1") =>
  `:::copy-input ${title}\n1 2 3\n4 5 6\n:::`;

export const extractProblemCopyInputBlocks = (
  markdown: string | undefined | null,
): ParsedProblemCopyInputBlocks => {
  const source = (markdown ?? "").replace(/\r\n/g, "\n");
  const copyCases: ProblemCopyCaseBlock[] = [];
  const bodyParts: string[] = [];
  let lastIndex = 0;
  let blockOrder = 1;

  for (const match of source.matchAll(COPY_BLOCK_REGEX)) {
    const blockStart = match.index ?? 0;
    const blockEnd = blockStart + match[0].length;
    bodyParts.push(source.slice(lastIndex, blockStart));

    const blockType = (match[1] ?? "").toLowerCase();
    const rawTitle = (match[2] ?? "").trim();
    const rawBody = (match[3] ?? "").replace(/^\n+|\n+$/g, "");
    if (blockType === "copy-input" && rawBody.length > 0) {
      copyCases.push({
        id: `copy-case-${blockOrder}`,
        title: rawTitle || `${DEFAULT_TITLE_PREFIX} ${blockOrder}`,
        input: rawBody,
        output: "",
      });
      blockOrder += 1;
    } else if (blockType === "copy-io") {
      const sectionMap = new Map<string, string>();
      for (const sectionMatch of rawBody.matchAll(IO_SECTION_REGEX)) {
        const key = sectionMatch[1]?.toLowerCase();
        const sectionContent = (sectionMatch[2] ?? "").replace(/^\n+|\n+$/g, "");
        if (!key) continue;
        sectionMap.set(key, sectionContent);
      }

      const input = sectionMap.get("input") ?? "";
      const output = sectionMap.get("output") ?? "";
      if (input.length > 0 || output.length > 0) {
        copyCases.push({
          id: `copy-case-${blockOrder}`,
          title: rawTitle || `${DEFAULT_TITLE_PREFIX} ${blockOrder}`,
          input,
          output,
        });
        blockOrder += 1;
      }
    }

    lastIndex = blockEnd;
  }

  bodyParts.push(source.slice(lastIndex));
  const markdownBody = bodyParts.join("").replace(/\n{3,}/g, "\n\n").trimEnd();

  return {
    markdownBody,
    copyCases,
  };
};
