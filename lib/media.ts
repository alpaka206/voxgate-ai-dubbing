import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import ffmpegPath from "ffmpeg-static";

import { MAX_UPLOAD_BYTES } from "@/lib/media-policy";

export type MediaKind = "audio" | "video";

export type StoredUpload = {
  fileName: string;
  inputPath: string;
  kind: MediaKind;
  mimeType: string;
  workspaceDir: string;
};

export type TimedAudioSegment = {
  path: string;
  startSeconds: number;
};

const audioExtensions = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"]);
const videoExtensions = new Set([".mp4", ".mov", ".webm", ".mkv"]);
const MIN_AUDIO_DURATION_SECONDS = 0.2;

function normalizeBundledPath(binaryPath: string) {
  const normalized = binaryPath.replaceAll("/", path.sep);

  if (normalized.startsWith(`${path.sep}ROOT${path.sep}`)) {
    return path.join(process.cwd(), normalized.slice(`${path.sep}ROOT${path.sep}`.length));
  }

  if (normalized.startsWith(`ROOT${path.sep}`)) {
    return path.join(process.cwd(), normalized.slice(`ROOT${path.sep}`.length));
  }

  return normalized;
}

function getFfmpegBinary() {
  if (!ffmpegPath) {
    throw new Error("ffmpeg 실행 파일을 찾지 못했습니다.");
  }

  const candidates = [
    ffmpegPath,
    normalizeBundledPath(ffmpegPath),
    path.join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
    ),
  ];

  const binary = candidates.find((candidate) => existsSync(candidate));

  if (!binary) {
    throw new Error(`ffmpeg 실행 파일 경로를 찾지 못했습니다. ${candidates.join(" | ")}`);
  }

  return binary;
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim() || "upload";
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function detectMediaKind(fileName: string, mimeType: string) {
  if (mimeType.startsWith("audio/")) {
    return "audio" as const;
  }

  if (mimeType.startsWith("video/")) {
    return "video" as const;
  }

  const extension = path.extname(fileName).toLowerCase();

  if (audioExtensions.has(extension)) {
    return "audio" as const;
  }

  if (videoExtensions.has(extension)) {
    return "video" as const;
  }

  return null;
}

function validateUpload(fileName: string, mimeType: string, size: number) {
  if (size <= 0) {
    throw new Error("업로드할 파일을 다시 선택해 주세요.");
  }

  if (size > MAX_UPLOAD_BYTES) {
    throw new Error("현재는 50MB 이하 파일만 업로드할 수 있습니다.");
  }

  const safeFileName = sanitizeFileName(fileName);
  const safeMimeType = mimeType || "application/octet-stream";
  const kind = detectMediaKind(safeFileName, safeMimeType);

  if (!kind) {
    throw new Error("오디오 또는 비디오 파일만 업로드할 수 있습니다.");
  }

  return {
    fileName: safeFileName,
    kind,
    mimeType: safeMimeType,
  };
}

async function persistUploadBuffer({
  buffer,
  fileName,
  mimeType,
  size,
}: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
}) {
  const validated = validateUpload(fileName, mimeType, size);
  const workspaceDir = await createPipelineWorkspace();
  const inputPath = path.join(workspaceDir, validated.fileName);

  await writeFile(inputPath, buffer);

  return {
    fileName: validated.fileName,
    inputPath,
    kind: validated.kind,
    mimeType: validated.mimeType,
    workspaceDir,
  } satisfies StoredUpload;
}

async function runFfmpeg(args: string[], allowNonZeroExit = false) {
  const binary = getFfmpegBinary();

  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (code === 0 || allowNonZeroExit) {
        resolve({ stderr, stdout });
        return;
      }

      reject(new Error(stderr || "ffmpeg 실행에 실패했습니다."));
    });
  });
}

function parseDuration(stderr: string) {
  const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  return hours * 3600 + minutes * 60 + seconds;
}

function buildAtempoFilter(speedRatio: number) {
  const filters: string[] = [];
  let remaining = speedRatio;

  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }

  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }

  filters.push(`atempo=${remaining.toFixed(4)}`);
  return filters.join(",");
}

export function getMaxUploadBytes() {
  return MAX_UPLOAD_BYTES;
}

export async function createPipelineWorkspace() {
  return mkdtemp(path.join(tmpdir(), "readvox-"));
}

