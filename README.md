<p align="center">
  <img src=".github/icon.png" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">NeoMovies API v2</h1>

<p align="center">
  Rust REST API for NeoMovies with Neo ID SSO authentication, deployable on Vercel and Netlify
</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNeo-Open-Source%2Fneomovies-api&project-name=neomovies-api">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/Neo-Open-Source/neomovies-api">
    <img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" />
  </a>
</p>

## Features

- Serverless Rust functions on Vercel and Netlify-ready docs hosting
- Authentication via Neo ID SSO only (no email/password)
- Media data from Kinopoisk API
- Favorites management (idempotent add/remove)
- Video player iframe endpoints (Alloha, Lumex, Vibix, HDVB, Collaps)
- Full-text search via Kinopoisk
- JWT (HS256) with refresh token rotation
- MongoDB for users, favorites, and refresh tokens
- CORS allowed for all origins

## Stack

- Backend: Rust + Axum (serverless via `vercel_runtime`)
- Database: MongoDB
- Auth: Neo ID SSO (JWT HS256)
- Deployment: Vercel Serverless Functions or Netlify static hosting with API proxying
- Docs: Docusaurus + Scalar API Reference

## Environment

Copy `.env.example` and fill in the values:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret
NEO_ID_URL=https://id.neomovies.ru
NEO_ID_API_KEY=...
NEO_ID_SITE_ID=...
PUBLIC_API_URL=https://api.neomovies.ru
KPAPI_KEY=...

# Video players (optional, enable as needed)
ALLOHA_TOKEN=...
LUMEX_TOKEN=...
VIBIX_TOKEN=...
HDVB_TOKEN=...
COLLAPS_TOKEN=...
```

## Development

```bash
cargo run --bin server
```

## Deployment

Deploy to Vercel:

```bash
vercel deploy
```

Deploy to Netlify:

```bash
netlify deploy --build --prod
```

Each file in `api/` becomes a serverless function on Vercel. On Netlify, the repository builds and publishes `docs/build`, while `/api/v1/*` is proxied to `https://api.neomovies.ru/api/v1/*` via `netlify.toml`. See [docs/docs/deployment.md](docs/docs/deployment.md) for details.
The Netlify deploy button is docs-only plus API proxying, so it does not require the backend secrets used by Vercel.

### Hosting routes

- `/` -> API documentation site (Docusaurus build from `docs/build`)
- `/api/v1/*` -> NeoMovies API endpoints
  on Vercel: Rust serverless handlers from `api/`
  on Netlify: proxy to `https://api.neomovies.ru/api/v1/*`
- `/openapi.yaml` -> OpenAPI schema used by docs
- Shared docs build step: `bash ./scripts/build-docs.sh`

## API Overview

| Group | Prefix | Description |
|-------|--------|-------------|
| Auth | `/api/v1/auth/*` | Login, callback, refresh, revoke, profile, delete |
| Search | `/api/v1/search` | Search via Kinopoisk |
| Media | `/api/v1/movie/:id` | Film details by Kinopoisk ID |
| Images | `/api/v1/images/*` | Poster, screens, backdrops, page backdrops, logos |
| Players | `/api/v1/players/*` | Video player iframes |
| Favorites | `/api/v1/favorites/*` | Add, remove, list, check favorites |
| Support | `/api/v1/support` | Support requests |
| Health | `/api/v1/health` | Health check |

Full spec: [`openapi.yaml`](openapi.yaml)  
Docs (local build in repo): [`docs/build`](docs/build)  
Docs (production): [api.neomovies.ru](https://api.neomovies.ru)

### Mobile Neo ID callback

For mobile clients, backend supports redirect trampoline:

- `POST /api/v1/auth/neo-id/login` with `mobile_redirect_url` (e.g. `neomovies://auth/neo-id/callback`)
- Neo ID redirects to `/api/v1/auth/neo-id/mobile-callback`
- API redirects (`302`) to mobile deep link with `access_token` in query

Important: set `PUBLIC_API_URL` in Vercel env (example: `https://api.neomovies.ru`).

## License

[MIT](LICENSE)
