# ImmichVR Depth Converter

A containerized VR photo depth conversion tool.

## Architecture

This project consists of four services:

- **PostgreSQL Database** - Data persistence layer
- **Python AI Service** - Depth conversion AI processing
- **Node.js Backend** - API and business logic
- **React Frontend** - User interface

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Papyszoo/ImmichVR.git
cd ImmichVR
```

### 2. Configure environment

Copy the example environment file and customize as needed:

```bash
cp .env.example .env
```

Available configuration options:

| Variable           | Default     | Description                    |
|--------------------|-------------|--------------------------------|
| `APP_PORT`         | `21370`     | Frontend exposed port          |
| `POSTGRES_USER`    | `immichvr`  | PostgreSQL username            |
| `POSTGRES_PASSWORD`| `changeme`  | PostgreSQL password            |
| `POSTGRES_DB`      | `immichvr`  | PostgreSQL database name       |
| `BACKEND_PORT`     | `3000`      | Backend internal port          |
| `AI_SERVICE_PORT`  | `5000`      | AI service internal port       |
| `IMMICH_URL`       | -           | Immich instance URL (optional) |
| `IMMICH_API_KEY`   | -           | Immich API key (optional)      |

### 3. Build the stack

```bash
docker compose build
```

### 4. Run the stack

Start all services:

```bash
docker compose up -d
```

View logs:

```bash
docker compose logs -f
```

### 5. Access the application

Open your browser and navigate to:

```
http://localhost:21370
```

(or the port configured in `APP_PORT`)

### 6. Stop the stack

Stop all services:

```bash
docker compose down
```

Stop and remove volumes (clears database):

```bash
docker compose down -v
```

## Development

### Rebuild a specific service

```bash
docker compose build <service-name>
docker compose up -d <service-name>
```

Where `<service-name>` is one of: `db`, `ai`, `backend`, `frontend`

### View service logs

```bash
docker compose logs -f <service-name>
```

### Access a service shell

```bash
docker compose exec <service-name> sh
```

## Services

### Database (PostgreSQL)

- **Container**: `immichvr-db`
- **Image**: `postgres:16-alpine`
- **Internal Network**: `immichvr-network`

### AI Service (Python/Flask)

- **Container**: `immichvr-ai`
- **Build Context**: `./services/ai`
- **Health Endpoint**: `GET /health`

### Backend (Node.js/Express)

- **Container**: `immichvr-backend`
- **Build Context**: `./services/backend`
- **Health Endpoint**: `GET /health`
- **Immich Integration**: Optional connection to Immich instance for fetching media

For Immich integration documentation, see [IMMICH_CONNECTOR.md](services/backend/IMMICH_CONNECTOR.md).

For media fetch logic (thumbnails & full-resolution), see [MEDIA_VERSIONS.md](MEDIA_VERSIONS.md).

For experimental video depth map support, see [VIDEO_DEPTH_SUPPORT.md](VIDEO_DEPTH_SUPPORT.md).

### Frontend (React/Nginx)

- **Container**: `immichvr-frontend`
- **Build Context**: `./services/frontend`
- **External Port**: `${APP_PORT:-21370}`

## License

MIT License - see [LICENSE](LICENSE) for details.
