import { z } from "zod";
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from "../constants";
import { ResponseFormat } from "../format";

const responseFormatField = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .describe("Date in YYYY-MM-DD format (KST)");

export const SearchEditorialsInputSchema = z
  .object({
    query: z
      .string()
      .min(2, "Query must be at least 2 characters")
      .max(200, "Query must not exceed 200 characters")
      .optional()
      .describe(
        "Keyword to match against editorial title and body text (case-insensitive substring match; an English edge never matches inside a longer English word, so 'AI' skips 'said'). Omit to browse by media/date filters alone.",
      ),
    title_only: z
      .boolean()
      .default(false)
      .describe(
        "Match 'query' against the title only, skipping body text. Use for topic searches where the keyword is often mentioned in passing (e.g. 'AI'). Default: false",
      ),
    media: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Filter to a single media outlet name, e.g. '조선일보', '한겨레'. Use list_media_outlets to see valid values.",
      ),
    date_from: isoDate.optional().describe("Only include editorials published on or after this date (KST)."),
    date_to: isoDate.optional().describe("Only include editorials published on or before this date (KST)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_SEARCH_LIMIT)
      .default(DEFAULT_SEARCH_LIMIT)
      .describe(`Maximum results to return, 1-${MAX_SEARCH_LIMIT} (default: ${DEFAULT_SEARCH_LIMIT})`),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Number of results to skip for pagination (default: 0)"),
    response_format: responseFormatField,
  })
  .strict();

export type SearchEditorialsInput = z.infer<typeof SearchEditorialsInputSchema>;

export const GetEditorialInputSchema = z
  .object({
    id: z.number().int().positive().optional().describe("The editorial's numeric id (from search results)."),
    link: z.string().url().optional().describe("The editorial's original article URL, as an alternative lookup key to id."),
    response_format: responseFormatField,
  })
  .strict()
  .refine((val) => val.id !== undefined || val.link !== undefined, {
    message: "Provide either 'id' or 'link' to identify the editorial.",
  });

export type GetEditorialInput = z.infer<typeof GetEditorialInputSchema>;

export const ListMediaOutletsInputSchema = z
  .object({
    response_format: responseFormatField,
  })
  .strict();

export type ListMediaOutletsInput = z.infer<typeof ListMediaOutletsInputSchema>;
