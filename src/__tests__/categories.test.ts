import { describe, expect, it } from "bun:test"
import {
  listCategories,
  studioCategories,
  networkCategories,
  allStaticCategories,
  type CategoryDef,
} from "../data/categories"

// ---------------------------------------------------------------------------
// Structure validation helpers
// ---------------------------------------------------------------------------

function assertCategoryShape(cat: CategoryDef) {
  expect(typeof cat.id).toBe("string")
  expect(cat.id.length).toBeGreaterThan(0)
  expect(typeof cat.name).toBe("string")
  expect(cat.name.length).toBeGreaterThan(0)
  expect(typeof cat.slug).toBe("string")
  expect(cat.slug.length).toBeGreaterThan(0)
  expect(["list", "genre", "company", "network"]).toContain(cat.kind)
  expect(["movie", "tv"]).toContain(cat.mediaType)
  expect(typeof cat.value).toBe("string")
  expect(cat.value.length).toBeGreaterThan(0)
}

function assertNoDuplicateIds(cats: CategoryDef[]) {
  const ids = cats.map(c => c.id)
  expect(new Set(ids).size).toBe(ids.length)
}

function assertNoDuplicateSlugs(cats: CategoryDef[]) {
  const slugs = cats.map(c => c.slug)
  expect(new Set(slugs).size).toBe(slugs.length)
}

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

describe("listCategories", () => {
  it("contains expected entries", () => {
    const slugs = listCategories.map(c => c.slug)
    expect(slugs).toContain("popular-movies")
    expect(slugs).toContain("top-movies")
    expect(slugs).toContain("upcoming")
    expect(slugs).toContain("popular-tv")
    expect(slugs).toContain("top-tv")
  })

  it("all entries have kind=list", () => {
    expect(listCategories.every(c => c.kind === "list")).toBeTrue()
  })

  it("all entries have valid shape", () => {
    for (const cat of listCategories) assertCategoryShape(cat)
  })

  it("has no duplicate IDs", () => {
    assertNoDuplicateIds(listCategories)
  })
})

// ---------------------------------------------------------------------------
// studioCategories
// ---------------------------------------------------------------------------

describe("studioCategories", () => {
  it("all entries have kind=company", () => {
    expect(studioCategories.every(c => c.kind === "company")).toBeTrue()
  })

  it("all entries have mediaType=movie", () => {
    expect(studioCategories.every(c => c.mediaType === "movie")).toBeTrue()
  })

  it("contains major studios", () => {
    const ids = studioCategories.map(c => c.id)
    for (const expected of ["marvel", "disney", "warner-bros", "universal", "a24"]) {
      expect(ids).toContain(expected)
    }
  })

  it("all entries have valid shape", () => {
    for (const cat of studioCategories) assertCategoryShape(cat)
  })

  it("has no duplicate IDs", () => {
    assertNoDuplicateIds(studioCategories)
  })

  it("has no duplicate slugs", () => {
    assertNoDuplicateSlugs(studioCategories)
  })
})

// ---------------------------------------------------------------------------
// networkCategories
// ---------------------------------------------------------------------------

describe("networkCategories", () => {
  it("all entries have kind=network", () => {
    expect(networkCategories.every(c => c.kind === "network")).toBeTrue()
  })

  it("all entries have mediaType=tv", () => {
    expect(networkCategories.every(c => c.mediaType === "tv")).toBeTrue()
  })

  it("contains major streaming platforms", () => {
    const ids = networkCategories.map(c => c.id)
    for (const expected of ["netflix", "hbo", "apple-tv-plus", "prime-video", "hulu"]) {
      expect(ids).toContain(expected)
    }
  })

  it("all entries have valid shape", () => {
    for (const cat of networkCategories) assertCategoryShape(cat)
  })

  it("has no duplicate IDs", () => {
    assertNoDuplicateIds(networkCategories)
  })
})

// ---------------------------------------------------------------------------
// allStaticCategories
// ---------------------------------------------------------------------------

describe("allStaticCategories", () => {
  it("is the union of list + studio + network categories", () => {
    const expected = [...listCategories, ...studioCategories, ...networkCategories]
    expect(allStaticCategories).toEqual(expected)
  })

  it("has no duplicate IDs across all categories", () => {
    assertNoDuplicateIds(allStaticCategories)
  })

  it("has no duplicate slugs across all categories", () => {
    assertNoDuplicateSlugs(allStaticCategories)
  })

  it("all entries pass shape validation", () => {
    for (const cat of allStaticCategories) assertCategoryShape(cat)
  })

  it("can be found by slug", () => {
    const slug = "marvel"
    const found = allStaticCategories.find(c => c.slug === slug)
    expect(found).toBeDefined()
    expect(found?.kind).toBe("company")
  })
})
