# Immich Connector

The Immich Connector module provides a secure and reliable connection to a local Immich instance for fetching photos and videos metadata and files for depth processing.

## Features

- **Secure API Key Authentication**: Uses Immich's API key authentication mechanism
- **Media Metadata Retrieval**: Fetch comprehensive metadata for photos and videos
- **File Downloads**: Retrieve both thumbnails and full-resolution files
- **Error Handling**: Comprehensive error handling for connection failures and API errors
- **Environment Configuration**: Configure via environment variables
- **Pagination Support**: Handle large media libraries with pagination
- **Search Functionality**: Search assets by metadata
- **Memory Efficient Streaming**: Stream large files without loading them entirely into memory

## Configuration

Set the following environment variables:

```bash
IMMICH_URL=http://your-immich-instance:2283
IMMICH_API_KEY=your-api-key-here
```

Or configure programmatically:

```javascript
const ImmichConnector = require('./immichConnector');

const connector = new ImmichConnector({
  url: 'http://your-immich-instance:2283',
  apiKey: 'your-api-key-here'
});
```

## Usage

### Basic Connection Test

```javascript
// Test connection to Immich
const result = await connector.testConnection();
console.log('Connection successful:', result);

// Get server version
const version = await connector.getServerVersion();
console.log('Server version:', version);
```

### Fetching Assets

```javascript
// Get all assets with pagination
const assets = await connector.getAssets({
  size: 100,  // Number of items per page
  page: 0,    // Page number
  isArchived: false,  // Exclude archived items
});

// Get only photos
const photos = await connector.getPhotos({ size: 50 });

// Get only videos
const videos = await connector.getVideos({ size: 50 });

// Get specific asset details
const assetInfo = await connector.getAssetInfo('asset-id-here');
```

### Downloading Files

```javascript
// Get thumbnail (returns Buffer)
const thumbnail = await connector.getThumbnail('asset-id', {
  format: 'JPEG',  // or 'WEBP'
  size: 'preview'  // or 'thumbnail'
});

// Get full-resolution file (returns Buffer)
const file = await connector.getFullResolutionFile('asset-id');

// Stream full-resolution file (memory efficient for large files)
const stream = await connector.streamFullResolutionFile('asset-id');
stream.pipe(fs.createWriteStream('output.jpg'));
```

### Searching Assets

```javascript
// Search for assets
const results = await connector.searchAssets({
  query: 'vacation',
  type: 'ALL',  // or 'IMAGE', 'VIDEO'
  size: 100
});
```

### Statistics

```javascript
// Get asset statistics
const stats = await connector.getAssetStatistics();
console.log('Total assets:', stats.total);
```

## API Endpoints

The backend service exposes the following REST API endpoints:

### Connection & Info
- `GET /api/immich/test` - Test connection to Immich
- `GET /api/immich/version` - Get Immich server version
- `GET /api/immich/statistics` - Get asset statistics

### Assets
- `GET /api/immich/assets` - Get all assets (with pagination)
  - Query params: `size`, `page`, `isFavorite`, `isArchived`
- `GET /api/immich/photos` - Get all photos
  - Query params: `size`, `page`
- `GET /api/immich/videos` - Get all videos
  - Query params: `size`, `page`
- `GET /api/immich/assets/:assetId` - Get specific asset info
- `GET /api/immich/assets/:assetId/thumbnail` - Get asset thumbnail
  - Query params: `format` (JPEG/WEBP), `size` (preview/thumbnail)
- `GET /api/immich/assets/:assetId/file` - Download full-resolution file

### Search
- `POST /api/immich/search` - Search assets
  - Body: `{ query, type, size }`

## Error Handling

All methods throw descriptive errors that include:
- Connection failures (network issues, wrong URL)
- Authentication failures (invalid API key)
- API errors (resource not found, server errors)

Example:

```javascript
try {
  const assets = await connector.getAssets();
} catch (error) {
  console.error('Error fetching assets:', error.message);
  // Error messages are descriptive and actionable
}
```

## Testing

Run the test script to validate the connector:

```bash
cd services/backend
node test-immich-connector.js
```

## Requirements

- Node.js 18+
- axios ^1.6.0
- Access to an Immich instance with API key

## Security Considerations

- API keys are passed via headers (`x-api-key`)
- API keys should never be committed to version control
- Use environment variables for configuration in production
- The connector validates required configuration on initialization
- All requests have a 30-second timeout to prevent hanging connections

## Integration with ImmichVR

The Immich connector is automatically initialized in the backend service if `IMMICH_URL` and `IMMICH_API_KEY` are configured. If not configured, the backend will still run but Immich-related endpoints will return a 503 error with a configuration message.
