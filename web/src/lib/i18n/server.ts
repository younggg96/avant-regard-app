import { cookies } from "next/headers";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

export type SupportedLanguage = "zh" | "en";

const LANGUAGE_COOKIE_KEY = "app_language";

const resources: Record<SupportedLanguage, Record<string, any>> = { zh, en };

export function getServerLanguage(): SupportedLanguage {
  try {
    const cookieStore = cookies();
    const lang = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value;
    if (lang === "zh" || lang === "en") return lang;
  } catch {
    // cookies() throws outside of request context (e.g. build time)
  }
  return "zh";
}

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export function getServerT(lang?: SupportedLanguage) {
  const language = lang ?? getServerLanguage();
  const resource = resources[language];
  const fallback = resources["en"];

  return function t(key: string, params?: Record<string, string | number>): string {
    let value = getNestedValue(resource, key) ?? getNestedValue(fallback, key) ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
      });
    }
    return value;
  };
}
