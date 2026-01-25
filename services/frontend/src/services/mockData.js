/**
 * Mock Data for Demo Mode
 * 
 * User Instructions:
 * Place your files in 'services/frontend/public/demo/' with the following names:
 * - Photo 1: demo_1.jpg (Image), demo_1.ply (Gaussian Splat)
 * - Photo 2: demo_2.jpg (Image), demo_2.ply (Gaussian Splat)
 * - Photo 3: demo_3.jpg (Image), demo_3.ply (Gaussian Splat)
 * 
 * You can add more by updating the generateMockPhotos function below.
 */

const BASE_ASSET_URL = 'https://github.com/Papyszoo/ImmichVR/releases/download/assets'; 
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const mockPhotos = [
  // Photos with 3D assets
  { id: '1', hasSplat: true },
  { id: '2', hasSplat: true },
  { id: '3', hasSplat: true },
  // Photos without 3D assets
  { id: '4', hasSplat: false },
  { id: '5', hasSplat: false }
].map(item => ({
    id: item.id,
    originalPath: `demo/${item.id}.jpg`, 
    // Use LOCAL assets for images to prevent CORS issues on GitHub Pages
    // These must be committed to the repo in services/frontend/public/demo/
    thumbPath: `${BASE_PATH}demo/${item.id}.jpg`, 
    thumbnailUrl: `${BASE_PATH}demo/${item.id}.jpg`,
    
    type: 'IMAGE',
    deviceId: 'DEMO_DEVICE',
    ownerId: 'DEMO_USER',
    originalFileName: `${item.id}.jpg`,
    fileCreatedAt: new Date().toISOString(),
    localDateTime: new Date().toISOString(),
    iso: 100,
    fNumber: 2.8,
    focalLength: 50,
    exifInfo: {
      make: 'Demo Camera',
      model: 'Virtual Lens',
      fps: 0,
    },
}));

/**
 * Mock processed assets map (Splats/Depths)
 * Maps assetId -> { splat: 'modelKey', ... }
 */
export const mockAssetMap = {};

// Populate asset map only for those that should have splats
mockPhotos.forEach(photo => {
  // Check our source config above (id 1-3 have splats)
  // We can infer this from the ID for simplicity or check the source array if we kept it accesssible.
  // Re-checking condition:
  const hasSplat = ['1', '2', '3'].includes(photo.id);
  
  if (hasSplat) {
    mockAssetMap[photo.id] = {
      splat: ['base'], // Simulate 'base' model generated
      depth: ['small'] // Simulate 'small' model generated
    };
  }
});

/**
 * Mock timeline buckets
 */
export const mockTimeline = [
  {
    _id: '2025-01-01',
    timeBucket: '2025-01-01T00:00:00.000Z', // Should be compliant with substring(0,4)
    // Actually typically expected format is ISO or '2025-01-01'
    // Let's match real API likely: '2025-01-01' or similar. 
    // Code uses substring(0, 4) for year.
    timeBucket: '2025-01-01', 
    count: mockPhotos.length,
    bucketDate: '2025-01-01T00:00:00.000Z',
  }
];

export const getMockPhotoUrl = (id) => {
    // Return external URL for release assets
    return `${BASE_ASSET_URL}/${id}.jpg`;
};

export const getMockSplatUrl = (id) => {
    return `${BASE_ASSET_URL}/${id}.ply`;
};
