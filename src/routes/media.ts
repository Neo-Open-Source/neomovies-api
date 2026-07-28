import { Elysia, t } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

function mapMovie(m: any) {
  return {
    id: m.id,
    title: m.title,
    originalTitle: m.original_title,
    overview: m.overview,
    posterPath: tmdb.imageUrl(m.poster_path, "w500"),
    backdropPath: tmdb.imageUrl(m.backdrop_path, "w1280"),
    releaseDate: m.release_date || "",
    genres: (m.genres || []).map((g: any) => ({ id: g.id, name: g.name })),
    voteAverage: m.vote_average,
    voteCount: m.vote_count,
    popularity: m.popularity,
  }
}

function mapTV(t: any) {
  return {
    id: t.id,
    title: t.name,
    originalTitle: t.original_name,
    overview: t.overview,
    posterPath: tmdb.imageUrl(t.poster_path, "w500"),
    backdropPath: tmdb.imageUrl(t.backdrop_path, "w1280"),
    releaseDate: t.first_air_date || "",
    genres: (t.genres || []).map((g: any) => ({ id: g.id, name: g.name })),
    voteAverage: t.vote_average,
    voteCount: t.vote_count,
    popularity: t.popularity,
  }
}

export const mediaRoutes = new Elysia()
  .use(authMiddleware)

  .get("/api/v1/movie/:id", async ({ params: { id } }) => {
    const movie = await tmdb.movie(id)
    const [credits, videos] = await Promise.all([
      tmdb.movieCredits(id),
      tmdb.movieVideos(id),
    ])
    return success({
      ...mapMovie(movie),
      runtime: movie.runtime,
      budget: movie.budget,
      revenue: movie.revenue,
      status: movie.status,
      tagline: movie.tagline,
      imdbId: movie.imdb_id,
      productionCompanies: (movie.production_companies || []).map((c: any) => ({
        id: c.id, name: c.name, logoPath: tmdb.imageUrl(c.logo_path, "w92"),
      })),
      collection: movie.belongs_to_collection
        ? { id: movie.belongs_to_collection.id, name: movie.belongs_to_collection.name, posterPath: tmdb.imageUrl(movie.belongs_to_collection.poster_path, "w300") }
        : null,
      videos: (videos.results || []).filter((v: any) => v.site === "YouTube").map((v: any) => ({
        key: v.key, name: v.name, site: v.site, type: v.type,
      })),
      credits: {
        cast: (credits.cast || []).slice(0, 20).map((c: any) => ({
          id: c.id, name: c.name, character: c.character, profilePath: tmdb.imageUrl(c.profile_path, "w185"), order: c.order,
        })),
        crew: (credits.crew || []).slice(0, 20).map((c: any) => ({
          id: c.id, name: c.name, job: c.job, department: c.department, profilePath: tmdb.imageUrl(c.profile_path, "w185"),
        })),
      },
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id", async ({ params: { id } }) => {
    const show = await tmdb.tvShow(id)
    const [credits, videos] = await Promise.all([
      tmdb.tvCredits(id),
      tmdb.tvVideos(id),
    ])
    return success({
      ...mapTV(show),
      seasons: (show.seasons || []).map((s: any) => ({
        id: s.id, name: s.name, seasonNumber: s.season_number, episodeCount: s.episode_count,
        overview: s.overview, posterPath: tmdb.imageUrl(s.poster_path, "w342"), airDate: s.air_date,
      })),
      numberOfSeasons: show.number_of_seasons,
      numberOfEpisodes: show.number_of_episodes,
      status: show.status,
      networks: (show.networks || []).map((n: any) => ({
        id: n.id, name: n.name, logoPath: tmdb.imageUrl(n.logo_path, "w92"),
      })),
      videos: (videos.results || []).filter((v: any) => v.site === "YouTube").map((v: any) => ({
        key: v.key, name: v.name, site: v.site, type: v.type,
      })),
      credits: {
        cast: (credits.cast || []).slice(0, 20).map((c: any) => ({
          id: c.id, name: c.name, character: c.character, profilePath: tmdb.imageUrl(c.profile_path, "w185"), order: c.order,
        })),
        crew: (credits.crew || []).slice(0, 20).map((c: any) => ({
          id: c.id, name: c.name, job: c.job, department: c.department, profilePath: tmdb.imageUrl(c.profile_path, "w185"),
        })),
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
      posterPath: tmdb.imageUrl(data.poster_path, "w342"),
      airDate: data.air_date,
      episodes: (data.episodes || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        overview: e.overview,
        stillPath: tmdb.imageUrl(e.still_path, "w300"),
        airDate: e.air_date,
        episodeNumber: e.episode_number,
        seasonNumber: e.season_number,
        voteAverage: e.vote_average,
        runtime: e.runtime,
      })),
    })
  }, {
    params: t.Object({ id: t.Numeric(), season: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season/episode/:episode", async ({ params: { id, season, episode } }) => {
    const ep = await tmdb.tvEpisode(id, season, episode)
    return success({
      id: ep.id,
      name: ep.name,
      overview: ep.overview,
      stillPath: tmdb.imageUrl(ep.still_path, "w300"),
      airDate: ep.air_date,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      voteAverage: ep.vote_average,
      runtime: ep.runtime,
    })
  }, {
    params: t.Object({ id: t.Numeric(), season: t.Numeric(), episode: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/videos", async ({ params: { id } }) => {
    const { results } = await tmdb.movieVideos(id)
    return success(results.filter((v: any) => v.site === "YouTube").map((v: any) => ({
      key: v.key, name: v.name, site: v.site, type: v.type, official: v.official,
    })))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/credits", async ({ params: { id } }) => {
    const credits = await tmdb.movieCredits(id)
    return success({
      cast: (credits.cast || []).slice(0, 20).map((c: any) => ({
        id: c.id, name: c.name, character: c.character, profilePath: tmdb.imageUrl(c.profile_path, "w185"), order: c.order,
      })),
      crew: (credits.crew || []).slice(0, 20).map((c: any) => ({
        id: c.id, name: c.name, job: c.job, department: c.department, profilePath: tmdb.imageUrl(c.profile_path, "w185"),
      })),
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/recommendations", async ({ params: { id }, query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.recommendations("movie", id, page)
    return success({
      items: data.results.map(mapMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/similar", async ({ params: { id }, query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.similar("movie", id, page)
    return success({
      items: data.results.map(mapMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/popular", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.popularMovies(page)
    return success({
      items: data.results.map(mapMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  })

  .get("/api/v1/movie/top-rated", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.topRatedMovies(page)
    return success({
      items: data.results.map(mapMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  })

  .get("/api/v1/movie/upcoming", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.upcomingMovies(page)
    return success({
      items: data.results.map(mapMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  })

  .get("/api/v1/tv/popular", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.popularTV(page)
    return success({
      items: data.results.map(mapTV),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  })

  .get("/api/v1/tv/top-rated", async ({ query }) => {
    const page = parseInt((query as any)?.page || "1")
    const data = await tmdb.topRatedTV(page)
    return success({
      items: data.results.map(mapTV),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  })
