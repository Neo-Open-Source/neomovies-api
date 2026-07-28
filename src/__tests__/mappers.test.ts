import { describe, expect, it } from "bun:test"
import { mapMovie, mapTV, paginate } from "../lib/mappers"

const mockMovie = {
  id: 245891,
  title: "John Wick",
  original_title: "John Wick",
  overview: "An ex-hit-man comes out of retirement.",
  poster_path: "/path.jpg",
  backdrop_path: "/backdrop.jpg",
  release_date: "2014-10-22",
  vote_average: 7.4,
  vote_count: 21800,
  popularity: 100,
  genre_ids: [28, 53],
  adult: false,
}

describe("mapMovie", () => {
  it("maps basic fields", () => {
    const result = mapMovie(mockMovie as any)
    expect(result.tmdbId).toBe(245891)
    expect(result.title).toBe("John Wick")
    expect(result.overview).toBe("An ex-hit-man comes out of retirement.")
    expect(result.genreIds).toEqual([28, 53])
  })

  it("includes poster and backdrop URLs", () => {
    const result = mapMovie(mockMovie as any)
    expect(result.poster).toContain("/w500/path.jpg")
    expect(result.backdrop).toContain("/w1280/backdrop.jpg")
    expect(result.posters).toBeDefined()
    expect(result.backdrops).toBeDefined()
  })

  it("handles missing poster path", () => {
    const noPoster = { ...mockMovie, poster_path: null }
    const result = mapMovie(noPoster as any)
    expect(result.poster).toBeNull()
    expect(result.posters.w185).toBeNull()
  })
})

describe("mapTV", () => {
  const mockTV = {
    id: 1396,
    name: "Breaking Bad",
    original_name: "Breaking Bad",
    overview: "A high school teacher turns to a life of crime.",
    poster_path: "/tv.jpg",
    backdrop_path: "/tv-backdrop.jpg",
    first_air_date: "2008-01-20",
    vote_average: 8.9,
    vote_count: 12345,
    popularity: 200,
    genre_ids: [18, 80],
  }

  it("maps TV fields correctly", () => {
    const result = mapTV(mockTV as any)
    expect(result.tmdbId).toBe(1396)
    expect(result.title).toBe("Breaking Bad")
    expect(result.releaseDate).toBe("2008-01-20")
  })
})

describe("paginate", () => {
  it("wraps items in pagination envelope", () => {
    const items = [1, 2, 3]
    const result = paginate(items, 1, 10, 100)
    expect(result.items).toEqual(items)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(10)
    expect(result.totalResults).toBe(100)
  })
})
