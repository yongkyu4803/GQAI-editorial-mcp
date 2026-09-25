import { CHARACTER_LIMIT, KST_TIME_ZONE, SNIPPET_LENGTH } from "./constants";
import type { EditorialDetail, EditorialRow, EditorialSummary, MediaOutletCount } from "./types";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export function formatKstDate(iso: string | null): string {
  if (!iso) return "날짜 미상";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: KST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function snippetOf(content: string | null): string {
  if (!content) return "(본문 없음)";
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > SNIPPET_LENGTH ? `${clean.slice(0, SNIPPET_LENGTH)}…` : clean;
}

export function toEditorialSummary(row: EditorialRow): EditorialSummary {
  return {
    id: row.id,
    title: row.title ?? "(제목 없음)",
    media: row.media ?? "(언론사 미상)",
    published_at: row.published_at ?? row.pubdate,
    link: row.link,
    snippet: snippetOf(row.content),
  };
}

export function toEditorialDetail(row: EditorialRow): EditorialDetail {
  const rawContent = row.content ?? "";
  const truncated = rawContent.length > CHARACTER_LIMIT;
  return {
    id: row.id,
    title: row.title ?? "(제목 없음)",
    media: row.media ?? "(언론사 미상)",
    published_at: row.published_at ?? row.pubdate,
    link: row.link,
    content: truncated ? rawContent.slice(0, CHARACTER_LIMIT) : rawContent,
    truncated,
  };
}

export function formatSearchResultsMarkdown(
  results: EditorialSummary[],
  total: number,
  offset: number,
  hasMore: boolean,
): string {
  if (results.length === 0) {
    return "검색 조건에 맞는 사설을 찾지 못했습니다. 키워드를 더 짧게 하거나 media/기간 필터를 완화해보세요.";
  }

  const lines: string[] = [
    `# 사설 검색 결과 (총 ${total}건 중 ${offset + 1}-${offset + results.length}번째)`,
    "",
  ];

  for (const item of results) {
    lines.push(`## ${item.title} (id: ${item.id})`);
    lines.push(`- **언론사**: ${item.media}`);
    lines.push(`- **발행일**: ${formatKstDate(item.published_at)}`);
    if (item.matched_in) lines.push(`- **일치 위치**: ${item.matched_in === "title" ? "제목" : "본문"}`);
    if (item.link) lines.push(`- **원문**: ${item.link}`);
    lines.push(`- **미리보기**: ${item.snippet}`);
    lines.push("");
  }

  if (hasMore) {
    lines.push(
      `> 더 많은 결과가 있습니다. offset=${offset + results.length} 로 다시 호출하세요.`,
    );
  }
  lines.push("");
  lines.push("전문(본문)이 필요하면 `get_editorial` 툴에 해당 id를 전달하세요.");

  return lines.join("\n");
}

export function formatSearchResultsJson(
  results: EditorialSummary[],
  total: number,
  offset: number,
  hasMore: boolean,
): string {
  return JSON.stringify(
    {
      total,
      count: results.length,
      offset,
      has_more: hasMore,
      next_offset: hasMore ? offset + results.length : undefined,
      results,
    },
    null,
    2,
  );
}

export function formatEditorialDetailMarkdown(item: EditorialDetail): string {
  const lines = [
    `# ${item.title}`,
    "",
    `- **id**: ${item.id}`,
    `- **언론사**: ${item.media}`,
    `- **발행일**: ${formatKstDate(item.published_at)}`,
  ];
  if (item.link) lines.push(`- **원문**: ${item.link}`);
  lines.push("", "## 본문", "", item.content);
  if (item.truncated) {
    lines.push(
      "",
      `> 본문이 ${CHARACTER_LIMIT.toLocaleString()}자를 초과해 잘렸습니다. 전체 본문은 원문 링크를 확인하세요.`,
    );
  }
  return lines.join("\n");
}

export function formatEditorialDetailJson(item: EditorialDetail): string {
  return JSON.stringify(item, null, 2);
}

export function formatMediaOutletsMarkdown(outlets: MediaOutletCount[], totalRows: number): string {
  const lines = [`# 등록된 언론사 (${outlets.length}곳, 전체 사설 ${totalRows}건)`, ""];
  for (const outlet of outlets) {
    lines.push(`- **${outlet.media}**: ${outlet.count}건`);
  }
  return lines.join("\n");
}

export function formatMediaOutletsJson(outlets: MediaOutletCount[], totalRows: number): string {
  return JSON.stringify({ total_rows: totalRows, outlet_count: outlets.length, outlets }, null, 2);
}
