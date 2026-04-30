import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import zh from "./locales/zh.json";
import en from "./locales/en.json";

const LANGUAGE_STORAGE_KEY = "app_language";

export type SupportedLanguage = "zh" | "en";

function getDeviceLanguage(): SupportedLanguage {
  const locale = Localization.getLocales()?.[0]?.languageCode ?? "";
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("en")) return "en";
  return "en";
}

export async function getStoredLanguage(): Promise<SupportedLanguage | null> {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (lang === "zh" || lang === "en") return lang;
    return null;
  } catch {
    return null;
  }
}

export async function setStoredLanguage(lang: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export async function initI18n(): Promise<void> {
  const storedLang = await getStoredLanguage();
  const language = storedLang ?? getDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
