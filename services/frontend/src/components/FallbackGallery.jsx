import React, { useState } from 'react';

/**
 * FallbackGallery - 2D gallery view for non-VR browsers
 */
function FallbackGallery({ media = [], onSelectMedia }) {
  const [selectedMedia, setSelectedMedia] = useState(null);

  const handleSelectMedia = (item) => {
    setSelectedMedia(item);
    if (onSelectMedia) {
      onSelectMedia(item);
    }
  };

  const handleClose = () => {
    setSelectedMedia(null);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>ImmichVR Gallery</h1>
        <p style={styles.subtitle}>
          {media.length === 0 
            ? 'No media available. Upload or import media to get started.'
            : `Browse ${media.length} media items`
          }
        </p>
        <div style={styles.vrNote}>
          <span style={styles.vrIcon}>🥽</span>
          <span>For the full VR experience, use a WebXR-compatible browser and VR headset</span>
        </div>
      </header>

      {selectedMedia ? (
        <div style={styles.viewer}>
          <div style={styles.viewerHeader}>
            <h2 style={styles.viewerTitle}>
              {selectedMedia.original_filename || selectedMedia.originalFilename || 'Media Item'}
            </h2>
            <button style={styles.closeButton} onClick={handleClose}>
              ✕ Close
            </button>
          </div>
          <div style={styles.viewerContent}>
            {selectedMedia.thumbnailUrl && (
              <div style={styles.imageContainer}>
                <h3 style={styles.imageLabel}>Original</h3>
                <img 
                  src={selectedMedia.thumbnailUrl} 
                  alt="Original" 
                  style={styles.image}
                />
              </div>
            )}
            {selectedMedia.depthUrl && (
              <div style={styles.imageContainer}>
                <h3 style={styles.imageLabel}>Depth Map</h3>
                <img 
                  src={selectedMedia.depthUrl} 
                  alt="Depth Map" 
                  style={styles.image}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={styles.gallery}>
          {media.map((item, index) => (
            <div
              key={item.id || index}
              style={styles.thumbnail}
              onClick={() => handleSelectMedia(item)}
            >
              {item.thumbnailUrl ? (
                <img 
                  src={item.thumbnailUrl} 
                  alt={item.original_filename || item.originalFilename || 'Media'} 
                  style={styles.thumbnailImage}
                />
              ) : (
                <div style={styles.placeholderThumbnail}>
                  <span>📷</span>
                </div>
              )}
              <div style={styles.thumbnailLabel}>
                {item.original_filename || item.originalFilename || `Media ${index + 1}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    padding: '2rem',
    textAlign: 'center',
    borderBottom: '1px solid #333',
  },
  title: {
    fontSize: '2.5rem',
    margin: '0 0 0.5rem 0',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#aaaaaa',
    margin: '0 0 1rem 0',
  },
  vrNote: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: '#cccccc',
  },
  vrIcon: {
    fontSize: '1.5rem',
  },
  gallery: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1.5rem',
    padding: '2rem',
  },
  thumbnail: {
    cursor: 'pointer',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'transform 0.2s, box-shadow 0.2s',
    ':hover': {
      transform: 'scale(1.05)',
    },
  },
  thumbnailImage: {
    width: '100%',
    height: '200px',
    objectFit: 'cover',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333333',
    fontSize: '3rem',
  },
  thumbnailLabel: {
    padding: '0.75rem',
    fontSize: '0.9rem',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  viewer: {
    padding: '2rem',
  },
  viewerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #333',
  },
  viewerTitle: {
    margin: 0,
    fontSize: '1.5rem',
  },
  closeButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#ff3333',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  viewerContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
  },
  imageContainer: {
    textAlign: 'center',
  },
  imageLabel: {
    marginBottom: '1rem',
    fontSize: '1.2rem',
    color: '#aaaaaa',
  },
  image: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
};

export default FallbackGallery;
