import type { TranscriptSegment } from "@/lib/dubbing";
import type { TargetLanguage } from "@/lib/languages";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_TRANSLATION_BATCH_CHARACTERS = 6_000;
const MAX_TRANSLATION_BATCH_SEGMENTS = 30;
const MAX_TRANSLATION_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 30_000;

type BatchTranslationItem = {
  index: number;
  text: string;
};

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("환경 변수가 설정되지 않았습니다. GEMINI_API_KEY");
  }

  return apiKey;
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  return payload?.error?.message || "Gemini 번역 요청이 실패했습니다.";
}

function buildGeminiUrl(model: string) {
  return `${GEMINI_API_BASE_URL}/models/${model}:generateContent`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parseRetryDelayMs(input: { message: string; retryAfterHeader: string | null }) {
  const retryAfterSeconds = Number.parseFloat(input.retryAfterHeader ?? "");

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(Math.ceil(retryAfterSeconds * 1_000), MAX_RETRY_DELAY_MS);
  }

  const retryAfterDate = input.retryAfterHeader ? Date.parse(input.retryAfterHeader) : Number.NaN;

  if (Number.isFinite(retryAfterDate)) {
    return Math.min(Math.max(retryAfterDate - Date.now(), 1_000), MAX_RETRY_DELAY_MS);
  }

  const retryAfterMatch = input.message.match(/retry in\s+([\d.]+)s/i);

  if (retryAfterMatch) {
    const retryAfterMilliseconds = Number.parseFloat(retryAfterMatch[1]) * 1_000;

    if (Number.isFinite(retryAfterMilliseconds) && retryAfterMilliseconds > 0) {
      return Math.min(Math.ceil(retryAfterMilliseconds), MAX_RETRY_DELAY_MS);
    }
  }

  return DEFAULT_RETRY_DELAY_MS;
}

async function requestGeminiText(body: Record<string, unknown>) {
  for (let attempt = 0; attempt <= MAX_TRANSLATION_RETRIES; attempt += 1) {
    const response = await fetch(buildGeminiUrl(getGeminiModel()), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getGeminiApiKey(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new Error("Gemini 번역 결과를 받지 못했습니다.");
      }

      return text;
    }

    const message = await readApiError(response);

    if (response.status === 429 && attempt < MAX_TRANSLATION_RETRIES) {
      const retryDelayMs = parseRetryDelayMs({
        message,
        retryAfterHeader: response.headers.get("retry-after"),
      });

      await wait(retryDelayMs);
      continue;
    }

    throw new Error(message);
  }

  throw new Error("Gemini 번역 요청이 실패했습니다.");
}

function stripJsonCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseBatchTranslationResponse(text: string) {
  const normalized = stripJsonCodeFence(text);
  const objectStartIndex = normalized.indexOf("{");
  const objectEndIndex = normalized.lastIndexOf("}");
  const jsonText =
    objectStartIndex >= 0 && objectEndIndex >= objectStartIndex
      ? normalized.slice(objectStartIndex, objectEndIndex + 1)
      : normalized;

  const payload = JSON.parse(jsonText) as {
    translations?: Array<{
      index?: number;
      text?: string;
    }>;
  };

  if (!Array.isArray(payload.translations)) {
    throw new Error("Gemini 번역 결과 형식이 올바르지 않습니다.");
  }

  return payload.translations.map((item) => {
    if (typeof item.index !== "number" || typeof item.text !== "string") {
      throw new Error("Gemini 번역 결과 형식이 올바르지 않습니다.");
    }

    return {
      index: item.index,
      text: item.text.trim(),
    };
  });
}

function createTranslationBatches(segments: TranscriptSegment[]) {
  const batches: TranscriptSegment[][] = [];
  let currentBatch: TranscriptSegment[] = [];
  let currentBatchCharacters = 0;

  for (const segment of segments) {
    const segmentCharacters = segment.text.length;
    const wouldExceedCharacters =
      currentBatch.length > 0 &&
      currentBatchCharacters + segmentCharacters > MAX_TRANSLATION_BATCH_CHARACTERS;
    const wouldExceedCount =
      currentBatch.length > 0 && currentBatch.length >= MAX_TRANSLATION_BATCH_SEGMENTS;

    if (wouldExceedCharacters || wouldExceedCount) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchCharacters = 0;
    }

    currentBatch.push(segment);
    currentBatchCharacters += segmentCharacters;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function translateBatch(input: {
  sourceLanguageCode?: string | null;
  targetLanguage: TargetLanguage;
  segments: TranscriptSegment[];
}) {
  const sourceLanguageCode = input.sourceLanguageCode?.toLowerCase() ?? null;
  const items: BatchTranslationItem[] = input.segments.map((segment) => ({
    index: segment.index,
    text: segment.text,
  }));

  const responseText = await requestGeminiText({
    systemInstruction: {
      parts: [
        {
          text: [
            "You are a professional dubbing translator.",
            "Translate each segment into the target language with natural spoken phrasing.",
            "Preserve the original order and return JSON only.",
            'Use this exact shape: {"translations":[{"index":0,"text":"..."}]}.',
            "Do not merge, drop, or add segments.",
          ].join(" "),
        },
      ],
    },
    contents: [
      {
        parts: [
          {
            text: [
              `Source language: ${sourceLanguageCode || "auto-detected"}`,
              `Target language: ${input.targetLanguage.openAiLabel}`,
              "Segments JSON:",
              JSON.stringify(items),
            ].join("\n\n"),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const translatedItems = parseBatchTranslationResponse(responseText);
  const translatedByIndex = new Map(translatedItems.map((item) => [item.index, item.text]));

  if (translatedByIndex.size !== input.segments.length) {
    throw new Error("Gemini 번역 결과 개수가 원본 세그먼트 수와 맞지 않습니다.");
  }

  return input.segments.map((segment) => {
    const translatedText = translatedByIndex.get(segment.index);

    if (!translatedText) {
      throw new Error("Gemini 번역 결과에 일부 세그먼트가 누락되었습니다.");
    }

    return {
      ...segment,
      translatedText,
    };
  });
}

export async function translateSegments(input: {
  sourceLanguageCode?: string | null;
  targetLanguage: TargetLanguage;
  segments: TranscriptSegment[];
}) {
  const sourceLanguageCode = input.sourceLanguageCode?.toLowerCase() ?? null;

  if (sourceLanguageCode && sourceLanguageCode.startsWith(input.targetLanguage.code)) {
    return input.segments.map((segment) => ({
      ...segment,
      translatedText: segment.text.trim(),
    }));
  }

  const batches = createTranslationBatches(input.segments);
  const translatedSegments: Array<TranscriptSegment & { translatedText: string }> = [];

  for (const batch of batches) {
    const translatedBatch = await translateBatch({
      sourceLanguageCode,
      targetLanguage: input.targetLanguage,
      segments: batch,
    });
    translatedSegments.push(...translatedBatch);
  }

  return translatedSegments.sort((left, right) => left.index - right.index);
}
