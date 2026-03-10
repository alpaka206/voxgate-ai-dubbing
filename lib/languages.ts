export type TargetLanguage = {
  code: string;
  label: string;
  openAiLabel: string;
};

export const targetLanguages: TargetLanguage[] = [
  { code: "ko", label: "한국어", openAiLabel: "Korean" },
  { code: "en", label: "English", openAiLabel: "English" },
  { code: "ja", label: "日本語", openAiLabel: "Japanese" },
  { code: "zh", label: "简体中文", openAiLabel: "Simplified Chinese" },
  { code: "es", label: "Español", openAiLabel: "Spanish" },
  { code: "fr", label: "Français", openAiLabel: "French" },
  { code: "de", label: "Deutsch", openAiLabel: "German" },
];

export function getTargetLanguageByCode(code: string) {
  return targetLanguages.find((language) => language.code === code);
}