export async function storeUploadedFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return persistUploadBuffer({
    buffer,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
}

export async function storeUploadedBuffer({
  buffer,
  fileName,
  mimeType,
}: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  return persistUploadBuffer({
    buffer,
    fileName,
    mimeType,
    size: buffer.byteLength,
  });
}

export async function getMediaDurationSeconds(inputPath: string) {
  const { stderr } = await runFfmpeg(["-i", inputPath, "-f", "null", "-"], true);
  return parseDuration(stderr);
}

export async function extractAudioTrack(inputPath: string, workspaceDir: string) {
  const outputPath = path.join(workspaceDir, "source-audio.mp3");

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    outputPath,
  ]);

  return outputPath;
}

export async function writeBufferToFile(
  workspaceDir: string,
  fileName: string,
  buffer: Buffer,
) {
  const outputPath = path.join(workspaceDir, fileName);
  await writeFile(outputPath, buffer);
  return outputPath;
}

export async function fitAudioToDuration(options: {
  fileName: string;
  inputPath: string;
  targetDurationSeconds: number;
  workspaceDir: string;
}) {
  const sourceDurationSeconds = await getMediaDurationSeconds(options.inputPath);

  if (!sourceDurationSeconds) {
    return options.inputPath;
  }

  const targetDurationSeconds = Math.max(
    options.targetDurationSeconds,
    MIN_AUDIO_DURATION_SECONDS,
  );
  const speedRatio = sourceDurationSeconds / targetDurationSeconds;

  if (Math.abs(1 - speedRatio) <= 0.03) {
    return options.inputPath;
  }

  const outputPath = path.join(options.workspaceDir, options.fileName);
  const filter = `${buildAtempoFilter(speedRatio)},atrim=0:${targetDurationSeconds.toFixed(3)}`;

  await runFfmpeg([
    "-y",
    "-i",
    options.inputPath,
    "-filter:a",
    filter,
    "-ar",
    "44100",
    "-ac",
    "2",
    "-c:a",
    "libmp3lame",
    outputPath,
  ]);

  return outputPath;
}

export async function createSilentAudioTrack(options: {
  durationSeconds: number;
  fileName: string;
  workspaceDir: string;
}) {
  const outputPath = path.join(options.workspaceDir, options.fileName);

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=stereo",
    "-t",
    Math.max(options.durationSeconds, MIN_AUDIO_DURATION_SECONDS).toFixed(3),
    "-c:a",
    "libmp3lame",
    outputPath,
  ]);

  return outputPath;
}

export async function buildTimedDubbedAudio(options: {
  durationSeconds: number;
  segments: TimedAudioSegment[];
  workspaceDir: string;
}) {
  const outputPath = path.join(options.workspaceDir, "dubbed-audio-timed.mp3");
  const baseTrackPath = await createSilentAudioTrack({
    durationSeconds: options.durationSeconds,
    fileName: "dubbed-audio-base.mp3",
    workspaceDir: options.workspaceDir,
  });

  if (options.segments.length === 0) {
    return baseTrackPath;
  }

  const args = ["-y", "-i", baseTrackPath];

  for (const segment of options.segments) {
    args.push("-i", segment.path);
  }

  const delayedLabels: string[] = [];
  const filterParts: string[] = [];

  options.segments.forEach((segment, index) => {
    const inputIndex = index + 1;
    const delayMilliseconds = Math.max(Math.round(segment.startSeconds * 1000), 0);
    const delayedLabel = `delayed${inputIndex}`;

    delayedLabels.push(`[${delayedLabel}]`);
    filterParts.push(
      `[${inputIndex}:a]adelay=${delayMilliseconds}:all=1[${delayedLabel}]`,
    );
  });

  filterParts.push(
    `[0:a]${delayedLabels.join("")}amix=inputs=${options.segments.length + 1}:duration=first:dropout_transition=0,atrim=0:${Math.max(options.durationSeconds, MIN_AUDIO_DURATION_SECONDS).toFixed(3)}[outa]`,
  );

  await runFfmpeg([
    ...args,
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[outa]",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-c:a",
    "libmp3lame",
    outputPath,
  ]);

  return outputPath;
}

export async function buildDubbedVideo(options: {
  durationSeconds: number;
  dubbedAudioPath: string;
  inputVideoPath: string;
  workspaceDir: string;
}) {
  const outputPath = path.join(options.workspaceDir, "dubbed-video.mp4");

  await runFfmpeg([
    "-y",
    "-i",
    options.inputVideoPath,
    "-i",
    options.dubbedAudioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-t",
    Math.max(options.durationSeconds, MIN_AUDIO_DURATION_SECONDS).toFixed(3),
    outputPath,
  ]);

  return outputPath;
}

export async function readFileBuffer(filePath: string) {
  return readFile(filePath);
}

export async function cleanupWorkspace(workspaceDir: string) {
  if (!workspaceDir) {
    return;
  }

  await rm(workspaceDir, {
    force: true,
    recursive: true,
  }).catch(() => undefined);
}
