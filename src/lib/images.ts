export const POSTER_SIZES = ["w185", "w342", "w500", "w780"] as const
export const BACKDROP_SIZES = ["w300", "w780", "w1280"] as const
export const STILL_SIZES = ["w185", "w300"] as const
export const PROFILE_SIZES = ["w45", "w185", "h632"] as const
export const LOGO_SIZES = ["w92", "w154", "w300"] as const

export type PosterSize = typeof POSTER_SIZES[number]
export type BackdropSize = typeof BACKDROP_SIZES[number]
export type StillSize = typeof STILL_SIZES[number]
