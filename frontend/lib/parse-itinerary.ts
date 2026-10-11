export interface ItineraryRowItem {
  time: string;
  activity: string;
  cost: string;
}

export interface ParsedDay {
  dayNumber: number;
  id: string;
  label: string;
  title: string;
  rawMarkdown: string;
  rows: ItineraryRowItem[];
  dayTotal?: string;
  extraMarkdown: string;
}

export interface ParsedItinerary {
  hasStructuredDays: boolean;
  preambleMarkdown: string;
  days: ParsedDay[];
  summaryMarkdown: string;
  rawMarkdown: string;
}

const DAY_HEADING_REGEX =
  /^(#{2,4})\s*(?:\*\*|__)?Day\s+(\d+)(?:\*\*|__)?(?:\s*(?:[-–—‑‐−:]\s*|\(\s*)(.*?)(?:\)\s*)?)?(?:\*\*|__)?\s*$/gim;

const SUMMARY_START_REGEX =
  /^(?:#{1,4}\s*(?:\*\*|__)?(?:Total\s+Estimated|Trip\s+Summary|Summary|Practical\s+Tips|Important\s+Travel|Estimated\s+Total|Budget\s+Summary|Overall\s+Cost|Travel\s+Tips|Final\s+Notes)|\*\*(?:Total\s+estimated\s+trip\s+cost|Practical\s+tips|Important\s+travel\s+considerations)\*\*)/im;

function cleanCell(cell: string): string {
  return cell
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.map((c) => c.toLowerCase()).join(" ");
  return (
    joined.includes("time") &&
    (joined.includes("activity") ||
      joined.includes("plan") ||
      joined.includes("description") ||
      joined.includes("cost"))
  );
}

function splitLastDayAndSummary(dayBody: string): {
  dayContent: string;
  summaryContent: string;
} {
  const match = SUMMARY_START_REGEX.exec(dayBody);
  if (match && match.index !== undefined) {
    let splitIndex = match.index;
    const before = dayBody.slice(0, splitIndex);
    const trailingHrMatch = before.match(/\n---\s*\n\s*$/);
    if (trailingHrMatch && trailingHrMatch.index !== undefined) {
      splitIndex = trailingHrMatch.index;
    }
    return {
      dayContent: dayBody.slice(0, splitIndex).trim(),
      summaryContent: dayBody
        .slice(match.index)
        .replace(/^---\s*\n/, "")
        .trim(),
    };
  }

  const hrSplit = dayBody.split(/\n---\s*\n/);
  if (hrSplit.length > 1) {
    const lastChunk = hrSplit[hrSplit.length - 1].trim();
    if (
      /total|tip|consideration|note|summary|budget|cost/i.test(
        lastChunk.slice(0, 120)
      )
    ) {
      return {
        dayContent: hrSplit.slice(0, -1).join("\n---\n").trim(),
        summaryContent: lastChunk,
      };
    }
  }

  return {
    dayContent: dayBody.trim(),
    summaryContent: "",
  };
}

function parseDayBody(body: string): {
  rows: ItineraryRowItem[];
  dayTotal?: string;
  extraMarkdown: string;
} {
  const lines = body.split(/\r?\n/);
  const rows: ItineraryRowItem[] = [];
  const extraLines: string[] = [];
  let dayTotal: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\|.*\|$/.test(trimmed)) {
      const rawCells = trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

      if (rawCells.length >= 2) {
        if (isSeparatorRow(rawCells) || isHeaderRow(rawCells)) {
          continue;
        }
        const time = cleanCell(rawCells[0] || "");
        const activity = cleanCell(rawCells[1] || "");
        const cost = cleanCell(rawCells[2] || "");
        if (time || activity) {
          rows.push({
            time: time || "Flexible",
            activity,
            cost: cost || "Included",
          });
          continue;
        }
      }
    }

    const totalMatch = trimmed.match(
      /^(?:\*\*|__)?Day\s+\d+\s+total(?:\*\*|__)?\s*[:–—-]\s*(.+)$/i
    );
    if (totalMatch) {
      dayTotal = cleanCell(totalMatch[1]);
      continue;
    }

    extraLines.push(line);
  }

  return {
    rows,
    dayTotal,
    extraMarkdown: extraLines.join("\n").trim(),
  };
}

export function parseItinerary(markdown: string): ParsedItinerary {
  const normalized = (markdown || "").trim();
  if (!normalized) {
    return {
      hasStructuredDays: false,
      preambleMarkdown: "",
      days: [],
      summaryMarkdown: "",
      rawMarkdown: "",
    };
  }

  const matches: Array<{
    index: number;
    fullMatch: string;
    dayNumber: number;
    title: string;
  }> = [];

  DAY_HEADING_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DAY_HEADING_REGEX.exec(normalized)) !== null) {
    const dayNum = Number.parseInt(match[2], 10);
    const rawTitle = (match[3] || "").replace(/(?:\*\*|__)$/g, "").trim();
    matches.push({
      index: match.index,
      fullMatch: match[0],
      dayNumber: dayNum,
      title: rawTitle || `Day ${dayNum}`,
    });
  }

  if (matches.length === 0) {
    return {
      hasStructuredDays: false,
      preambleMarkdown: "",
      days: [],
      summaryMarkdown: "",
      rawMarkdown: normalized,
    };
  }

  const preambleMarkdown = normalized.slice(0, matches[0].index).trim();
  let summaryMarkdown = "";
  const days: ParsedDay[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startOfBody = current.index + current.fullMatch.length;
    const endOfBody =
      i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    let bodySlice = normalized.slice(startOfBody, endOfBody).trim();

    if (i === matches.length - 1) {
      const split = splitLastDayAndSummary(bodySlice);
      bodySlice = split.dayContent;
      summaryMarkdown = split.summaryContent;
    }

    const { rows, dayTotal, extraMarkdown } = parseDayBody(bodySlice);
    const rawDayMarkdown = `${current.fullMatch}\n\n${bodySlice}`.trim();

    days.push({
      dayNumber: current.dayNumber,
      id: `day-${current.dayNumber}`,
      label: `Day ${current.dayNumber}`,
      title: current.title,
      rawMarkdown: rawDayMarkdown,
      rows,
      dayTotal,
      extraMarkdown,
    });
  }

  return {
    hasStructuredDays: true,
    preambleMarkdown,
    days,
    summaryMarkdown,
    rawMarkdown: normalized,
  };
}
