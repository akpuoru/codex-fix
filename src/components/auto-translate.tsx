import { useEffect, useState } from "react";

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ar", label: "العربية" },
  { code: "zh-CN", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "hi", label: "हिन्दी" },
  { code: "ru", label: "Русский" },
  { code: "tr", label: "Türkçe" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "ha", label: "Hausa" },
  { code: "sw", label: "Kiswahili" },
];

function readLang(): string {
  const m = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  return m?.[1] ?? "en";
}

function writeLang(code: string) {
  const host = location.hostname;
  const value = code === "en" ? "" : `/en/${code}`;
  const exp = code === "en" ? "; expires=Thu, 01 Jan 1970 00:00:00 GMT" : "";
  for (const d of ["", `; domain=${host}`, `; domain=.${host}`]) {
    document.cookie = `googtrans=${value}; path=/${d}${exp}`;
  }
}

/** Picks the visitor's language from their browser/region on first visit and translates the site. */
export function AutoTranslate() {
  useEffect(() => {
    if (!localStorage.getItem("bw-lang-chosen")) {
      const nav = (navigator.languages?.[0] ?? navigator.language ?? "en").toLowerCase();
      const match =
        LANGUAGES.find((l) => l.code.toLowerCase() === nav) ??
        LANGUAGES.find((l) => l.code.toLowerCase().split("-")[0] === nav.split("-")[0]);
      localStorage.setItem("bw-lang-chosen", "auto");
      if (match && match.code !== "en" && readLang() === "en") writeLang(match.code);
    }
    if (readLang() === "en") return;
    const w = window as unknown as { googleTranslateElementInit?: () => void; google?: any };
    w.googleTranslateElementInit = () => {
      new w.google.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "google_translate_element");
    };
    const s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);
  return <div id="google_translate_element" className="hidden" />;
}

export function LanguagePicker({ className = "" }: { className?: string }) {
  const [lang, setLang] = useState("en");
  useEffect(() => setLang(readLang()), []);
  return (
    <select
      aria-label="Language"
      value={lang}
      onChange={(e) => {
        localStorage.setItem("bw-lang-chosen", "manual");
        writeLang(e.target.value);
        location.reload();
      }}
      className={`notranslate rounded-md bg-card px-2 py-1.5 text-xs font-semibold ring-1 ring-line ${className}`}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
