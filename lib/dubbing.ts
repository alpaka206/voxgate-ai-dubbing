import type { TranscriptionResult, TranscriptionWord } from "@/lib/elevenlabs";

export type TranscriptSegment = {
  endSeconds: number;
  index: number;
  speakerId: string | null;
  startSeconds: number;
  text: string;
};

const HARD_PAUSE_THRESHOLD_SECONDS = 0.7;
const SOFT_PAUSE_THRESHOLD_SECONDS = 0.4;
const LONG_SEGMENT_CHARACTER_LIMIT = 180;
const LONG_SEGMENT_WORD_LIMIT = 24;
const MIN_SEGMENT_DURATION_SECONDS = 0.35;

function isWordToken(word: TranscriptionWord) {
  return word.type === "word";
}

function isSpacingToken(word: TranscriptionWord) {
  return word.type === "spacing";
}

function isSentenceEnding(text: string) {
  return /[.!?\u3002\u2026\uFF01\uFF1F]$/.test(text);
}

function isSoftBoundary(text: string) {
  return /[,;:\u060C\uFF0C\uFF1B\uFF1A]$/.test(text);
}

function normalizeSegmentText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function createTranscriptSegments(
  transcription: TranscriptionResult,
  totalDurationSeconds: number,
) {
  const tokens = transcription.words.filter((word) => isWordToken(word) || isSpacingToken(word));

  if (tokens.length === 0 || !tokens.some(isWordToken)) {
    const fallbackText = normalizeSegmentText(transcription.text);

    if (!fallbackText) {
      return [] as TranscriptSegment[];
    }

    return [
      {
        endSeconds: Math.max(totalDurationSeconds, MIN_SEGMENT_DURATION_SECONDS),
        index: 0,
        speakerId: null,
        startSeconds: 0,
        text: fallbackText,
      },
    ] satisfies TranscriptSegment[];
  }

  const segments: TranscriptSegment[] = [];
  let currentTokens: TranscriptionWord[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let currentSpeakerId: string | null = null;
  let wordCount = 0;

  function flushSegment() {
    if (currentTokens.length === 0 || wordCount === 0) {
      currentTokens = [];
      currentStart = 0;
      currentEnd = 0;
      currentSpeakerId = null;
      wordCount = 0;
      return;
    }

    const text = normalizeSegmentText(currentTokens.map((token) => token.text).join(""));

    if (text) {
      segments.push({
        endSeconds: Math.max(currentEnd, currentStart + MIN_SEGMENT_DURATION_SECONDS),
        index: segments.length,
        speakerId: currentSpeakerId,
        startSeconds: currentStart,
        text,
      });
    }

    currentTokens = [];
    currentStart = 0;
    currentEnd = 0;
    currentSpeakerId = null;
    wordCount = 0;
  }

  function findNextWord(startIndex: number) {
    for (let index = startIndex; index < tokens.length; index += 1) {
      if (isWordToken(tokens[index])) {
        return tokens[index];
      }
    }

    return null;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!currentTokens.length) {
      if (!isWordToken(token)) {
        continue;
      }

      currentStart = token.start;
      currentSpeakerId = token.speakerId;
    }

    currentTokens.push(token);

    if (!isWordToken(token)) {
      continue;
    }

    currentEnd = token.end;
    wordCount += 1;

    const nextWord = findNextWord(index + 1);
    const gapSeconds = nextWord ? nextWord.start - token.end : 0;
    const currentText = currentTokens.map((item) => item.text).join("");
    const hasSpeakerChange = Boolean(nextWord && nextWord.speakerId !== token.speakerId);
    const hitHardPause = gapSeconds >= HARD_PAUSE_THRESHOLD_SECONDS;
    const hitSentenceBoundary = isSentenceEnding(token.text);
    const hitSoftPauseBoundary =
      isSoftBoundary(token.text) && gapSeconds >= SOFT_PAUSE_THRESHOLD_SECONDS;
    const hitLongSegmentBoundary =
      (currentText.length >= LONG_SEGMENT_CHARACTER_LIMIT ||
        wordCount >= LONG_SEGMENT_WORD_LIMIT) &&
      gapSeconds >= 0.2;

    if (
      !nextWord ||
      hasSpeakerChange ||
      hitHardPause ||
      hitSentenceBoundary ||
      hitSoftPauseBoundary ||
      hitLongSegmentBoundary
    ) {
      flushSegment();
    }
  }

  return segments.map((segment, index) => ({
    ...segment,
    endSeconds:
      index === segments.length - 1
        ? Math.min(
            Math.max(segment.endSeconds, segment.startSeconds + MIN_SEGMENT_DURATION_SECONDS),
            Math.max(totalDurationSeconds, segment.startSeconds + MIN_SEGMENT_DURATION_SECONDS),
          )
        : segment.endSeconds,
    index,
  }));
}
