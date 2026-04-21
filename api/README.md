# SurvivalKendy API

Minimal backend service for frontend data endpoints.

## Endpoints

- `GET /health`
- `GET /status`
- `GET /players`
- `GET /uptime?range=30d|90d|1d`
- `POST /apply`
- `GET /status/:username`
- `GET /admin/applications` (requires `Admin-Secret` header)
- `POST /admin/update-status` (requires `Admin-Secret` header)

## Run locally

1. `cd api`
2. `npm install`
3. Copy `.env.example` to `.env` and edit values
4. `npm start`

API will run on `http://0.0.0.0:3001` by default.

## Production notes (GCP + Nginx)

- Run API as system service (or PM2) on localhost:3001.
- Nginx should proxy `https://api.survivalkendy.systems/*` to `http://127.0.0.1:3001`.
- In frontend GitHub Secret, set:
  - `VITE_API_BASE=https://api.survivalkendy.systems`

## Env variables used

- `PORT`
- `CORS_ORIGINS`
- `MC_SERVER_HOSTS`
- `MC_SERVER_PORT`
- `BEDROCK_PORT`
- `UPTIME_KUMA_STATUS_PAGE_URL`
- `UPTIME_KUMA_MONITOR_MINECRAFT`
- `UPTIME_KUMA_MONITOR_VM`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `APPLICATIONS_TABLE`
- `AUTO_WAITLIST_INTERVAL_MS`
- `ADMIN_USERNAME`
- `ADMIN_SECRET`
