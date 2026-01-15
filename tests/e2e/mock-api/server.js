const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 2283;

// Load sample photos data
let samplePhotos = [];
const dataPath = path.join(__dirname, 'data', 'sample-photos.json');
const thumbnailsPath = path.join(__dirname, 'data', 'thumbnails');

// Initialize sample data
async function loadSampleData() {
  try {
    const data = await fs.readFile(dataPath, 'utf8');
    samplePhotos = JSON.parse(data);
    console.log(`Loaded ${samplePhotos.length} sample photos`);
  } catch (error) {
    console.error('Error loading sample photos:', error);
    process.exit(1);
  }
}

// Middleware to validate API key
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== 'test-api-key') {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
  }
  next();
});

// Health check endpoint
app.get('/api/server/ping', (req, res) => {
  res.json({ res: 'pong' });
});

// Server version endpoint
app.get('/api/server/version', (req, res) => {
  res.json({
    major: 2,
    minor: 0,
    patch: 0,
    build: 'mock-e2e'
  });
});

// Get timeline buckets
app.get('/api/timeline/buckets', (req, res) => {
  // Group photos by month
  const buckets = {};
  
  samplePhotos.forEach(photo => {
    const date = new Date(photo.fileCreatedAt);
    const bucketKey = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    
    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { timeBucket: bucketKey, count: 0 };
    }
    buckets[bucketKey].count++;
  });
  
  const bucketArray = Object.values(buckets).sort((a, b) => 
    new Date(b.timeBucket) - new Date(a.timeBucket)
  );
  
  res.json(bucketArray);
});

// Get photos in a specific time bucket (columnar format)
app.get('/api/timeline/bucket', (req, res) => {
  const { timeBucket } = req.query;
  
  if (!timeBucket) {
    return res.status(400).json({ error: 'timeBucket parameter is required' });
  }
  
  // Filter photos for this bucket
  const bucketDate = new Date(timeBucket);
  const photosInBucket = samplePhotos.filter(photo => {
    const photoDate = new Date(photo.fileCreatedAt);
    return photoDate.getFullYear() === bucketDate.getFullYear() &&
           photoDate.getMonth() === bucketDate.getMonth();
  });
  
  // Convert to columnar format (Structure of Arrays)
  const columnarData = {
    id: [],
    isImage: [],
    type: [],
    originalFileName: [],
    fileCreatedAt: [],
    fileModifiedAt: [],
    localDateTime: [],
    exifInfo: []
  };
  
  photosInBucket.forEach(photo => {
    columnarData.id.push(photo.id);
    columnarData.isImage.push(photo.isImage);
    columnarData.type.push(photo.type);
    columnarData.originalFileName.push(photo.originalFileName);
    columnarData.fileCreatedAt.push(photo.fileCreatedAt);
    columnarData.fileModifiedAt.push(photo.fileModifiedAt);
    columnarData.localDateTime.push(photo.localDateTime);
    columnarData.exifInfo.push(photo.exifInfo);
  });
  
  res.json(columnarData);
});

// Get specific asset info
app.get('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  const photo = samplePhotos.find(p => p.id === id);
  
  if (!photo) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  res.json(photo);
});

// Get asset thumbnail
app.get('/api/assets/:id/thumbnail', async (req, res) => {
  const { id } = req.params;
  const photo = samplePhotos.find(p => p.id === id);
  
  if (!photo) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  // Map photo ID to thumbnail file
  const photoIndex = samplePhotos.indexOf(photo) + 1;
  const thumbnailFile = path.join(thumbnailsPath, `photo-${String(photoIndex).padStart(3, '0')}.jpg`);
  
  try {
    const imageBuffer = await fs.readFile(thumbnailFile);
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(imageBuffer);
  } catch (error) {
    console.error(`Error reading thumbnail ${thumbnailFile}:`, error);
    res.status(500).json({ error: 'Failed to read thumbnail' });
  }
});

// Search metadata endpoint (used by getAssets)
app.post('/api/search/metadata', express.json(), (req, res) => {
  const { size = 100, page = 1, isArchived = false } = req.body;
  
  // Filter out archived (we don't have any in mock data)
  let filteredPhotos = samplePhotos;
  
  // Apply pagination
  const startIndex = (page - 1) * size;
  const endIndex = startIndex + size;
  const paginatedPhotos = filteredPhotos.slice(startIndex, endIndex);
  
  res.json({
    assets: {
      items: paginatedPhotos,
      total: filteredPhotos.length,
      count: paginatedPhotos.length
    }
  });
});

// Search statistics endpoint
app.post('/api/search/statistics', express.json(), (req, res) => {
  res.json({
    images: samplePhotos.length,
    videos: 0,
    total: samplePhotos.length
  });
});

// Start server
async function start() {
  await loadSampleData();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mock Immich API server running on port ${PORT}`);
    console.log(`Serving ${samplePhotos.length} sample photos`);
  });
}

start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
