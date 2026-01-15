# E2E Testing

This directory contains end-to-end tests for ImmichVR using Playwright.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

## Running Tests

### Start the E2E environment

```bash
docker-compose -f docker-compose.e2e.yml up -d
```

Wait for all services to be healthy (this may take a minute or two).

### Run the tests

```bash
npm test
```

### Other test commands

- Run tests in headed mode (see browser):
  ```bash
  npm run test:headed
  ```

- Run tests in UI mode (interactive):
  ```bash
  npm run test:ui
  ```

- Debug tests:
  ```bash
  npm run test:debug
  ```

- View HTML test report:
  ```bash
  npx playwright show-report
  ```

### Teardown

After testing, destroy the E2E environment and all volumes:

```bash
docker-compose -f docker-compose.e2e.yml down -v
```

docker-compose -f docker-compose.e2e.yml down -v
```

## Mock Immich API

The E2E environment includes a mock Immich API server that simulates a real Immich instance with sample photo data. This allows testing without requiring a live Immich installation.

### Mock API Features

- **10 Sample Photos**: Diverse collection with various subjects and orientations
- **Realistic Metadata**: Includes EXIF data, timestamps, camera info
- **Immich v2 API**: Implements timeline buckets (columnar format), asset info, thumbnails
- **Automatic Integration**: Backend automatically connects to mock API in E2E mode

### Sample Photos

The mock API includes 10 photos:
1. Mountain landscape (landscape, 3840x2160)
2. Beach sunset (landscape, 3840x2160)
3. City skyline (landscape, 3840x2160)
4. Forest path (portrait, 2160x3840)
5. Coffee cup (square, 2160x2160)
6. Vintage camera (square, 2160x2160)
7. Flower macro (portrait, 2160x3840)
8. Desert dunes (landscape, 3840x2160)
9. Waterfall (portrait, 2160x3840)
10. Street photography (landscape, 3840x2160)

Photos span different dates from April to December 2025 to test timeline functionality.

### Adding More Mock Photos

To add more photos to the mock API:

1. Add image files to `tests/e2e/mock-api/data/thumbnails/` (name as `photo-NNN.jpg`)
2. Add corresponding metadata to `tests/e2e/mock-api/data/sample-photos.json`
3. Rebuild the E2E environment: `docker-compose -f docker-compose.e2e.yml up -d --build`

## Notes

- The E2E environment runs on port **21371** (vs. production on 21370)
- All data is stored in ephemeral volumes (tmpfs) and will be destroyed on teardown
- The environment uses separate containers with the `immichvr-e2e-*` naming convention
