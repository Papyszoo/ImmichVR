import React, { useState, useEffect, useCallback, useRef } from 'react';
import VRThumbnailGallery from './components/VRThumbnailGallery';
import { getImmichPhotos, getImmichThumbnail, getImmichTimeline, getImmichBucket } from './services/api';

const PAGE_SIZE = 100;

function App() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // Timeline state
  const [timeline, setTimeline] = useState([]);
  const [photoCache, setPhotoCache] = useState({});
  const loadingBucketIds = useRef(new Set());

  useEffect(() => {
    loadTimeline();
  }, []);

  const loadTimeline = async () => {
    try {
      const response = await getImmichTimeline();
      if (response.data) {
        setTimeline(response.data);
      }
    } catch (err) {
      console.warn('Failed to load timeline:', err);
      setError('Failed to load timeline. Please check connection.');
      setLoading(false);
    } finally {
      setLoading(false); 
    }
  };

  // Load photos for a specific bucket (Virtualized Scroll Data Fetcher)
  const handleLoadBucket = useCallback(async (bucketId) => {
    // If already loaded or loading, skip
    if (photoCache[bucketId] || loadingBucketIds.current.has(bucketId)) return;
    
    // Mark as loading to prevent duplicate fetching
    loadingBucketIds.current.add(bucketId);
    console.log(`Loading bucket: ${bucketId}`);
    
    try {
      const response = await getImmichBucket(bucketId);
      if (response.data) {
        // Process thumbnails if needed, but for now we might just want metadata 
        // and lazy load thumbnails in the grid? 
        // For performance, let's just save the data. VRThumbnailGallery will handle thumbnail fetching/blobs?
        // Actually, existing logic fetched blobs immediately. 
        // With virtualization, we might get 1000s of items. We should probably NOT fetch 1000 blobs at once.
        // Let's stick to metadata first. The Grid can fetch thumbnails for visible items?
        // OR: We fetch small batch of thumbnails?
        // Given existing architecture uses blob URLs, let's cache metadata first.
        // We will adapt VRThumbnailGallery to load textures on demand or use a lighter approach.
        // For now, simple storage.
        
        setPhotoCache(prev => ({
          ...prev,
          [bucketId]: response.data
        }));
      }
    } catch (err) {
      console.error(`Failed to load bucket ${bucketId}:`, err);
    } finally {
      loadingBucketIds.current.delete(bucketId);
    }
  }, [photoCache]);

  const handleSelectPhoto = (photo) => {
    setSelectedPhoto(photo);
  };

  // Loading state (initial timeline fetch)
  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading library...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.error}>
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()} style={styles.retryButton}>Retry</button>
      </div>
    );
  }

  // VR Gallery - Virtualized
  return (
    <VRThumbnailGallery
      timeline={timeline}
      photoCache={photoCache}
      onLoadBucket={handleLoadBucket}
      initialSelectedId={selectedPhoto?.id}
      onSelectPhoto={handleSelectPhoto}
    />
  );
}

const styles = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #333',
    borderTop: '3px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#888888',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
  },
  retryButton: {
    marginTop: '16px',
    padding: '8px 16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default App;
