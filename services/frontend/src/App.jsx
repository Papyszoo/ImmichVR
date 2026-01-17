import React, { useState, useEffect, useCallback, useRef } from 'react';
import VRThumbnailGallery from './components/VRThumbnailGallery';
import { getImmichPhotos, getImmichThumbnail } from './services/api';

const PAGE_SIZE = 100;

function App() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadedPhotoIds = useRef(new Set());

  useEffect(() => {
    loadPhotos(0);
  }, []);

  const loadPhotos = async (page) => {
    if (page === 0) {
      setLoading(true);
      setError(null);
      loadedPhotoIds.current.clear();
    } else {
      setLoadingMore(true);
    }
    
    try {
      const response = await getImmichPhotos(page, PAGE_SIZE);
      
      if (response.data && response.data.length > 0) {
        // Filter out already loaded photos
        const newPhotos = response.data.filter(p => !loadedPhotoIds.current.has(p.id));
        
        // Load thumbnails for new photos
        const photosWithThumbnails = await Promise.all(
          newPhotos.map(async (photo) => {
            try {
              loadedPhotoIds.current.add(photo.id);
              const thumbnailBlob = await getImmichThumbnail(photo.id);
              const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
              
              return {
                ...photo,
                thumbnailUrl,
                thumbnailBlob,
              };
            } catch (err) {
              console.error(`Failed to load thumbnail for ${photo.id}`);
              return { ...photo, thumbnailUrl: null };
            }
          })
        );
        
        const validPhotos = photosWithThumbnails.filter(p => p.thumbnailUrl);
        
        if (page === 0) {
          setPhotos(validPhotos);
        } else {
          setPhotos(prev => [...prev, ...validPhotos]);
        }
        
        // Check if there are more photos to load
        setHasMore(response.data.length === PAGE_SIZE);
        setCurrentPage(page);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load photos:', err);
      if (page === 0) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Load more photos when requested
  const loadMorePhotos = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadPhotos(currentPage + 1);
    }
  }, [loadingMore, hasMore, currentPage]);

  const handleSelectPhoto = (photo) => {
    setSelectedPhoto(photo);
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading photos...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.error}>
        <p>Error: {error}</p>
        <button onClick={() => loadPhotos(0)} style={styles.retryButton}>Retry</button>
      </div>
    );
  }

  // VR Gallery - the only view mode
  return (
    <VRThumbnailGallery
      photos={photos}
      initialSelectedId={selectedPhoto?.id}
      onSelectPhoto={handleSelectPhoto}
      onLoadMore={loadMorePhotos}
      hasMore={hasMore}
      loadingMore={loadingMore}
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
