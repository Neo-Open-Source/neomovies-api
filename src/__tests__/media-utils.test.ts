import { describe, expect, it } from "bun:test"
import { extractTrailers, formatCredits } from "../services/media/utils"

// ---------------------------------------------------------------------------
// extractTrailers
// ---------------------------------------------------------------------------

describe("extractTrailers", () => {
  const makeVideo = (key: string, site: string, type: string, official = true) =>
    ({ key, site, type, name: `${type} ${key}`, official })

  it("returns YouTube trailer keys", () => {
    const videos = {
      results: [
        makeVideo("abc123", "YouTube", "Trailer"),
        makeVideo("def456", "YouTube", "Trailer"),
      ],
    }
    expect(extractTrailers(videos)).toEqual(["abc123", "def456"])
  })

  it("excludes non-YouTube sources", () => {
    const videos = {
      results: [
        makeVideo("vimeo1", "Vimeo", "Trailer"),
        makeVideo("yt1", "YouTube", "Trailer"),
      ],
    }
    expect(extractTrailers(videos)).toEqual(["yt1"])
  })

  it("excludes non-Trailer types (Teaser, Clip, Featurette)", () => {
    const videos = {
      results: [
        makeVideo("t1", "YouTube", "Teaser"),
        makeVideo("t2", "YouTube", "Clip"),
        makeVideo("t3", "YouTube", "Trailer"),
        makeVideo("t4", "YouTube", "Featurette"),
      ],
    }
    expect(extractTrailers(videos)).toEqual(["t3"])
  })

  it("returns empty array for empty results", () => {
    expect(extractTrailers({ results: [] })).toEqual([])
  })

  it("returns empty array when nothing matches", () => {
    expect(extractTrailers({ results: [makeVideo("x", "Vimeo", "Teaser")] })).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// formatCredits
// ---------------------------------------------------------------------------

describe("formatCredits", () => {
  const castMember = {
    id: 1,
    name: "Actor One",
    character: "Hero",
    profile_path: "/actor.jpg",
    order: 0,
  }
  const crewMember = {
    id: 2,
    name: "Director One",
    job: "Director",
    department: "Directing",
    profile_path: "/director.jpg",
  }

  it("maps cast members", () => {
    const result = formatCredits({ cast: [castMember], crew: [] })
    expect(result.cast).toHaveLength(1)
    const m = result.cast[0]
    expect(m.id).toBe(1)
    expect(m.name).toBe("Actor One")
    expect(m.character).toBe("Hero")
    expect(m.order).toBe(0)
    expect(m.profile).toContain("/actor.jpg")
  })

  it("maps crew members", () => {
    const result = formatCredits({ cast: [], crew: [crewMember] })
    expect(result.crew).toHaveLength(1)
    const m = result.crew[0]
    expect(m.id).toBe(2)
    expect(m.job).toBe("Director")
    expect(m.department).toBe("Directing")
    expect(m.profile).toContain("/director.jpg")
  })

  it("handles null profile paths", () => {
    const result = formatCredits({
      cast: [{ ...castMember, profile_path: null }],
      crew: [{ ...crewMember, profile_path: null }],
    })
    expect(result.cast[0].profile).toBeNull()
    expect(result.crew[0].profile).toBeNull()
  })

  it("handles empty credits", () => {
    const result = formatCredits({ cast: [], crew: [] })
    expect(result.cast).toEqual([])
    expect(result.crew).toEqual([])
  })

  it("handles missing cast/crew gracefully (undefined)", () => {
    const result = formatCredits({ cast: undefined as any, crew: undefined as any })
    expect(result.cast).toEqual([])
    expect(result.crew).toEqual([])
  })
})
