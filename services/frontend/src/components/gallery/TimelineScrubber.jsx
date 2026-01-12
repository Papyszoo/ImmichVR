import React from 'react';

const styles = {
  timeline: {
    position: 'absolute',
    right: '20px',
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
};

/**
 * TimelineScrubber - Year buttons for quick navigation (HTML overlay)
 */
function TimelineScrubber({ groupPositions, onScrollToYear, years }) {
  if (!years || years.length === 0) return null;
  
  return (
    <div style={styles.timeline}>
      {years.map(year => (
        <button
          key={year}
          style={styles.yearButton}
          onClick={() => onScrollToYear(year)}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

export default TimelineScrubber;
