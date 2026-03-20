import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DubbingStudio } from "@/components/dubbing-studio";
import { getAccessState } from "@/lib/auth";
import { getVoiceListErrorMessage, listVoices, type VoiceOption } from "@/lib/elevenlabs";
import { targetLanguages } from "@/lib/languages";
import { getMaxUploadBytes } from "@/lib/media";
import { getDailyUsageSummary } from "@/lib/usage";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    redirect("/?notice=login-required");
  }

  if (!access.canUseStudio) {
    redirect("/dashboard?notice=approval-required");
  }

  let initialError: string | undefined;
  let voices: VoiceOption[] = [];

  try {
    voices = await listVoices();
  } catch (error) {
    console.error("목소리 목록을 불러오지 못했습니다.", error);
    initialError = getVoiceListErrorMessage();
  }

  const usageSummary = await getDailyUsageSummary(access.email);

  return (
    <AppShell
      access={access}
      currentPath="/studio"
      description="오디오나 비디오 파일을 올리면 브라우저가 업로드용 클립이나 모바일용 압축본을 먼저 준비하고, 서버에서 음성 추출, 전사, 번역, 타깃 언어 더빙까지 한 번에 처리합니다."
      title="스튜디오"
    >
      <DubbingStudio
        initialError={initialError}
        initialUsedCount={usageSummary.used}
        maxMediaDurationSeconds={access.maxMediaDurationSeconds}
        maxUploadBytes={getMaxUploadBytes()}
        targetLanguages={targetLanguages}
        userEmail={access.email}
        usageLimit={usageSummary.limit}
        voices={voices}
      />
    </AppShell>
  );
}
