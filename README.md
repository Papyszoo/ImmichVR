# ImmichVR

A WebXR-enabled gallery that brings your self-hosted [Immich](https://immich.app/) library into Virtual Reality 🥽. 

This project automatically generates depth maps for your photos using AI, creating a convincing 3D effect when viewed in a VR headset.

## Features

- 📸 **Immich Integration**: Seamlessly fetches photos from your self-hosted Immich instance.
- 🤖 **AI Depth Generation**: Automatically creates depth maps for your images to enable 3D viewing.
- ⚙️ **Model Selection**: Choose from different AI models for depth generation or use the default optimized settings.
- 🕶️ **WebXR Support**: Works directly in the browser on standalone VR headsets (e.g., Quest 3) and PCVR.
- 🎨 **VR Gallery**: unparalleled immersion with a dedicated VR interface.

## Roadmap

- [ ] **Gaussian Splatting**: Future support for generating and displaying 3D Gaussian Splats for even more realistic scene reconstruction.
- [ ] **Advanced Model Configuration**: Fine-tune depth generation parameters.

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

- **Health Endpoint**: `GET /health`
- **Immich Integration**: Optional connection to Immich instance for fetching media

For Immich integration documentation, see [IMMICH_CONNECTOR.md](services/backend/IMMICH_CONNECTOR.md).

### Frontend (React/Nginx)

- **Container**: `immichvr-frontend`
- **Build Context**: `./services/frontend`
- **External Port**: `${APP_PORT:-21370}`
- **Features**: 
  - WebXR VR Gallery with React Three Fiber
  - 3D depth map viewer
  - Responsive fallback for non-VR browsers
  - API integration with backend

For VR gallery documentation, see [services/frontend/VR_GALLERY.md](services/frontend/VR_GALLERY.md).

## License

MIT License - see [LICENSE](LICENSE) for details.
