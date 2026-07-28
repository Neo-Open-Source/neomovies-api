export const SUPPORTED_LANGUAGES = ["en-US", "uk-UA", "ru-RU", "ro-RO", "be-BY"] as const

export type Language = typeof SUPPORTED_LANGUAGES[number]

export const DEFAULT_LANGUAGE: Language = "ru-RU"

export function language(query: Record<string, string | undefined>): Language {
  const lang = query?.language
  if (lang && SUPPORTED_LANGUAGES.includes(lang as Language)) return lang as Language
  return DEFAULT_LANGUAGE
}
