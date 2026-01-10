import React, { useState, useEffect } from 'react';
import VRGallery from './components/VRGallery';
import FallbackGallery from './components/FallbackGallery';
import { getMediaStatus, getMediaDepth, getMediaDepthInfo, getImmichPhotos, getImmichThumbnail, getImmichFile } from './services/api';

// Configuration constants
const MAX_ASSETS_TO_LOAD = 20;

function App() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useVR, setUseVR] = useState(false);

  useEffect(() => {
    // Check if WebXR is supported
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setUseVR(supported);
      }).catch(() => {
        setUseVR(false);
      });
    }

    // Load media from backend
    loadMedia();
    
    // Cleanup function to revoke object URLs
    return () => {
      media.forEach(item => {
        if (item.thumbnailUrl && item.thumbnailUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnailUrl);
        }
        if (item.depthUrl && item.depthUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.depthUrl);
        }
      });
    };
  }, []);

  const loadMedia = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to load from Immich first, then fall back to media status
      let mediaItems = [];
      
      try {
        // Attempt to fetch Immich photos
        const immichResponse = await getImmichPhotos();
        if (immichResponse.assets && immichResponse.assets.length > 0) {
          // Load thumbnails for Immich assets
          mediaItems = await Promise.all(
            immichResponse.assets.slice(0, MAX_ASSETS_TO_LOAD).map(async (asset) => {
              try {
                const thumbnailBlob = await getImmichThumbnail(asset.id);
                const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
                
                // Also try to load the original file for depth viewing
                let originalBlob = null;
                let originalUrl = null;
                try {
                  originalBlob = await getImmichFile(asset.id);
                  originalUrl = URL.createObjectURL(originalBlob);
                } catch (origErr) {
                  console.log(`Could not load original file for ${asset.id}, will use thumbnail`);
                }
                
                return {
                  id: asset.id,
                  originalFilename: asset.originalFileName,
                  thumbnailUrl,
                  thumbnailBlob,
                  originalUrl,
                  originalBlob,
                  type: asset.type,
                  isImmich: true,
                };
              } catch (err) {
                console.error(`Failed to load thumbnail for asset ${asset.id}:`, err);
                return null;
              }
            })
          );
          mediaItems = mediaItems.filter(item => item !== null);
        }
      } catch (immichError) {
        console.log('Immich not available, trying local media:', immichError.message);
      }

      // If no Immich media, try local uploaded media
      if (mediaItems.length === 0) {
        const statusResponse = await getMediaStatus();
        if (statusResponse.media && statusResponse.media.length > 0) {
          // Load depth maps for processed media
          mediaItems = await Promise.all(
            statusResponse.media
              .filter(item => item.status === 'completed')
              .slice(0, MAX_ASSETS_TO_LOAD)
              .map(async (item) => {
                try {
                  const depthBlob = await getMediaDepth(item.id);
                  const depthUrl = URL.createObjectURL(depthBlob);
                  
                  // Try to get depth info for metadata
                  let metadata = null;
                  try {
                    const depthInfo = await getMediaDepthInfo(item.id);
                    metadata = depthInfo;
                  } catch (metaErr) {
                    console.log(`No metadata available for ${item.id}`);
                  }
                  
                  return {
                    id: item.id,
                    originalFilename: item.original_filename,
                    depthUrl,
                    depthBlob,
                    status: item.status,
                    type: item.media_type,
                    metadata,
                    isImmich: false,
                  };
                } catch (err) {
                  console.error(`Failed to load depth for media ${item.id}:`, err);
                  // Return item without depth map
                  return {
                    id: item.id,
                    originalFilename: item.original_filename,
                    status: item.status,
                    type: item.media_type,
                    isImmich: false,
                  };
                }
              })
          );
        }
      }

      setMedia(mediaItems);
    } catch (err) {
      console.error('Failed to load media:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMedia = (mediaItem) => {
    console.log('Selected media:', mediaItem);
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p>Loading gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.error}>
        <h1>Error Loading Gallery</h1>
        <p>{error}</p>
        <button style={styles.retryButton} onClick={loadMedia}>
          Retry
        </button>
      </div>
    );
  }

  // Use VR gallery if WebXR is supported, otherwise use fallback
  return useVR ? (
    <VRGallery media={media} onSelectMedia={handleSelectMedia} />
  ) : (
    <FallbackGallery media={media} onSelectMedia={handleSelectMedia} />
  );
}

const styles = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #333',
    borderTop: '5px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    padding: '2rem',
  },
  retryButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
};

export default App;
