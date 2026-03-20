import { CLIENT_UPLOAD_CLIP_DURATION_SECONDS } from "@/lib/media-policy";

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv"]);
const FFMPEG_CORE_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/umd";
const FFMPEG_EXEC_TIMEOUT_MS = 120_000;

type UploadPreparationMode = "none" | "clip" | "compress";

type LoadedFfmpeg = {
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg;
  workerFsType: import("@ffmpeg/ffmpeg").FFFSType;
};

type FfmpegJobContext = {
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg;
  inputPath: string;
  inputDir: string;
  outputDir: string;
};

export type MediaUploadAnalysis = {
  durationSeconds: number | null;
  needsClientProcessing: boolean;
  processingMode: UploadPreparationMode;
  uploadDurationSeconds: number | null;
};

export type PreparedMediaUpload = MediaUploadAnalysis & {
  file: File;
  wasTranscoded: boolean;
};

type PrepareMediaUploadOptions = {
  durationSeconds?: number | null;
  maxUploadBytes: number;
  onProgress?: (progress: number | null) => void;
};

let ffmpegPromise: Promise<LoadedFfmpeg> | null = null;
let coreAssetUrlsPromise: Promise<{ coreURL: string; wasmURL: string }> | null = null;

function getFileExtension(fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return "";
  }

  return fileName.slice(extensionIndex).toLowerCase();
}

function getFileNameWithoutExtension(fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return fileName || "upload";
  }

  return fileName.slice(0, extensionIndex);
}

function detectMediaKind(file: File) {
  if (file.type.startsWith("video/")) {
    return "video" as const;
  }

  if (file.type.startsWith("audio/")) {
    return "audio" as const;
  }

  const extension = getFileExtension(file.name);

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video" as const;
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio" as const;
  }

  return "audio" as const;
}

function buildUploadAnalysis(
  file: File,
  maxUploadBytes: number,
  durationSeconds: number | null,
): MediaUploadAnalysis {
  if (durationSeconds !== null && durationSeconds > CLIENT_UPLOAD_CLIP_DURATION_SECONDS) {
    return {
      durationSeconds,
      needsClientProcessing: true,
      processingMode: "clip",
      uploadDurationSeconds: CLIENT_UPLOAD_CLIP_DURATION_SECONDS,
    };
  }

  if (file.size > maxUploadBytes) {
    return {
      durationSeconds,
      needsClientProcessing: true,
      processingMode: durationSeconds === null ? "clip" : "compress",
      uploadDurationSeconds:
        durationSeconds === null
          ? CLIENT_UPLOAD_CLIP_DURATION_SECONDS
          : Math.min(durationSeconds, CLIENT_UPLOAD_CLIP_DURATION_SECONDS),
    };
  }

  return {
    durationSeconds,
    needsClientProcessing: false,
    processingMode: "none",
    uploadDurationSeconds: durationSeconds,
  };
}

function clampUploadDuration(durationSeconds: number | null) {
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return CLIENT_UPLOAD_CLIP_DURATION_SECONDS;
  }

  return Math.min(durationSeconds, CLIENT_UPLOAD_CLIP_DURATION_SECONDS);
}

function buildOutputFileName(
  file: File,
  suffix: "clip-60s" | "mobile-upload",
  extension: string,
) {
  const baseName = getFileNameWithoutExtension(file.name);
  return `${baseName}-${suffix}${extension}`;
}

function getDirectCopyExtension(file: File) {
  const originalExtension = getFileExtension(file.name);

  if (originalExtension) {
    return originalExtension;
  }

  return detectMediaKind(file) === "video" ? ".mp4" : ".m4a";
}

function getDirectCopyMimeType(file: File, extension: string) {
  if (file.type) {
    return file.type;
  }

  switch (extension) {
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".mkv":
      return "video/x-matroska";
    case ".webm":
      return detectMediaKind(file) === "video" ? "video/webm" : "audio/webm";
    case ".wav":
      return "audio/wav";
    case ".aac":
      return "audio/aac";
    case ".ogg":
      return "audio/ogg";
    case ".mp3":
      return "audio/mpeg";
    default:
      return detectMediaKind(file) === "video" ? "video/mp4" : "audio/mp4";
  }
}

