import { del, head, put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getAccessState } from "@/lib/auth";
import {
  buildOutputBlobPath,
  getBlobAccess,
  getFileNameFromPathname,
  isAllowedUploadPath,
  shouldUseMultipartUpload,
} from "@/lib/blob";
import { createTranscriptSegments } from "@/lib/dubbing";
import {
  generateSpeech,
  getSpeechGenerationErrorMessage,
  getTranscriptionErrorMessage,
  isValidVoiceId,
  transcribeAudio,
} from "@/lib/elevenlabs";
import { getTargetLanguageByCode } from "@/lib/languages";
import {
  buildDubbedVideo,
  buildTimedDubbedAudio,
  cleanupWorkspace,
  extractAudioTrack,
  fitAudioToDuration,
  getMediaDurationSeconds,
  readFileBuffer,
  storeUploadedBuffer,
  writeBufferToFile,
} from "@/lib/media";
import { translateSegments } from "@/lib/translation";
import { getDailyUsageSummary, incrementDailyUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type DubRequestBody = {
  mediaUrl?: string;
  targetLanguage?: string;
  voiceId?: string;
};

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

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export async function POST(request: Request) {
  const access = await getAccessState();

  if (!access.session) {
    return jsonResponse({ error: "로그인이 필요합니다." }, 401);
  }

  if (!access.email) {
    return jsonResponse({ error: "로그인 정보를 다시 확인해 주세요." }, 401);
  }

  if (!access.canUseStudio) {
    return jsonResponse(
      { error: "허용 목록에 등록된 계정만 스튜디오를 사용할 수 있습니다." },
      403,
    );
  }

  const usageSummary = await getDailyUsageSummary(access.email);

  if (usageSummary.remaining <= 0) {
    return jsonResponse(
      { error: `오늘 더빙 가능 횟수 ${usageSummary.limit}회를 모두 사용했습니다.` },
      429,
    );
  }

  const body = (await request.json().catch(() => null)) as DubRequestBody | null;
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  const targetLanguageCode =
    typeof body?.targetLanguage === "string" ? body.targetLanguage.trim() : "";
  const voiceId = typeof body?.voiceId === "string" ? body.voiceId.trim() : "";

  if (!mediaUrl) {
    return jsonResponse({ error: "업로드한 파일 정보를 다시 확인해 주세요." }, 400);
  }

  if (!voiceId || !isValidVoiceId(voiceId)) {
    return jsonResponse({ error: "목소리를 다시 선택해 주세요." }, 400);
  }

  const targetLanguage = getTargetLanguageByCode(targetLanguageCode);

  if (!targetLanguage) {
    return jsonResponse({ error: "타깃 언어를 다시 선택해 주세요." }, 400);
  }

  let workspaceDir = "";
  let inputBlobUrl = "";

  try {
    const mediaMetadata = await head(mediaUrl);

    if (!isAllowedUploadPath(mediaMetadata.pathname, access.email)) {
      return jsonResponse({ error: "내 계정으로 업로드한 파일만 더빙할 수 있습니다." }, 400);
    }

    inputBlobUrl = mediaMetadata.url;

    const uploadResponse = await fetch(mediaMetadata.url, {
      cache: "no-store",
    });

    if (!uploadResponse.ok) {
      throw new Error("업로드한 파일을 다시 불러오지 못했습니다.");
    }

    const mediaBuffer = Buffer.from(await uploadResponse.arrayBuffer());
    const storedUpload = await storeUploadedBuffer({
      buffer: mediaBuffer,
      fileName: getFileNameFromPathname(mediaMetadata.pathname),
      mimeType: mediaMetadata.contentType,
    });
    workspaceDir = storedUpload.workspaceDir;

    const durationSeconds = await getMediaDurationSeconds(storedUpload.inputPath);

    if (durationSeconds && durationSeconds > access.maxMediaDurationSeconds) {
      return jsonResponse(
        {
          error: `현재 서비스에서는 ${access.maxMediaDurationSeconds}초 이하 파일만 더빙할 수 있습니다.`,
        },
        400,
      );
    }

    const sourceAudioPath = await extractAudioTrack(
      storedUpload.inputPath,
      storedUpload.workspaceDir,
    );
    const sourceAudioBuffer = await readFileBuffer(sourceAudioPath);
    const sourceAudioDurationSeconds =
      (await getMediaDurationSeconds(sourceAudioPath)) ?? durationSeconds ?? 0;

    const transcription = await transcribeAudio({
      buffer: sourceAudioBuffer,
      fileName: "source-audio.mp3",
      mimeType: "audio/mpeg",
    });

    if (!transcription.text) {
      return jsonResponse(
        {
          error:
            "업로드한 파일에서 음성을 인식하지 못했습니다. 목소리가 포함된 파일인지 확인해 주세요.",
        },
        400,
      );
    }

    const segments = createTranscriptSegments(
      transcription,
      Math.max(sourceAudioDurationSeconds, durationSeconds ?? 0),
    );

    const segmentPlans = await translateSegments({
      sourceLanguageCode: transcription.detectedLanguageCode,
      segments,
      targetLanguage,
    });

    const segmentAudioPlans = await mapWithConcurrency(segmentPlans, 2, async (segment) => {
      const segmentAudioBuffer = await generateSpeech({
        languageCode: targetLanguage.code,
        text: segment.translatedText,
        voiceId,
      });
      const rawAudioPath = await writeBufferToFile(
        storedUpload.workspaceDir,
        `dubbed-segment-${segment.index}.mp3`,
        segmentAudioBuffer,
      );
      const fittedAudioPath = await fitAudioToDuration({
        fileName: `dubbed-segment-${segment.index}-timed.mp3`,
        inputPath: rawAudioPath,
        targetDurationSeconds: Math.max(segment.endSeconds - segment.startSeconds, 0.35),
        workspaceDir: storedUpload.workspaceDir,
      });

      return {
        path: fittedAudioPath,
        startSeconds: segment.startSeconds,
      };
    });

    const dubbedAudioPath = await buildTimedDubbedAudio({
      durationSeconds: Math.max(sourceAudioDurationSeconds, durationSeconds ?? 0, 0.35),
      segments: segmentAudioPlans,
      workspaceDir: storedUpload.workspaceDir,
    });

    let outputPath = dubbedAudioPath;
    let outputKind: "audio" | "video" = "audio";
    let contentType = "audio/mpeg";

    if (storedUpload.kind === "video") {
      try {
        outputPath = await buildDubbedVideo({
          durationSeconds: Math.max(durationSeconds ?? sourceAudioDurationSeconds, 0.35),
          dubbedAudioPath,
          inputVideoPath: storedUpload.inputPath,
          workspaceDir: storedUpload.workspaceDir,
        });
        outputKind = "video";
        contentType = "video/mp4";
      } catch (error) {
        console.error("비디오 합성에 실패해 오디오 결과로 대체합니다.", error);
      }
    }

    const outputBuffer = await readFileBuffer(outputPath);
    const outputFileName = getOutputFileName(outputKind, targetLanguage.code);
    const outputBlob = await put(
      buildOutputBlobPath(access.email, outputFileName),
      outputBuffer,
      {
        access: getBlobAccess(),
        addRandomSuffix: false,
        contentType,
        multipart: shouldUseMultipartUpload(outputBuffer.byteLength),
      },
    );

    await incrementDailyUsage(access.email);

    return jsonResponse(
      {
        downloadUrl: outputBlob.downloadUrl,
        fileName: outputFileName,
        kind: outputKind,
        url: outputBlob.url,
      },
      200,
    );
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message;

      if (message.includes("BLOB_READ_WRITE_TOKEN") || message.includes("Vercel Blob")) {
        return jsonResponse({ error: "Vercel Blob 설정을 확인해 주세요." }, 500);
      }

      if (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("Too Many Requests") ||
        message.includes("retry in")
      ) {
        return jsonResponse({ error: message }, 429);
      }

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

    if (inputBlobUrl) {
      await del(inputBlobUrl).catch((error) => {
        console.error("업로드한 Blob 파일을 정리하지 못했습니다.", error);
      });
    }
  }
}
