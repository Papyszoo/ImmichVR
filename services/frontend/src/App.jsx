import React, { useState, useEffect } from 'react';
import TimelineGallery from './components/TimelineGallery';
import VRGallery from './components/VRGallery';
import { getImmichPhotos, getImmichThumbnail } from './services/api';

function App() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' or 'viewer'

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getImmichPhotos();
      
      if (response.data && response.data.length > 0) {
        // Load thumbnails for all photos
        const photosWithThumbnails = await Promise.all(
          response.data.map(async (photo) => {
            try {
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
        
        setPhotos(photosWithThumbnails.filter(p => p.thumbnailUrl));
      }
    } catch (err) {
      console.error('Failed to load photos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhoto = (photo) => {
    setSelectedPhoto(photo);
    setViewMode('viewer');
  };

  const handleCloseViewer = () => {
    setSelectedPhoto(null);
    setViewMode('gallery');
  };

  const handleNextPhoto = () => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = (currentIndex + 1) % photos.length;
    setSelectedPhoto(photos[nextIndex]);
  };

  const handlePreviousPhoto = () => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setSelectedPhoto(photos[prevIndex]);
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
        <button onClick={loadPhotos} style={styles.retryButton}>Retry</button>
      </div>
    );
  }

  // VR Viewer mode
  if (viewMode === 'viewer' && selectedPhoto) {
    return (
      <VRGallery 
        media={[selectedPhoto]} 
        selectedMedia={selectedPhoto}
        onClose={handleCloseViewer}
        onNext={handleNextPhoto}
        onPrevious={handlePreviousPhoto}
      />
    );
  }

  // Timeline gallery mode
  return (
    <TimelineGallery 
      photos={photos} 
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
