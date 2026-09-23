import { describe, expect, it } from "bun:test"
import { pickBestLogo } from "../lib/logo"

describe("pickBestLogo", () => {
  it("returns null for empty array", () => {
    expect(pickBestLogo([])).toBeNull()
  })

  it("prefers English PNG logos", () => {
    const logos = [
      { file_path: "/en-svg.svg", iso_639_1: "en",   vote_average: 8.0 },
      { file_path: "/en-png.png", iso_639_1: "en",   vote_average: 7.0 },
      { file_path: "/ru-png.png", iso_639_1: "ru",   vote_average: 9.0 },
    ]
    expect(pickBestLogo(logos)).toBe("/en-png.png")
  })

  it("picks the English PNG with highest vote_average", () => {
    const logos = [
      { file_path: "/a.png", iso_639_1: "en", vote_average: 5.0 },
      { file_path: "/b.png", iso_639_1: "en", vote_average: 9.0 },
      { file_path: "/c.png", iso_639_1: "en", vote_average: 7.0 },
    ]
    expect(pickBestLogo(logos)).toBe("/b.png")
  })

  it("falls back to English non-PNG when no English PNG", () => {
    const logos = [
      { file_path: "/en.svg",  iso_639_1: "en", vote_average: 7.0 },
      { file_path: "/ru.png",  iso_639_1: "ru", vote_average: 9.0 },
    ]
    expect(pickBestLogo(logos)).toBe("/en.svg")
  })

  it("falls back to any logo when no English logo exists", () => {
    const logos = [
      { file_path: "/ru.png", iso_639_1: "ru", vote_average: 6.0 },
      { file_path: "/de.png", iso_639_1: "de", vote_average: 8.0 },
    ]
    // Should pick highest vote_average among all
    expect(pickBestLogo(logos)).toBe("/de.png")
  })

  it("treats file_type .png the same as .png extension", () => {
    const logos = [
      { file_path: "/logo",      iso_639_1: "en", vote_average: 8.0, file_type: ".png" },
      { file_path: "/other.png", iso_639_1: "ru", vote_average: 9.0 },
    ]
    expect(pickBestLogo(logos)).toBe("/logo")
  })

  it("handles null iso_639_1", () => {
    const logos = [
      { file_path: "/unknown.png", iso_639_1: null, vote_average: 10.0 },
    ]
    // null iso is not English — falls through to "any" fallback
    expect(pickBestLogo(logos)).toBe("/unknown.png")
  })

  it("returns single logo regardless of language", () => {
    const logos = [{ file_path: "/only.svg", iso_639_1: "fr", vote_average: 5.0 }]
    expect(pickBestLogo(logos)).toBe("/only.svg")
  })

  it("does not mutate the input array", () => {
    const logos = [
      { file_path: "/a.png", iso_639_1: "en", vote_average: 5.0 },
      { file_path: "/b.png", iso_639_1: "en", vote_average: 9.0 },
    ]
    const copy = [...logos]
    pickBestLogo(logos)
    expect(logos).toEqual(copy)
  })
})
