export interface LogoEntry {
  file_path: string
  iso_639_1: string | null
  vote_average: number
  file_type?: string
}

export function pickBestLogo(logos: LogoEntry[], preferredLang?: string): string | null {
  if (!logos.length) return null

  const sorted = (items: LogoEntry[]) =>
    [...items].sort((a, b) => b.vote_average - a.vote_average)

  const isPng = (l: LogoEntry) =>
    l.file_path.endsWith(".png") || l.file_type === ".png"

  // Normalize "ru-RU" → "ru", "en-US" → "en", etc.
  const isoLang = preferredLang?.split("-")[0]

  // 1. Requested language PNG
  if (isoLang && isoLang !== "en") {
    const langPng = sorted(logos.filter(l => l.iso_639_1 === isoLang && isPng(l)))
    if (langPng.length) return langPng[0].file_path

    // 1b. Requested language any format
    const langAny = sorted(logos.filter(l => l.iso_639_1 === isoLang))
    if (langAny.length) return langAny[0].file_path
  }

  // 2. English PNG
  const enPng = sorted(logos.filter(l => l.iso_639_1 === "en" && isPng(l)))
  if (enPng.length) return enPng[0].file_path

  // 3. English any format
  const en = sorted(logos.filter(l => l.iso_639_1 === "en"))
  if (en.length) return en[0].file_path

  // 4. Any logo
  return sorted(logos)[0]?.file_path ?? null
}
