import { NextResponse } from "next/server";

import { getAccessState } from "@/lib/auth";
import {
  buildDubbedVideo,
  cleanupWorkspace,
  extractAudioTrack,
  getMaxUploadBytes,
  getMediaDurationSeconds,
  readFileBuffer,
  storeUploadedFile,
  writeBufferToFile,
} from "@/lib/media";
import {
  generateSpeech,
  getSpeechGenerationErrorMessage,
  getTranscriptionErrorMessage,
  isValidVoiceId,
  transcribeAudio,
} from "@/lib/elevenlabs";
import { getTargetLanguageByCode } from "@/lib/languages";
import { translateText } from "@/lib/translation";
import { getDailyUsageSummary, incrementDailyUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getOutputFileName(kind: "audio" | "video", languageCode: string) {
  return kind === "video"
    ? `readvox-dubbed-${languageCode}.mp4`
    : `readvox-dubbed-${languageCode}.mp3`;
}

export async function POST(request: Request) {
  const access = await getAccessState();

  if (!access.session) {
    return jsonResponse({ error: "로그인 후 이용할 수 있습니다." }, 401);
  }

  if (!access.email) {
    return jsonResponse({ error: "로그인 정보를 다시 확인해 주세요." }, 401);
  }

  if (!access.canUseStudio) {
    return jsonResponse(
      { error: "현재 계정은 승인 후 사용할 수 있습니다. 대시보드에서 이용 신청 상태를 확인해 주세요." },
      403,
    );
  }

  const usageSummary = await getDailyUsageSummary(access.email, access.role);

  if (usageSummary.remaining <= 0) {
    return jsonResponse(
      { error: `오늘 더빙 가능 횟수 ${usageSummary.limit}회를 모두 사용했습니다.` },
      429,
    );
  }

  const formData = await request.formData().catch(() => null);
  const media = formData?.get("media");
  const targetLanguageCode =
    typeof formData?.get("targetLanguage") === "string"
      ? String(formData.get("targetLanguage")).trim()
      : "";
  const voiceId =
    typeof formData?.get("voiceId") === "string" ? String(formData.get("voiceId")).trim() : "";

  if (!(media instanceof File)) {
    return jsonResponse({ error: "더빙할 오디오 또는 비디오 파일을 선택해 주세요." }, 400);
  }

  if (!voiceId || !isValidVoiceId(voiceId)) {
    return jsonResponse({ error: "목소리를 다시 선택해 주세요." }, 400);
  }

  const targetLanguage = getTargetLanguageByCode(targetLanguageCode);

  if (!targetLanguage) {
    return jsonResponse({ error: "타깃 언어를 다시 선택해 주세요." }, 400);
  }

  let workspaceDir = "";

  try {
    const storedUpload = await storeUploadedFile(media);
    workspaceDir = storedUpload.workspaceDir;

    const durationSeconds = await getMediaDurationSeconds(storedUpload.inputPath);

    if (durationSeconds && durationSeconds > access.maxMediaDurationSeconds) {
      return jsonResponse(
        {
          error: `현재 플랜에서는 ${access.maxMediaDurationSeconds}초 이하 파일만 더빙할 수 있습니다.`,
        },
        400,
      );
    }

    const sourceAudioPath = await extractAudioTrack(
      storedUpload.inputPath,
      storedUpload.workspaceDir,
    );
    const sourceAudioBuffer = await readFileBuffer(sourceAudioPath);

    const transcription = await transcribeAudio({
      buffer: sourceAudioBuffer,
      fileName: "source-audio.mp3",
      mimeType: "audio/mpeg",
    });

    if (!transcription.text) {
      return jsonResponse(
        {
          error:
            "업로드한 파일에서 음성을 인식하지 못했습니다. 말소리가 포함된 파일인지 확인해 주세요.",
        },
        400,
      );
    }

    const translatedText = await translateText({
      sourceLanguageCode: transcription.detectedLanguageCode,
      targetLanguage,
      text: transcription.text,
    });

    const dubbedAudioBuffer = await generateSpeech({
      languageCode: targetLanguage.code,
      text: translatedText,
      voiceId,
    });

    const dubbedAudioPath = await writeBufferToFile(
      storedUpload.workspaceDir,
      "dubbed-audio.mp3",
      dubbedAudioBuffer,
    );

    let outputBuffer = dubbedAudioBuffer;
    let outputKind: "audio" | "video" = "audio";
    let contentType = "audio/mpeg";

    if (storedUpload.kind === "video") {
      try {
        const dubbedVideoPath = await buildDubbedVideo(
          storedUpload.inputPath,
          dubbedAudioPath,
          storedUpload.workspaceDir,
        );

        outputBuffer = await readFileBuffer(dubbedVideoPath);
        outputKind = "video";
        contentType = "video/mp4";
      } catch (error) {
        console.error("비디오 결과물 합성에 실패해 오디오 결과로 대체합니다.", error);
      }
    }

    await incrementDailyUsage(access.email);

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${getOutputFileName(outputKind, targetLanguage.code)}"`,
        "Content-Type": contentType,
        "X-Readvox-Max-Upload-Bytes": String(getMaxUploadBytes()),
        "X-Readvox-Output-Kind": outputKind,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message;

      if (
        message.includes("MB") ||
        message.includes("오디오") ||
        message.includes("비디오") ||
        message.includes("파일") ||
        message.includes("GEMINI_API_KEY") ||
        message.includes("Gemini") ||
        message.includes("ELEVENLABS_API_KEY") ||
        message.includes("ElevenLabs") ||
        message.includes("voice") ||
        message.includes("model") ||
        message.includes("quota") ||
        message.includes("language")
      ) {
        return jsonResponse({ error: message }, 400);
      }
    }

    console.error("더빙 파이프라인 실행 중 오류가 발생했습니다.", error);

    const fallbackMessage =
      error instanceof Error
        ? error.message.includes("speech-to-text") || error.message.includes("transcrib")
          ? getTranscriptionErrorMessage()
          : error.message || getSpeechGenerationErrorMessage()
        : getSpeechGenerationErrorMessage();

    return jsonResponse({ error: fallbackMessage }, 502);
  } finally {
    await cleanupWorkspace(workspaceDir);
  }
}
