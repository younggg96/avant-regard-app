import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zh from "./locales/zh.json";
import en from "./locales/en.json";

export type SupportedLanguage = "zh" | "en";

const LANGUAGE_STORAGE_KEY = "app_language";

function resolveLanguage(detected: string | undefined): SupportedLanguage {
  if (!detected) return "en";
  if (detected.startsWith("zh")) return "zh";
  if (detected.startsWith("en")) return "en";
  return "en";
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

const rawLng = i18n.language;
const resolved = resolveLanguage(rawLng);
if (rawLng !== resolved) {
  i18n.changeLanguage(resolved);
}

export function setLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  document.cookie = `${LANGUAGE_STORAGE_KEY}=${lang};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

export function getCurrentLanguage(): SupportedLanguage {
  const lng = i18n.language;
  if (lng?.startsWith("zh")) return "zh";
  return "en";
}

export default i18n;
