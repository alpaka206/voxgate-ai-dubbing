import type { TargetLanguage } from "@/lib/languages";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

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

  return payload?.error?.message || "Gemini 번역 요청에 실패했습니다.";
}

function buildGeminiUrl(model: string) {
  return `${GEMINI_API_BASE_URL}/models/${model}:generateContent`;
}

export async function translateText(input: {
  sourceLanguageCode?: string | null;
  targetLanguage: TargetLanguage;
  text: string;
}) {
  const sourceLanguageCode = input.sourceLanguageCode?.toLowerCase() ?? null;

  if (sourceLanguageCode && sourceLanguageCode.startsWith(input.targetLanguage.code)) {
    return input.text.trim();
  }

  const response = await fetch(buildGeminiUrl(getGeminiModel()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getGeminiApiKey(),
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a professional dubbing translator. Translate the provided transcript into the target language. Return only the translated text with natural spoken phrasing and no explanations.",
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
                "Transcript:",
                input.text,
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const translatedText = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!translatedText) {
    throw new Error("Gemini 번역 결과를 받지 못했습니다.");
  }

  return translatedText;
}
