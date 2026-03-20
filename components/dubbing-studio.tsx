"use client";

import { upload } from "@vercel/blob/client";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import {
  analyzeMediaFileForUpload,
  prepareMediaFileForUpload,
  type MediaUploadAnalysis,
} from "@/lib/client-media";
import {
  buildUploadBlobPath,
  getBlobAccess,
  shouldUseMultipartUpload,
} from "@/lib/blob";
import { formatDurationLabel, formatFileSize } from "@/lib/display";
import type { VoiceOption } from "@/lib/elevenlabs";
import type { TargetLanguage } from "@/lib/languages";
import { CLIENT_UPLOAD_CLIP_DURATION_SECONDS } from "@/lib/media-policy";

type DubbingStudioProps = {
  initialError?: string;
  initialUsedCount: number;
  maxMediaDurationSeconds: number;
  maxUploadBytes: number;
  targetLanguages: TargetLanguage[];
  usageLimit: number;
  userEmail: string;
  voices: VoiceOption[];
};

type ResultState = {
  downloadUrl: string;
  fileName: string;
  kind: "audio" | "video";
  url: string;
} | null;

export function DubbingStudio({
  initialError,
  initialUsedCount,
  maxMediaDurationSeconds,
  maxUploadBytes,
  targetLanguages,
  usageLimit,
  userEmail,
  voices,
}: DubbingStudioProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileAnalysis, setSelectedFileAnalysis] = useState<MediaUploadAnalysis | null>(null);
  const [voiceId, setVoiceId] = useState(voices[0]?.id ?? "");
  const [targetLanguage, setTargetLanguage] = useState(targetLanguages[0]?.code ?? "en");
  const [error, setError] = useState(initialError ?? "");
  const [isInspectingFile, setIsInspectingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState<
    "idle" | "preparing" | "uploading" | "processing"
  >("idle");
  const [preparationProgress, setPreparationProgress] = useState<number | null>(null);
  const [preparedUploadSummary, setPreparedUploadSummary] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ResultState>(null);
  const [usedCount, setUsedCount] = useState(initialUsedCount);

  useEffect(() => {
    if (!voiceId && voices[0]) {
      setVoiceId(voices[0].id);
    }
  }, [voiceId, voices]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedFile) {
      setSelectedFileAnalysis(null);
      setIsInspectingFile(false);
      return () => undefined;
    }

    setIsInspectingFile(true);

    void analyzeMediaFileForUpload(selectedFile, maxUploadBytes)
      .then((analysis) => {
        if (!cancelled) {
          setSelectedFileAnalysis(analysis);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedFileAnalysis({
            durationSeconds: null,
            needsClientProcessing: false,
            processingMode: "none",
            uploadDurationSeconds: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInspectingFile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [maxUploadBytes, selectedFile]);

  const remainingCount = Math.max(usageLimit - usedCount, 0);
  const canSubmit =
    !isSubmitting &&
    Boolean(selectedFile) &&
    Boolean(voiceId) &&
    Boolean(targetLanguage) &&
    remainingCount > 0;

  const shouldPrepareOnClient =
    selectedFileAnalysis === null ? Boolean(selectedFile) : selectedFileAnalysis.needsClientProcessing;
  const uploadClipLabel = formatDurationLabel(CLIENT_UPLOAD_CLIP_DURATION_SECONDS);
  const maxUploadSizeLabel = formatFileSize(maxUploadBytes);
  const originalDurationLabel =
    selectedFileAnalysis?.durationSeconds !== null && selectedFileAnalysis?.durationSeconds !== undefined
      ? formatDurationLabel(Math.max(1, Math.ceil(selectedFileAnalysis.durationSeconds)))
      : null;
  const uploadDurationLabel =
    selectedFileAnalysis?.uploadDurationSeconds !== null &&
    selectedFileAnalysis?.uploadDurationSeconds !== undefined
      ? formatDurationLabel(Math.max(1, Math.ceil(selectedFileAnalysis.uploadDurationSeconds)))
      : null;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && nextFile.size <= 0) {
      setError("비어 있는 파일은 업로드할 수 없습니다.");
      setSelectedFile(null);
      setSelectedFileAnalysis(null);
      setResult(null);
      event.target.value = "";
      return;
    }

    setError("");
    setSelectedFileAnalysis(null);
    setPreparedUploadSummary("");
    setPreparationProgress(null);
    setSelectedFile(nextFile);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("더빙할 파일을 먼저 선택해 주세요.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    setResult(null);
    setPreparedUploadSummary("");
    setPreparationProgress(null);
    setUploadProgress(0);

    try {
      setSubmissionPhase(shouldPrepareOnClient ? "preparing" : "uploading");

      const preparedUpload = await prepareMediaFileForUpload(selectedFile, {
        durationSeconds: selectedFileAnalysis?.durationSeconds,
        maxUploadBytes,
        onProgress: setPreparationProgress,
      });

      setSelectedFileAnalysis({
        durationSeconds: preparedUpload.durationSeconds,
        needsClientProcessing: preparedUpload.needsClientProcessing,
        processingMode: preparedUpload.processingMode,
        uploadDurationSeconds: preparedUpload.uploadDurationSeconds,
      });
      setPreparedUploadSummary(
        preparedUpload.file === selectedFile
          ? `업로드 파일: 원본 그대로 / ${formatFileSize(preparedUpload.file.size)}`
          : `업로드 파일: ${preparedUpload.file.name} / ${formatFileSize(preparedUpload.file.size)}${preparedUpload.wasTranscoded ? " · 모바일 업로드용으로 압축" : ` · 첫 ${uploadClipLabel} 클립`}`,
      );

      setSubmissionPhase("uploading");

      const uploadedBlob = await upload(
        buildUploadBlobPath(userEmail, preparedUpload.file.name),
        preparedUpload.file,
        {
          access: getBlobAccess(),
          handleUploadUrl: "/api/uploads",
          multipart: shouldUseMultipartUpload(preparedUpload.file.size),
          onUploadProgress: (progressEvent) => {
            setUploadProgress(Math.round(progressEvent.percentage));
          },
        },
      );

      setUploadProgress(100);
      setSubmissionPhase("processing");

      const response = await fetch("/api/dub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaUrl: uploadedBlob.url,
          targetLanguage,
          voiceId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "더빙 결과를 만들지 못했습니다.");
      }

      const payload = (await response.json()) as {
        downloadUrl: string;
        fileName: string;
        kind: "audio" | "video";
        url: string;
      };

      setResult({
        downloadUrl: payload.downloadUrl,
        fileName: payload.fileName,
        kind: payload.kind,
        url: payload.url,
      });
      setUsedCount((currentCount) => currentCount + 1);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "더빙 결과를 만들지 못했습니다.",
      );
    } finally {
      setSubmissionPhase("idle");
      setPreparationProgress(null);
      setUploadProgress(0);
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
      <div className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.05)]">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-[1.25rem] border border-border bg-[#fffaf6] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">이용 상태</p>
            <p className="mt-2 text-lg font-semibold text-foreground">허용 목록 등록 완료</p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-[#fffaf6] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">자동 업로드 정책</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{uploadClipLabel} 클립</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              {uploadClipLabel}를 넘는 원본은 선택 없이 첫 {uploadClipLabel}만 업로드합니다.
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-[#f4fbf7] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#3c7d62]">오늘 사용</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {usedCount} / {usageLimit}회
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-[#eef6ff] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#2c6db2]">남은 횟수</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{remainingCount}회</p>
          </div>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <span className="text-sm font-semibold text-foreground">파일 업로드</span>
            <p className="text-sm leading-6 text-muted">
              오디오 또는 비디오 파일을 올리면 음성 추출부터 전사, 번역, 더빙 음성 생성까지 한 번에
              처리합니다.
            </p>

            <label className="flex cursor-pointer flex-col gap-3 rounded-[1.5rem] border border-dashed border-[#f1c8b5] bg-[#fff8f3] px-5 py-5 transition hover:border-accent hover:bg-[#fff4ec]">
              <span className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-[0_8px_20px_rgba(31,38,52,0.05)]">
                파일 선택하기
              </span>
              <span className="text-sm leading-6 text-muted">
                지원 형식: MP3, WAV, M4A, AAC, OGG, WEBM, MP4, MOV, MKV
              </span>
              <span className="text-sm leading-6 text-muted">
                {uploadClipLabel}를 넘는 파일은 브라우저에서 첫 {uploadClipLabel}만 잘라 업로드하고,
                이미 {uploadClipLabel} 이하인데도 큰 파일은 모바일 업로드용으로 다시 압축합니다.
              </span>
              <span className="text-sm leading-6 text-muted">
                서버에는 준비된 클립만 전송되며, 서버 파이프라인 자체는 최대{" "}
                {formatDurationLabel(maxMediaDurationSeconds)} 길이까지 처리할 수 있습니다.
              </span>
              <input
                accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov,.mkv"
                className="hidden"
                onChange={handleFileChange}
                type="file"
              />
            </label>

            <div className="grid gap-3 rounded-[1.25rem] border border-[#f1dbc9] bg-[#fffaf5] px-4 py-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-accent">적용 방식</p>
                <p className="mt-2 font-semibold text-foreground">선택 없이 자동 적용</p>
                <p className="mt-1 leading-5 text-muted">체크박스가 아니라 업로드 정책으로 고정되어 있습니다.</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-accent">길이 초과</p>
                <p className="mt-2 font-semibold text-foreground">첫 {uploadClipLabel} 클립</p>
                <p className="mt-1 leading-5 text-muted">
                  원본 길이가 {uploadClipLabel}를 넘으면 브라우저가 먼저 잘라서 올립니다.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-accent">용량 초과</p>
                <p className="mt-2 font-semibold text-foreground">모바일 업로드용 압축</p>
                <p className="mt-1 leading-5 text-muted">
                  {uploadClipLabel} 이하라도 {maxUploadSizeLabel}를 넘으면 다시 압축합니다.
                </p>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-[#fcfbf8] px-4 py-4 text-sm text-muted">
              {selectedFile ? (
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">
                    {selectedFile.name} / {formatFileSize(selectedFile.size)}
                  </p>
                  {isInspectingFile ? <p>원본 길이를 확인하는 중입니다.</p> : null}
                  {originalDurationLabel ? <p>원본 길이: {originalDurationLabel}</p> : null}
                  {selectedFileAnalysis?.processingMode === "clip" ? (
                    <p>업로드 전 브라우저에서 첫 {uploadDurationLabel ?? uploadClipLabel}만 잘라 처리합니다.</p>
                  ) : selectedFileAnalysis?.processingMode === "compress" ? (
                    <p>
                      {uploadClipLabel} 이하 파일이지만 용량이 커서 브라우저에서 업로드용 파일로 다시 압축합니다.
                    </p>
                  ) : (
                    <p>{uploadClipLabel} 이하 파일은 원본 그대로 업로드합니다.</p>
                  )}
                  {preparedUploadSummary ? (
                    <p className="font-medium text-foreground">{preparedUploadSummary}</p>
                  ) : null}
                  {!preparedUploadSummary && selectedFile.size > maxUploadBytes ? (
                    <p>
                      원본은 {maxUploadSizeLabel}를 넘지만, 브라우저가 업로드 가능한 크기로 먼저 준비합니다.
                    </p>
                  ) : null}
                </div>
              ) : (
                "아직 선택한 파일이 없습니다."
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">타깃 언어</span>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="w-full rounded-[1.25rem] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-[#ff7f5c]/10"
              >
                {targetLanguages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">더빙 목소리</span>
              <select
                value={voiceId}
                onChange={(event) => setVoiceId(event.target.value)}
                className="w-full rounded-[1.25rem] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-[#ff7f5c]/10"
                disabled={voices.length === 0}
              >
                {voices.length === 0 ? (
                  <option value="">현재 선택 가능한 목소리가 없습니다.</option>
                ) : (
                  voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#fffaf5_0%,#f8fcfa_100%)] px-5 py-5">
            <p className="text-sm font-semibold text-foreground">처리 흐름</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              브라우저가 먼저 업로드용 클립이나 모바일용 압축본을 자동으로 준비한 뒤 파일을 전송하고,
              서버는 음성 추출, 전사, 번역, 더빙 음성 생성 순서로 결과를 만듭니다.
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,127,92,0.24)] transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-[#f4f4f1] disabled:text-muted disabled:shadow-none"
            disabled={!canSubmit}
          >
            {submissionPhase === "preparing"
              ? preparationProgress !== null
                ? `브라우저에서 업로드 파일 준비 중... ${Math.round(preparationProgress * 100)}%`
                : "브라우저에서 업로드 파일 준비 중..."
              : submissionPhase === "uploading"
              ? `파일 업로드 중... ${uploadProgress}%`
              : submissionPhase === "processing"
                ? "전사 · 번역 · 더빙 생성 중..."
                : remainingCount === 0
                  ? "오늘 사용 가능 횟수 소진"
                  : "더빙 결과 만들기"}
          </button>
        </form>
      </div>

      <aside className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.05)]">
        <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#fff4ec_0%,#ffffff_100%)] p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">결과 미리보기</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            생성이 끝나면 여기에서 바로 확인할 수 있어요
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            오디오는 플레이어로 듣고, 비디오는 화면에서 미리 본 뒤 결과 파일을 바로 내려받을 수
            있습니다.
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-[1.25rem] border border-[#f0b5a2] bg-[#fff2ed] px-4 py-4 text-sm leading-6 text-[#9d3b1e]">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 space-y-4 rounded-[1.5rem] border border-border bg-[#fffdfa] px-5 py-5">
            {result.kind === "video" ? (
              <video className="aspect-video w-full rounded-[1rem] bg-black/90" controls src={result.url} />
            ) : (
              <audio className="w-full" controls src={result.url}>
                사용 중인 브라우저에서 오디오 재생을 지원하지 않습니다.
              </audio>
            )}

            <div className="rounded-[1.1rem] bg-[#f8f7f3] px-4 py-3 text-sm text-muted">
              {result.fileName}
            </div>

            <a
              href={result.downloadUrl}
              download={result.fileName}
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,127,92,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-strong"
            >
              결과 다운로드
            </a>
          </div>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-border bg-[#fffdfa] px-5 py-8 text-sm leading-6 text-muted">
            아직 생성된 결과가 없습니다. 왼쪽에서 파일과 언어, 목소리를 고른 뒤 더빙을 시작해 보세요.
          </div>
        )}
      </aside>
    </section>
  );
}
