import React from 'react';

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: '16px',
    padding: '24px',
    minWidth: '320px',
    maxWidth: '400px',
    maxHeight: '80vh',
    overflowY: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#888888',
    cursor: 'pointer',
    padding: '0 8px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  setting: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#cccccc',
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: '#333333',
    outline: 'none',
    cursor: 'pointer',
    WebkitAppearance: 'none',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#666666',
  },
};

/**
 * SettingsModal - Modal with sliders for configuring gallery settings
 */
function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h3 style={modalStyles.title}>Gallery Settings</h3>
          <button style={modalStyles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div style={modalStyles.content}>
          {/* Gallery Width Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Gallery Width: {settings.galleryWidth.toFixed(1)}m
            </label>
            <input
              type="range"
              min="4"
              max="12"
              step="0.5"
              value={settings.galleryWidth}
              onChange={(e) => onSettingsChange({ ...settings, galleryWidth: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Narrow</span>
              <span>Wide</span>
            </div>
          </div>

          {/* Thumbnail Height Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Thumbnail Size: {(settings.thumbnailHeight * 100).toFixed(0)}cm
            </label>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={settings.thumbnailHeight}
              onChange={(e) => onSettingsChange({ ...settings, thumbnailHeight: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>

          {/* Wall Curvature Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Wall Curvature: {settings.wallCurvature === 0 ? 'Flat' : `${(settings.wallCurvature * 100).toFixed(0)}%`}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.wallCurvature}
              onChange={(e) => onSettingsChange({ ...settings, wallCurvature: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Flat</span>
              <span>Curved</span>
            </div>
          </div>

          {/* Depth Intensity Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Depth Intensity: {(settings.depthScale * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.02"
              value={settings.depthScale}
              onChange={(e) => onSettingsChange({ ...settings, depthScale: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Subtle</span>
              <span>Strong</span>
            </div>
          </div>

          {/* Spacing Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Spacing: {(settings.gap * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.02"
              max="0.15"
              step="0.01"
              value={settings.gap}
              onChange={(e) => onSettingsChange({ ...settings, gap: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Tight</span>
              <span>Loose</span>
            </div>
          </div>

          {/* Distance Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Distance: {settings.wallDistance.toFixed(1)}m
            </label>
            <input
              type="range"
              min="2"
              max="6"
              step="0.5"
              value={settings.wallDistance}
              onChange={(e) => onSettingsChange({ ...settings, wallDistance: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Close</span>
              <span>Far</span>
            </div>
          </div>
          
          {/* Grid Depth Toggle */}
          <div style={{ ...modalStyles.setting, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={modalStyles.label}>
              Enable Depth in Grid (Heavy)
            </label>
            <input
              type="checkbox"
              checked={settings.enableGridDepth}
              onChange={(e) => onSettingsChange({ ...settings, enableGridDepth: e.target.checked })}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