async function getCoreAssetUrls() {
  if (!coreAssetUrlsPromise) {
    coreAssetUrlsPromise = (async () => {
      const { toBlobURL } = await import("@ffmpeg/util");

      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      ]);

      return {
        coreURL,
        wasmURL,
      };
    })().catch((error) => {
      coreAssetUrlsPromise = null;
      throw error;
    });
  }

  return coreAssetUrlsPromise;
}

async function loadFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg, FFFSType }, { coreURL, wasmURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        getCoreAssetUrls(),
      ]);
      const ffmpeg = new FFmpeg();

      await ffmpeg.load({
        coreURL,
        wasmURL,
      });

      return {
        ffmpeg,
        workerFsType: FFFSType.WORKERFS,
      } satisfies LoadedFfmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }

  return ffmpegPromise;
}

async function createJobContext(file: File, ffmpegState: LoadedFfmpeg) {
  const jobId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const inputDir = `/input-${jobId}`;
  const outputDir = `/output-${jobId}`;

  await ffmpegState.ffmpeg.createDir(inputDir);
  await ffmpegState.ffmpeg.createDir(outputDir);
  await ffmpegState.ffmpeg.mount(ffmpegState.workerFsType, { files: [file] }, inputDir);

  return {
    ffmpeg: ffmpegState.ffmpeg,
    inputDir,
    inputPath: `${inputDir}/${file.name}`,
    outputDir,
  } satisfies FfmpegJobContext;
}

async function cleanupJobContext(context: FfmpegJobContext) {
  await context.ffmpeg.unmount(context.inputDir).catch(() => undefined);
  await context.ffmpeg.deleteDir(context.inputDir).catch(() => undefined);
  await context.ffmpeg.deleteDir(context.outputDir).catch(() => undefined);
}

async function runFfmpegCommand(ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg, args: string[]) {
  const exitCode = await ffmpeg.exec(args, FFMPEG_EXEC_TIMEOUT_MS);

  if (exitCode !== 0) {
    throw new Error("브라우저에서 업로드용 미디어를 준비하지 못했습니다.");
  }
}

async function readOutputFile(
  context: FfmpegJobContext,
  outputPath: string,
  fileName: string,
  mimeType: string,
) {
  const outputData = await context.ffmpeg.readFile(outputPath);

  if (!(outputData instanceof Uint8Array)) {
    throw new Error("브라우저에서 생성한 클립을 읽지 못했습니다.");
  }

  await context.ffmpeg.deleteFile(outputPath).catch(() => undefined);

  const outputBuffer = new ArrayBuffer(outputData.byteLength);
  new Uint8Array(outputBuffer).set(outputData);

  return new File([outputBuffer], fileName, {
    lastModified: Date.now(),
    type: mimeType,
  });
}

async function probeDurationSeconds(context: FfmpegJobContext) {
  const probeOutputPath = `${context.outputDir}/duration.txt`;
  const exitCode = await context.ffmpeg.ffprobe(
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      context.inputPath,
      "-o",
      probeOutputPath,
    ],
    FFMPEG_EXEC_TIMEOUT_MS,
  );

  if (exitCode !== 0) {
    return null;
  }

  const outputData = await context.ffmpeg.readFile(probeOutputPath, "utf8");
  await context.ffmpeg.deleteFile(probeOutputPath).catch(() => undefined);

  if (typeof outputData !== "string") {
    return null;
  }

  const durationSeconds = Number.parseFloat(outputData.trim());

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return durationSeconds;
}

async function createClippedFile(
  context: FfmpegJobContext,
  file: File,
  targetDurationSeconds: number,
) {
  const extension = getDirectCopyExtension(file);
  const outputPath = `${context.outputDir}/prepared${extension}`;

  await runFfmpegCommand(context.ffmpeg, [
    "-i",
    context.inputPath,
    "-t",
    targetDurationSeconds.toFixed(3),
    "-c",
    "copy",
    outputPath,
  ]);

  return readOutputFile(
    context,
    outputPath,
    buildOutputFileName(file, "clip-60s", extension),
    getDirectCopyMimeType(file, extension),
  );
}

