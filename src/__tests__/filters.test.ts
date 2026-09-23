import { describe, expect, it } from "bun:test"
import {
  validMovie,
  validTV,
  validMovieSearch,
  validTVSearch,
  validMovieCredit,
  validTVCredit,
  filterMovies,
  filterTV,
  MIN_VOTE_COUNT,
} from "../services/tmdb/filters"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAST = "2020-01-01"
const FUTURE = "2099-01-01"

const baseMovie = {
  poster_path: "/poster.jpg",
  vote_average: 7.5,
  vote_count: MIN_VOTE_COUNT + 100,
  popularity: 50,
  release_date: PAST,
  overview: "A great movie with a compelling story.",
  title: "Great Movie",
  original_title: "Great Movie",
  genre_ids: [28],
  adult: false,
}

const baseTV = {
  poster_path: "/poster.jpg",
  vote_average: 7.5,
  vote_count: MIN_VOTE_COUNT + 100,
  popularity: 50,
  first_air_date: PAST,
  overview: "A great TV show with a compelling story.",
  name: "Great Show",
  original_name: "Great Show",
  genre_ids: [18],
}

// ---------------------------------------------------------------------------
// validMovie
// ---------------------------------------------------------------------------

describe("validMovie", () => {
  it("accepts a well-formed movie", () => {
    expect(validMovie(baseMovie)).toBeTrue()
  })

  it("rejects adult content (adult flag)", () => {
    expect(validMovie({ ...baseMovie, adult: true })).toBeFalse()
  })

  it("rejects missing poster", () => {
    expect(validMovie({ ...baseMovie, poster_path: null })).toBeFalse()
  })

  it("rejects zero vote_average", () => {
    expect(validMovie({ ...baseMovie, vote_average: 0 })).toBeFalse()
  })

  it("rejects future release date", () => {
    expect(validMovie({ ...baseMovie, release_date: FUTURE })).toBeFalse()
  })

  it("rejects missing release date", () => {
    expect(validMovie({ ...baseMovie, release_date: undefined })).toBeFalse()
  })

  it("rejects empty overview", () => {
    expect(validMovie({ ...baseMovie, overview: "" })).toBeFalse()
    expect(validMovie({ ...baseMovie, overview: "   " })).toBeFalse()
  })

  it("rejects below minimum vote count", () => {
    expect(validMovie({ ...baseMovie, vote_count: MIN_VOTE_COUNT - 1 })).toBeFalse()
  })

  it("rejects missing genres", () => {
    expect(validMovie({ ...baseMovie, genre_ids: [] })).toBeFalse()
  })

  it("rejects adult title keywords", () => {
    expect(validMovie({ ...baseMovie, title: "Hot Sex Movie" })).toBeFalse()
    expect(validMovie({ ...baseMovie, overview: "erotic adult content" })).toBeFalse()
  })

  it("rejects banned certifications", () => {
    expect(validMovie({ ...baseMovie, certification: "NC-17" })).toBeFalse()
    expect(validMovie({ ...baseMovie, certification: "18+" })).toBeFalse()
  })

  it("accepts exactly MIN_VOTE_COUNT votes", () => {
    expect(validMovie({ ...baseMovie, vote_count: MIN_VOTE_COUNT })).toBeTrue()
  })
})

// ---------------------------------------------------------------------------
// validTV
// ---------------------------------------------------------------------------

describe("validTV", () => {
  it("accepts a well-formed TV show", () => {
    expect(validTV(baseTV)).toBeTrue()
  })

  it("rejects missing poster", () => {
    expect(validTV({ ...baseTV, poster_path: null })).toBeFalse()
  })

  it("rejects future air date", () => {
    expect(validTV({ ...baseTV, first_air_date: FUTURE })).toBeFalse()
  })

  it("rejects empty overview", () => {
    expect(validTV({ ...baseTV, overview: "" })).toBeFalse()
  })

  it("rejects below minimum vote count", () => {
    expect(validTV({ ...baseTV, vote_count: 0 })).toBeFalse()
  })

  it("rejects adult name keywords", () => {
    expect(validTV({ ...baseTV, name: "Hentai Show" })).toBeFalse()
  })

  it("rejects banned certifications", () => {
    expect(validTV({ ...baseTV, certification: "18" })).toBeFalse()
  })
})

