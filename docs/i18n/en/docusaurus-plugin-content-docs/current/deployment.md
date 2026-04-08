---
id: deployment
sidebar_position: 4
---

# Deployment

NeoMovies API v2 is deployed on Vercel as Rust serverless functions (`api/*.rs`) and builds Docusaurus docs from `docs/`.

## Prerequisites

- [Rust](https://rustup.rs) (stable)
- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- MongoDB Atlas
- Kinopoisk API key

## 1. Local Validation

```bash
cp .env.example .env
cargo check
cargo test --lib
```

## 2. Run API Locally

```bash
cargo run --bin server
```

Default local API URL: `http://localhost:3000/api/v1`.

Port can be set via:

- `LOCAL_SERVER_PORT` (priority)
- `PORT`

Example:

```bash
LOCAL_SERVER_PORT=3001 cargo run --bin server
```

For local docs preview, run Docusaurus separately:

```bash
npm --prefix docs ci
npm --prefix docs run start
```

Default local docs URL: `http://localhost:3000/docs`.

## 3. Deploy to Vercel

```bash
vercel deploy --prod
```

`vercel.json` defines:

- `buildCommand`: `npm --prefix docs ci && npm --prefix docs run build`
- rewrites for docs (`/`) and API (`/api/v1/*`)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret |
| `MONGO_DB_NAME` | — | DB name (default: `neomovies`) |
| `KPAPI_KEY` | ✅ | Kinopoisk API key |
| `KPAPI_BASE_URL` | — | KP API base URL |
| `NEO_ID_URL` | ✅ | Neo ID base URL |
| `NEO_ID_API_KEY` | ✅ | Neo ID API key |
| `NEO_ID_SITE_ID` | ✅ | Neo ID site ID |
| `ALLOHA_TOKEN` | — | Alloha token |
| `LUMEX_URL` | — | Lumex embed base URL |
| `VIBIX_HOST` | — | Vibix host |
| `VIBIX_TOKEN` | — | Vibix token |
| `HDVB_TOKEN` | — | HDVB token |
| `COLLAPS_API_HOST` | — | Collaps API host |
| `COLLAPS_TOKEN` | — | Collaps token |
| `REDAPI_BASE_URL` | — | Torrent API base URL |

## Routes After Vercel Deploy

- `/` — docs site (Vercel-only route)
- `/api/v1/*` — REST API
