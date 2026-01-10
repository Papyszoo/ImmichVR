import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * TimelineGallery - Immich-style timeline photo gallery
 * Features: date grouping, aspect ratios, lazy loading, timeline scrubber
 */
function TimelineGallery({ photos = [], onSelectPhoto }) {
  const containerRef = useRef(null);
  const [visiblePhotos, setVisiblePhotos] = useState(new Set());
  
  // Group photos by date
  const groupedPhotos = useMemo(() => {
    const groups = {};
    
    photos.forEach(photo => {
      // Get date from photo metadata
      const dateStr = photo.fileCreatedAt || photo.localDateTime || photo.createdAt;
      const date = dateStr ? new Date(dateStr) : new Date();
      const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      if (!groups[key]) {
        groups[key] = {
          label: key,
          date: date,
          photos: []
        };
      }
      groups[key].photos.push(photo);
    });
    
    // Sort groups by date (newest first)
    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [photos]);

  // Get unique years for timeline scrubber
  const years = useMemo(() => {
    const yearSet = new Set();
    groupedPhotos.forEach(group => {
      yearSet.add(group.date.getFullYear());
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [groupedPhotos]);

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const photoId = entry.target.dataset.photoId;
          if (entry.isIntersecting) {
            setVisiblePhotos(prev => new Set([...prev, photoId]));
          }
        });
      },
      { rootMargin: '200px' }
    );

    const items = containerRef.current?.querySelectorAll('[data-photo-id]');
    items?.forEach(item => observer.observe(item));

    return () => observer.disconnect();
  }, [groupedPhotos]);

  // Scroll to year
  const scrollToYear = (year) => {
    const element = document.getElementById(`year-${year}`);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  // Calculate thumbnail dimensions (same height, variable width)
  const getThumbStyle = (photo) => {
    const height = 150;
    const width = photo.exifInfo?.exifImageWidth && photo.exifInfo?.exifImageHeight
      ? Math.round((photo.exifInfo.exifImageWidth / photo.exifInfo.exifImageHeight) * height)
      : height; // Default to square if no dimensions
    
    return { width: `${Math.max(100, Math.min(300, width))}px`, height: `${height}px` };
  };

  if (photos.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No photos available</p>
        <p style={styles.emptySubtext}>Connect to Immich to view your photos</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Main scrollable area */}
      <div ref={containerRef} style={styles.content}>
        {groupedPhotos.map((group, groupIndex) => (
          <div key={group.label} id={groupIndex === 0 || group.date.getMonth() === 0 ? `year-${group.date.getFullYear()}` : undefined}>
            {/* Date header */}
            <div style={styles.dateHeader}>{group.label}</div>
            
            {/* Photo grid */}
            <div style={styles.photoGrid}>
              {group.photos.map(photo => (
                <div
                  key={photo.id}
                  data-photo-id={photo.id}
                  style={{ ...styles.photoItem, ...getThumbStyle(photo) }}
                  onClick={() => onSelectPhoto?.(photo)}
                >
                  {visiblePhotos.has(photo.id) && photo.thumbnailUrl ? (
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.originalFilename || ''}
                      style={styles.thumbnail}
                      loading="lazy"
                    />
                  ) : (
                    <div style={styles.placeholder} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline scrubber */}
      <div style={styles.timeline}>
        {years.map(year => (
          <button
            key={year}
            style={styles.yearButton}
            onClick={() => scrollToYear(year)}
          >
            {year}
          </button>
        ))}
      </div>

      {/* VR Button */}
      <button style={styles.vrButton} onClick={() => window.xrStore?.enterVR()}>
        🥽 Enter VR
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    paddingRight: '60px',
  },
  dateHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#888888',
    padding: '20px 0 10px 0',
    position: 'sticky',
    top: 0,
    backgroundColor: '#0a0a0a',
    zIndex: 10,
  },
  photoGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'flex-start',
  },
  photoItem: {
    cursor: 'pointer',
    borderRadius: '4px',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  timeline: {
    position: 'fixed',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 100,
  },
  yearButton: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#888888',
    fontSize: '11px',
    padding: '6px 10px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  vrButton: {
    position: 'fixed',
    top: '16px',
    right: '60px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    zIndex: 100,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#666666',
    marginTop: '8px',
  },
};

export default TimelineGallery;
