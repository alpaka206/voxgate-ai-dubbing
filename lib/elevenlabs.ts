export type VoiceOption = {
  id: string;
  label: string;
  name: string;
};

export type TranscriptionWord = {
  end: number;
  speakerId: string | null;
  start: number;
  text: string;
  type: string;
};

export type TranscriptionResult = {
  detectedLanguageCode: string | null;
  text: string;
  words: TranscriptionWord[];
};

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";
const ELEVENLABS_HOSTNAME = "api.elevenlabs.io";
const DEFAULT_TTS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_STT_MODEL_ID = "scribe_v2";
const voiceIdPattern = /^[A-Za-z0-9_-]{5,100}$/;

export function isValidVoiceId(voiceId: string) {
  return voiceIdPattern.test(voiceId);
}

function sanitizeTextInput(text: string) {
  return text.replace(/\r\n/g, "\n").trim();
}

function getApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("환경 변수가 설정되지 않았습니다. ELEVENLABS_API_KEY");
  }

  return apiKey;
}

function buildElevenLabsUrl(path: string) {
  const url = new URL(path, `${ELEVENLABS_API_URL}/`);

  if (url.protocol !== "https:" || url.hostname !== ELEVENLABS_HOSTNAME) {
    throw new Error("허용되지 않은 ElevenLabs 요청 주소입니다.");
  }

  return url;
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: { message?: string } | string; message?: string }
      | null;

    if (typeof payload?.detail === "string") {
      return payload.detail;
    }

    if (typeof payload?.detail?.message === "string") {
      return payload.detail.message;
    }

    if (typeof payload?.message === "string") {
      return payload.message;
    }
  }

  const text = await response.text().catch(() => "");
  return text || "ElevenLabs 요청에 실패했습니다.";
}

export function getVoiceListErrorMessage() {
  return "목소리 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export function getSpeechGenerationErrorMessage() {
  return "더빙 음성을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export function getTranscriptionErrorMessage() {
  return "업로드한 파일의 음성을 인식하지 못했습니다.";
}

export async function listVoices(): Promise<VoiceOption[]> {
  const response = await fetch(buildElevenLabsUrl("voices"), {
    cache: "no-store",
    headers: {
      "xi-api-key": getApiKey(),
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as {
    voices?: Array<{
      category?: string;
      name: string;
      voice_id: string;
    }>;
  };

  return (payload.voices ?? [])
    .filter((voice) => isValidVoiceId(voice.voice_id))
    .map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      label: voice.category ? `${voice.name} (${voice.category})` : voice.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function transcribeAudio(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  const formData = new FormData();
  const fileBytes = new Uint8Array(input.buffer.byteLength);
  fileBytes.set(input.buffer);

  formData.append(
    "file",
    new Blob([fileBytes], { type: input.mimeType || "audio/mpeg" }),
    input.fileName,
  );
  formData.append("model_id", process.env.ELEVENLABS_STT_MODEL_ID || DEFAULT_STT_MODEL_ID);
  formData.append("timestamps_granularity", "word");

  const response = await fetch(buildElevenLabsUrl("speech-to-text"), {
    method: "POST",
    body: formData,
    headers: {
      "xi-api-key": getApiKey(),
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as {
    language_code?: string;
    text?: string;
    words?: Array<{
      end?: number;
      speaker_id?: string | null;
      start?: number;
      text?: string;
      type?: string;
    }>;
  };

  return {
    detectedLanguageCode:
      typeof payload.language_code === "string" ? payload.language_code.toLowerCase() : null,
    text: typeof payload.text === "string" ? payload.text.trim() : "",
    words: (payload.words ?? [])
      .filter(
        (word) =>
          typeof word.text === "string" &&
          typeof word.start === "number" &&
          typeof word.end === "number",
      )
      .map((word) => ({
        end: word.end as number,
        speakerId: typeof word.speaker_id === "string" ? word.speaker_id : null,
        start: word.start as number,
        text: word.text as string,
        type: typeof word.type === "string" ? word.type : "word",
      })),
  } satisfies TranscriptionResult;
}

export async function generateSpeech(input: {
  languageCode?: string;
  text: string;
  voiceId: string;
}) {
  if (!isValidVoiceId(input.voiceId)) {
    throw new Error("선택한 목소리 정보가 올바르지 않습니다.");
  }

  const text = sanitizeTextInput(input.text);

  if (!text) {
    throw new Error("음성용 텍스트가 비어 있습니다.");
  }

  const response = await fetch(buildElevenLabsUrl(`text-to-speech/${input.voiceId}`), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": getApiKey(),
    },
    body: JSON.stringify({
      language_code: input.languageCode,
      model_id: process.env.ELEVENLABS_MODEL_ID || DEFAULT_TTS_MODEL_ID,
      output_format: "mp3_44100_128",
      text,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return Buffer.from(await response.arrayBuffer());
}
