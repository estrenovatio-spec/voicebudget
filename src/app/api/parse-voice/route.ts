import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultCategories } from "@/lib/categories";
import { parseTranscriptServer } from "@/lib/parse-voice-server";
import type { Locale } from "@/types";

const TELEGRAM_ORIGIN_PATTERN = /\.telegram\.org$/;

const bodySchema = z.object({
  transcript: z.string().min(1),
  locale: z.enum(["ru", "en"]),
  partnerName: z.string().nullable().optional(),
});

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin &&
    (origin === "https://web.telegram.org" || TELEGRAM_ORIGIN_PATTERN.test(new URL(origin).hostname));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://web.telegram.org",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const categories = getDefaultCategories();

  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { transcript, locale, partnerName } = parsed.data;

    const { data, fallback } = await parseTranscriptServer(
      transcript,
      locale as Locale,
      categories,
      partnerName,
    );

    return NextResponse.json(
      { success: true, data, fallback },
      { headers: corsHeaders(origin) },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to parse transcript" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }
}
