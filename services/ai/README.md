# ImmichVR AI Service - Depth Anything V2

This microservice provides depth map generation using the Depth Anything V2 models from Hugging Face.

## Features

- **Multi-Model Support**: Choose between Small, Base, and Large model variants
- **Depth Map Generation**: Convert 2D images to depth maps using state-of-the-art AI
- **REST API**: Simple HTTP API for easy integration
- **Dockerized**: Fully containerized for easy deployment
- **Health Checks**: Built-in health monitoring endpoint

## Model Information

| Model | Parameters | Memory | Speed | Use Case |
|-------|------------|--------|-------|----------|
| **Small** | 25M | ~100MB | Fastest | Previews, low-memory systems |
| **Base** | 97M | ~400MB | Balanced | General use |
| **Large** | 335M | ~1.3GB | Best quality | Maximum detail (hair, fences) |

- **Source**: Hugging Face Transformers
- **Default**: Small (configurable via `DEPTH_MODEL` env var)


## API Endpoints

### 1. Health Check

**Endpoint**: `GET /health`

Check the service health and model status.

**Response**:
```json
{
  "status": "healthy",
  "service": "ai",
  "model": "Depth-Anything-V2",
  "model_status": "loaded"
}
```

**Status Codes**:
- `200`: Service is healthy

---

### 2. Root Information

**Endpoint**: `GET /`

Get service information and available endpoints.

**Response**:
```json
{
  "message": "ImmichVR AI Service",
  "version": "1.0.0",
  "model": "Depth Anything V2",
  "endpoints": {
    "health": "/health",
    "process_depth": "/api/depth (POST)"
  }
}
```

---

### 3. Generate Depth Map

**Endpoint**: `POST /api/depth`

Process an image and generate its depth map.

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Image file with key `image`

**Supported Image Formats**:
- JPEG (.jpg, .jpeg)
- PNG (.png)
- BMP (.bmp)
- TIFF (.tiff)

**Example using cURL**:
```bash
curl -X POST \
  -F "image=@/path/to/your/image.jpg" \
  http://localhost:5000/api/depth \
  --output depth_map.png
```

**Example using Python**:
```python
import requests

url = "http://localhost:5000/api/depth"
files = {"image": open("image.jpg", "rb")}
response = requests.post(url, files=files)

if response.status_code == 200:
    with open("depth_map.png", "wb") as f:
        f.write(response.content)
    print("Depth map saved successfully!")
else:
    print(f"Error: {response.json()}")
```

**Example using JavaScript**:
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);

fetch('http://localhost:5000/api/depth', {
  method: 'POST',
  body: formData
})
.then(response => response.blob())
.then(blob => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'depth_map.png';
  a.click();
});
```

**Response**:
- Success: PNG image (depth map)
- Content-Type: `image/png`
- Content-Disposition: `attachment; filename="depth_<original_name>.png"`

**Error Responses**:

*400 Bad Request*:
```json
{
  "error": "No image provided",
  "message": "Please upload an image file with key 'image'"
}
```

*503 Service Unavailable*:
```json
{
  "error": "Model not initialized",
  "message": "Depth estimation model is not available"
}
```

*500 Internal Server Error*:
```json
{
  "error": "Processing failed",
  "message": "Error details..."
}
```

## Docker Usage

### Building the Image

```bash
cd services/ai
docker build -t immichvr-ai .
```

### Running the Container

```bash
docker run -p 5000:5000 immichvr-ai
```

### With Docker Compose

The service is configured in the main `docker-compose.yml`:

```bash
# Start all services
docker compose up -d

# Start only AI service
docker compose up -d ai

# View logs
docker compose logs -f ai
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_SERVICE_PORT` | `5000` | Port the service listens on |

## Performance Considerations

- **First Request**: The initial request may take longer as the model needs to be loaded into memory
- **Model Size**: ~100MB download on first run
- **Memory**: Requires ~2GB RAM for the small model
- **GPU Support**: Automatically uses GPU if available (CUDA)
- **Timeout**: API requests timeout after 300 seconds

## Development

### Local Setup

```bash
cd services/ai

# Install dependencies
pip install -r requirements.txt

# Run development server
python main.py
```

### Testing the Service

```bash
# Health check
curl http://localhost:5000/health

# Process an image
curl -X POST \
  -F "image=@test_image.jpg" \
  http://localhost:5000/api/depth \
  --output depth_result.png
```

## Troubleshooting

### Model Not Loading

If the model fails to load:
1. Check internet connectivity (model downloads from Hugging Face)
2. Verify sufficient disk space (~500MB)
3. Check logs: `docker compose logs ai`

### Out of Memory

If processing fails due to memory:
1. Increase Docker memory allocation
2. Use smaller input images
3. Reduce worker count in gunicorn configuration

### Slow Processing

For faster processing:
1. Use GPU-enabled Docker image (requires NVIDIA Docker)
2. Reduce input image resolution
3. Use the small model variant (default)

## License

MIT License - see main repository LICENSE for details.