async function createCompressedFile(
  context: FfmpegJobContext,
  file: File,
  targetDurationSeconds: number,
) {
  const mediaKind = detectMediaKind(file);

  if (mediaKind === "video") {
    const outputPath = `${context.outputDir}/mobile-upload.mp4`;

    await runFfmpegCommand(context.ffmpeg, [
      "-i",
      context.inputPath,
      "-t",
      targetDurationSeconds.toFixed(3),
      "-vf",
      "scale='min(1280,iw)':-2",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "mpeg4",
      "-b:v",
      "3500k",
      "-maxrate",
      "3500k",
      "-bufsize",
      "7000k",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    return readOutputFile(
      context,
      outputPath,
      buildOutputFileName(file, "mobile-upload", ".mp4"),
      "video/mp4",
    );
  }

  const outputPath = `${context.outputDir}/mobile-upload.m4a`;

  await runFfmpegCommand(context.ffmpeg, [
    "-i",
    context.inputPath,
    "-t",
    targetDurationSeconds.toFixed(3),
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ]);

  return readOutputFile(
    context,
    outputPath,
    buildOutputFileName(file, "mobile-upload", ".m4a"),
    "audio/mp4",
  );
}

export async function getClientMediaDurationSeconds(file: File) {
  const mediaElement = document.createElement(detectMediaKind(file) === "video" ? "video" : "audio");
  const objectUrl = URL.createObjectURL(file);

  return new Promise<number | null>((resolve) => {
    let settled = false;

    const cleanup = () => {
      mediaElement.pause();
      mediaElement.removeAttribute("src");
      mediaElement.load();
      URL.revokeObjectURL(objectUrl);
    };

    const finish = (value: number | null) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(value);
    };

    mediaElement.preload = "metadata";
    mediaElement.src = objectUrl;

    mediaElement.onloadedmetadata = () => {
      const nextDuration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : null;

      finish(nextDuration && nextDuration > 0 ? nextDuration : null);
    };

    mediaElement.onerror = () => finish(null);
  });
}

export async function analyzeMediaFileForUpload(file: File, maxUploadBytes: number) {
  const durationSeconds = await getClientMediaDurationSeconds(file);
  return buildUploadAnalysis(file, maxUploadBytes, durationSeconds);
}

export async function prepareMediaFileForUpload(
  file: File,
  options: PrepareMediaUploadOptions,
): Promise<PreparedMediaUpload> {
  let durationSeconds =
    options.durationSeconds === undefined
      ? await getClientMediaDurationSeconds(file)
      : options.durationSeconds;
  let analysis = buildUploadAnalysis(file, options.maxUploadBytes, durationSeconds);

  if (!analysis.needsClientProcessing && durationSeconds !== null) {
    return {
      ...analysis,
      file,
      wasTranscoded: false,
    };
  }

  const ffmpegState = await loadFfmpeg();
  const context = await createJobContext(file, ffmpegState);
  const progressHandler = (event: { progress: number }) => {
    if (!Number.isFinite(event.progress)) {
      options.onProgress?.(null);
      return;
    }

    options.onProgress?.(Math.max(0, Math.min(1, event.progress)));
  };

  context.ffmpeg.on("progress", progressHandler);

  try {
    if (durationSeconds === null) {
      durationSeconds = await probeDurationSeconds(context);
      analysis = buildUploadAnalysis(file, options.maxUploadBytes, durationSeconds);

      if (!analysis.needsClientProcessing) {
        return {
          ...analysis,
          file,
          wasTranscoded: false,
        };
      }
    }

    const targetDurationSeconds = clampUploadDuration(durationSeconds);

    if (analysis.processingMode === "clip") {
      try {
        const clippedFile = await createClippedFile(context, file, targetDurationSeconds);

        if (clippedFile.size <= options.maxUploadBytes) {
          return {
            ...analysis,
            durationSeconds,
            file: clippedFile,
            uploadDurationSeconds: targetDurationSeconds,
            wasTranscoded: false,
          };
        }
      } catch {
        // Falls back to a smaller transcoded upload below.
      }
    }

    const compressedFile = await createCompressedFile(context, file, targetDurationSeconds);

    if (compressedFile.size > options.maxUploadBytes) {
      throw new Error(
        `브라우저에서 준비한 업로드용 파일도 ${Math.round(options.maxUploadBytes / (1024 * 1024))}MB를 넘었습니다. 더 짧거나 해상도가 낮은 파일로 다시 시도해 주세요.`,
      );
    }

    return {
      ...analysis,
      durationSeconds,
      file: compressedFile,
      uploadDurationSeconds: targetDurationSeconds,
      wasTranscoded: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("브라우저에서 업로드용 미디어를 준비하지 못했습니다.");
  } finally {
    context.ffmpeg.off("progress", progressHandler);
    options.onProgress?.(null);
    await cleanupJobContext(context);
  }
}
