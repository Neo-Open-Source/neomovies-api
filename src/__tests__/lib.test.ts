import { describe, expect, it } from "bun:test"
import { success } from "../lib/response"
import { page } from "../lib/query"
import { language } from "../lib/language"
import { BACKDROP_SIZES, POSTER_SIZES, STILL_SIZES } from "../lib/images"
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from "../lib/errors"

describe("response helpers", () => {
  it("success wraps data", () => {
    const res = success({ foo: "bar" })
    expect(res.success).toBeTrue()
    expect(res.data).toEqual({ foo: "bar" })
  })
})

describe("error classes", () => {
  it("AppError has status code and message", () => {
    const err = new AppError(400, "test error")
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe("test error")
    expect(err.name).toBe("AppError")
  })

  it("BadRequestError defaults to 400", () => {
    const err = new BadRequestError("Invalid input")
    expect(err.statusCode).toBe(400)
  })

  it("NotFoundError defaults to 404", () => {
    const err = new NotFoundError("Movie")
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe("Movie not found")
  })

  it("UnauthorizedError defaults to 401", () => {
    const err = new UnauthorizedError()
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe("Unauthorized")
  })

  it("ForbiddenError defaults to 403", () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
  })
})

describe("page helper", () => {
  it("returns default 1 when no page", () => {
    expect(page({})).toBe(1)
  })

  it("parses page number", () => {
    expect(page({ page: "3" })).toBe(3)
  })
})

describe("language helper", () => {
  it("defaults to ru-RU", () => {
    expect(language({})).toBe("ru-RU")
  })

  it("accepts supported languages", () => {
    expect(language({ language: "en-US" })).toBe("en-US")
    expect(language({ language: "uk-UA" })).toBe("uk-UA")
  })

  it("falls back to default for unsupported", () => {
    expect(language({ language: "fr-FR" })).toBe("ru-RU")
  })
})

describe("image size constants", () => {
  it("have expected poster sizes", () => {
    expect(POSTER_SIZES).toContain("w185")
    expect(POSTER_SIZES).toContain("w500")
  })

  it("have expected backdrop sizes", () => {
    expect(BACKDROP_SIZES).toContain("w300")
    expect(BACKDROP_SIZES).toContain("w1280")
  })

  it("have expected still sizes", () => {
    expect(STILL_SIZES).toContain("w185")
    expect(STILL_SIZES).toContain("w300")
  })
})
