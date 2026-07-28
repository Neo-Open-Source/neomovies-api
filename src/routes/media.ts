import { Elysia, t } from "elysia"
import { tmdb } from "../services/tmdb"
import { omdb } from "../services/omdb"
import { success } from "../lib/response"
import { mapMovie, mapTV, mapCastMember, mapCrewMember, mapCompany, mapSeason, mapEpisode, mapNetwork, paginate } from "../lib/mappers"
import { authMiddleware } from "../middleware/auth"

export const mediaRoutes = new Elysia()
  .use(authMiddleware)

  .get("/api/v1/movie/:id", async ({ params: { id } }) => {
    const [movie, credits] = await Promise.all([
      tmdb.movie(id),
      tmdb.movieCredits(id),
    ])
    const imdbRating = movie.imdb_id ? await omdb.getRating(movie.imdb_id) : null
    return success({
      ...mapMovie(movie),
      runtime: movie.runtime,
      budget: movie.budget,
      revenue: movie.revenue,
      status: movie.status,
      tagline: movie.tagline,
      imdbRating: imdbRating?.imdbRating ?? null,
      imdbVotes: imdbRating?.imdbVotes ?? null,
      productionCompanies: (movie.production_companies || []).map(mapCompany),
      collection: movie.belongs_to_collection
        ? { id: movie.belongs_to_collection.id, name: movie.belongs_to_collection.name, poster: tmdb.imageUrl(movie.belongs_to_collection.poster_path, "w300") }
        : null,
      credits: {
        cast: (credits.cast || []).slice(0, 20).map(mapCastMember),
        crew: (credits.crew || []).slice(0, 20).map(mapCrewMember),
      },
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id", async ({ params: { id } }) => {
    const [show, credits] = await Promise.all([
      tmdb.tvShow(id),
      tmdb.tvCredits(id),
    ])
    const externalIds = await tmdb.tvExternalIds(id).catch(() => null)
    const imdbId = externalIds?.imdb_id ?? null
    const imdbRating = imdbId ? await omdb.getRating(imdbId) : null
    return success({
      ...mapTV(show),
      imdbId,
      imdbRating: imdbRating?.imdbRating ?? null,
      imdbVotes: imdbRating?.imdbVotes ?? null,
      seasons: (show.seasons || []).map(mapSeason),
      numberOfSeasons: show.number_of_seasons,
      numberOfEpisodes: show.number_of_episodes,
      status: show.status,
      tagline: show.tagline,
      networks: (show.networks || []).map(mapNetwork),
      productionCompanies: (show.production_companies || []).map(mapCompany),
      credits: {
        cast: (credits.cast || []).slice(0, 20).map(mapCastMember),
        crew: (credits.crew || []).slice(0, 20).map(mapCrewMember),
      },
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season", async ({ params: { id, season } }) => {
    const data = await tmdb.tvSeason(id, season)
    return success({
      id: data.id,
      name: data.name,
      seasonNumber: data.season_number,
      overview: data.overview,
      poster: tmdb.imageUrl(data.poster_path, "w342"),
      airDate: data.air_date,
      episodes: (data.episodes || []).map(mapEpisode),
    })
  }, {
    params: t.Object({ id: t.Numeric(), season: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season/episode/:episode", async ({ params: { id, season, episode } }) => {
    const ep = await tmdb.tvEpisode(id, season, episode)
    return success(mapEpisode(ep))
  }, {
    params: t.Object({ id: t.Numeric(), season: t.Numeric(), episode: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/credits", async ({ params: { id } }) => {
    const credits = await tmdb.movieCredits(id)
    return success({
      cast: (credits.cast || []).slice(0, 20).map(mapCastMember),
      crew: (credits.crew || []).slice(0, 20).map(mapCrewMember),
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/credits", async ({ params: { id } }) => {
    const credits = await tmdb.tvCredits(id)
    return success({
      cast: (credits.cast || []).slice(0, 20).map(mapCastMember),
      crew: (credits.crew || []).slice(0, 20).map(mapCrewMember),
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/recommendations", async ({ params: { id }, query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.recommendations("movie", id, page)
    return success(paginate(data.results.map(mapMovie as any), data.page, data.total_pages, data.total_results))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/recommendations", async ({ params: { id }, query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.recommendations("tv", id, page)
    return success(paginate(data.results.map(mapTV as any), data.page, data.total_pages, data.total_results))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/similar", async ({ params: { id }, query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.similar("movie", id, page)
    return success(paginate(data.results.map(mapMovie as any), data.page, data.total_pages, data.total_results))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/similar", async ({ params: { id }, query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.similar("tv", id, page)
    return success(paginate(data.results.map(mapTV as any), data.page, data.total_pages, data.total_results))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/popular", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.popularMovies(page)
    return success(paginate(data.results.map(mapMovie), data.page, data.total_pages, data.total_results))
  })

  .get("/api/v1/movie/top-rated", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.topRatedMovies(page)
    return success(paginate(data.results.map(mapMovie), data.page, data.total_pages, data.total_results))
  })

  .get("/api/v1/movie/upcoming", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.upcomingMovies(page)
    return success(paginate(data.results.map(mapMovie), data.page, data.total_pages, data.total_results))
  })

  .get("/api/v1/tv/popular", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.popularTV(page)
    return success(paginate(data.results.map(mapTV), data.page, data.total_pages, data.total_results))
  })

  .get("/api/v1/tv/top-rated", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.topRatedTV(page)
    return success(paginate(data.results.map(mapTV), data.page, data.total_pages, data.total_results))
  })
