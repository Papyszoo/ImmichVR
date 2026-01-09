# Quick Start Guide - Depth Anything V2 API

## Starting the Service

### Using Docker Compose (Recommended)
```bash
cd /home/runner/work/ImmichVR/ImmichVR
docker compose up -d
```

### Check Service Health
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "ai",
  "model": "Depth-Anything-V2",
  "model_status": "loaded"
}
```

## API Usage Examples

### Example 1: cURL
```bash
# Generate depth map from an image
curl -X POST \
  -F "image=@/path/to/your/image.jpg" \
  http://localhost:5000/api/depth \
  --output depth_map.png

# The depth map will be saved as depth_map.png
```

### Example 2: Python
```python
import requests

# Generate depth map
with open('image.jpg', 'rb') as f:
    files = {'image': f}
    response = requests.post('http://localhost:5000/api/depth', files=files)

if response.status_code == 200:
    # Save the depth map
    with open('depth_map.png', 'wb') as f:
        f.write(response.content)
    print("Success! Depth map saved.")
else:
    print(f"Error: {response.json()}")
```

### Example 3: JavaScript/Node.js
```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function generateDepthMap(imagePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  
  const response = await fetch('http://localhost:5000/api/depth', {
    method: 'POST',
    body: form
  });
  
  if (response.ok) {
    const buffer = await response.buffer();
    fs.writeFileSync('depth_map.png', buffer);
    console.log('Depth map saved!');
  } else {
    const error = await response.json();
    console.error('Error:', error);
  }
}

// Usage
generateDepthMap('image.jpg');
```

### Example 4: Backend Integration
```javascript
// In ImmichVR backend (services/backend/index.js)
const FormData = require('form-data');
const fs = require('fs');

// Add this endpoint to the backend
app.post('/api/convert-depth', async (req, res) => {
  try {
    // Assuming file upload middleware is configured
    const imagePath = req.file.path;
    
    // Call AI service
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    
    const aiResponse = await fetch('http://ai:5000/api/depth', {
      method: 'POST',
      body: form
    });
    
    if (aiResponse.ok) {
      const depthMap = await aiResponse.buffer();
      res.contentType('image/png');
      res.send(depthMap);
    } else {
      const error = await aiResponse.json();
      res.status(500).json({ error: 'Depth generation failed', details: error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Testing

### Using the Test Script
```bash
cd services/ai
pip install requests pillow
python test_service.py http://localhost:5000
```

### Manual Testing
1. Start the service (wait 1-2 minutes for model download)
2. Check health endpoint
3. Send a test image to `/api/depth`
4. Verify the returned PNG is a valid depth map

## Troubleshooting

### Service Won't Start
- Check logs: `docker compose logs -f ai`
- Ensure port 5000 is not in use
- Verify internet connection (for model download)

### Model Loading Takes Too Long
- First startup downloads ~100MB model (normal)
- Subsequent starts use cached model (fast)
- Allow 120 seconds for initial startup

### Out of Memory
- Service requires ~2GB RAM minimum
- Reduce image resolution if processing large files
- Check Docker memory limits

### Depth Map Quality Issues
- Ensure input images are clear and well-lit
- Model performs best on natural scenes
- Very uniform surfaces may produce gray depth maps

## Next Steps

1. **Frontend Integration**: Add upload form to React frontend
2. **Database Storage**: Store depth maps in PostgreSQL
3. **Batch Processing**: Process multiple images sequentially
4. **Video Support**: Extract frames and process each

## Support

For detailed documentation, see:
- API Documentation: `services/ai/README.md`
- Implementation Details: `IMPLEMENTATION_SUMMARY.md`
- Docker Compose: `docker-compose.yml`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_SERVICE_PORT` | `5000` | Port the AI service listens on |

## Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service information |
| `/health` | GET | Health check and model status |
| `/api/depth` | POST | Generate depth map from image |

---

**Status**: ✅ Implementation Complete and Ready for Use
