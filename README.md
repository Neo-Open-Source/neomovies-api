<p align="center">
  <img src=".github/icon.png" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">NeoMovies API v2</h1>

<p align="center">
  Rust + Vercel serverless REST API for NeoMovies with Neo ID SSO authentication
</p>

## Features

- Serverless Rust functions deployed on Vercel
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
- Deployment: Vercel Serverless Functions
- Docs: Docusaurus + Scalar API Reference

## Environment

Copy `.env.example` and fill in the values:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret
NEO_ID_URL=https://id.neomovies.ru
NEO_ID_API_KEY=...
NEO_ID_API_SECRET=...
KINOPOISK_API_KEY=...

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

Each file in `api/` becomes a serverless function. See [docs/docs/deployment.md](docs/docs/deployment.md) for details.

### Vercel routes

- `/` -> API documentation site (Docusaurus build from `docs/build`)
- `/api/v1/*` -> NeoMovies API endpoints (Rust serverless handlers from `api/`)
- `/openapi.yaml` -> OpenAPI schema used by docs
- Vercel build step automatically builds docs: `npm --prefix docs ci && npm --prefix docs run build`

## API Overview

| Group | Prefix | Description |
|-------|--------|-------------|
| Auth | `/api/v1/auth/*` | Login, callback, refresh, revoke, profile, delete |
| Search | `/api/v1/search` | Search via Kinopoisk |
| Media | `/api/v1/movie/:id` | Film details by Kinopoisk ID |
| Players | `/api/v1/players/*` | Video player iframes |
| Favorites | `/api/v1/favorites/*` | Add, remove, list, check favorites |
| Support | `/api/v1/support` | Support requests |
| Health | `/api/v1/health` | Health check |

Full spec: [`openapi.yaml`](openapi.yaml)  
Docs (local build in repo): [`docs/build`](docs/build)  
Docs (production): [docs.neomovies.ru](https://docs.neomovies.ru)

## License

[MIT](LICENSE)