// ---------------------------------------------------------------------------
// validMovieSearch — relaxed validator
// ---------------------------------------------------------------------------

describe("validMovieSearch", () => {
  const freshDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    return d.toISOString().slice(0, 10)
  })()

  it("accepts a movie with low votes if it is fresh", () => {
    expect(
      validMovieSearch({ ...baseMovie, vote_count: 5, popularity: 1, release_date: freshDate }),
    ).toBeTrue()
  })

  it("rejects an old movie with too few votes and low popularity", () => {
    expect(
      validMovieSearch({ ...baseMovie, vote_count: 1, popularity: 0.5, release_date: "2010-01-01" }),
    ).toBeFalse()
  })

  it("accepts an old movie with decent popularity even with few votes", () => {
    expect(
      validMovieSearch({ ...baseMovie, vote_count: 5, popularity: 10, release_date: "2010-01-01" }),
    ).toBeTrue()
  })

  it("still rejects adult content", () => {
    expect(validMovieSearch({ ...baseMovie, adult: true })).toBeFalse()
  })

  it("still requires a poster", () => {
    expect(validMovieSearch({ ...baseMovie, poster_path: null })).toBeFalse()
  })

  it("still rejects future releases", () => {
    expect(validMovieSearch({ ...baseMovie, release_date: FUTURE })).toBeFalse()
  })
})

// ---------------------------------------------------------------------------
// validTVSearch — relaxed validator
// ---------------------------------------------------------------------------

describe("validTVSearch", () => {
  const freshDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    return d.toISOString().slice(0, 10)
  })()

  it("accepts a fresh show with low votes", () => {
    expect(
      validTVSearch({ ...baseTV, vote_count: 5, popularity: 1, first_air_date: freshDate }),
    ).toBeTrue()
  })

  it("rejects old show with too few votes and low popularity", () => {
    expect(
      validTVSearch({ ...baseTV, vote_count: 1, popularity: 0.5, first_air_date: "2010-01-01" }),
    ).toBeFalse()
  })

  it("requires a poster", () => {
    expect(validTVSearch({ ...baseTV, poster_path: null })).toBeFalse()
  })
})

// ---------------------------------------------------------------------------
// validMovieCredit / validTVCredit
// ---------------------------------------------------------------------------

describe("validMovieCredit", () => {
  it("accepts a valid movie credit", () => {
    expect(validMovieCredit(baseMovie)).toBeTrue()
  })

  it("rejects adult flag", () => {
    expect(validMovieCredit({ ...baseMovie, adult: true })).toBeFalse()
  })

  it("rejects missing poster", () => {
    expect(validMovieCredit({ ...baseMovie, poster_path: null })).toBeFalse()
  })

  it("rejects missing genres", () => {
    expect(validMovieCredit({ ...baseMovie, genre_ids: [] })).toBeFalse()
  })
})

describe("validTVCredit", () => {
  it("accepts a valid TV credit", () => {
    expect(validTVCredit(baseTV)).toBeTrue()
  })

  it("rejects missing genres", () => {
    expect(validTVCredit({ ...baseTV, genre_ids: [] })).toBeFalse()
  })
})

// ---------------------------------------------------------------------------
// filterMovies / filterTV — batch wrappers
// ---------------------------------------------------------------------------

describe("filterMovies", () => {
  it("filters out invalid entries and keeps valid ones", () => {
    const results = [
      { ...baseMovie, id: 1 },
      { ...baseMovie, id: 2, poster_path: null },
      { ...baseMovie, id: 3, adult: true },
    ] as any[]
    const page = filterMovies({ results, page: 1, total_pages: 1, total_results: 3 })
    expect(page.results).toHaveLength(1)
    expect(page.results[0].id).toBe(1)
  })

  it("preserves pagination metadata", () => {
    const page = filterMovies({ results: [], page: 2, total_pages: 5, total_results: 100 })
    expect(page.page).toBe(2)
    expect(page.total_pages).toBe(5)
    expect(page.total_results).toBe(100)
  })
})

describe("filterTV", () => {
  it("filters out invalid TV entries", () => {
    const results = [
      { ...baseTV, id: 1 },
      { ...baseTV, id: 2, poster_path: null },
    ] as any[]
    const page = filterTV({ results, page: 1, total_pages: 1, total_results: 2 })
    expect(page.results).toHaveLength(1)
  })
})
