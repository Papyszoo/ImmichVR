import React from 'react';
import { Html } from '@react-three/drei';

/**
 * VRSettingsPanel - 3D version of settings modal for VR
 * Displays in world-space and follows the user's view
 */
function VRSettingsPanel({ isOpen, onClose, settings, onSettingsChange }) {
  if (!isOpen) return null;
  
  const sliderStyle = { width: '100%', height: '8px', cursor: 'pointer' };
  const labelStyle = { display: 'block', marginBottom: '5px', fontSize: '14px', color: '#ccc' };
  const settingStyle = { marginBottom: '12px' };
  
  return (
    <Html
      position={[0, 1.5, -2.0]}
      scale={0.08}
      transform
      style={{
        width: '450px',
        userSelect: 'none',
        pointerEvents: 'auto'
      }}
    >
      <div style={{
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.2)',
        color: 'white',
        boxShadow: '0 0 30px rgba(0,0,0,0.7)',
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>VR Settings</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Depth Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ fontSize: '14px' }}>Enable 3D Depth Effect</label>
            <input 
              type="checkbox" 
              checked={settings.enableGridDepth}
              onChange={(e) => onSettingsChange({ ...settings, enableGridDepth: e.target.checked })}
              style={{ width: '24px', height: '24px', cursor: 'pointer' }}
            />
          </div>
          
          {/* Gallery Width */}
          <div style={settingStyle}>
            <label style={labelStyle}>Gallery Width: {settings.galleryWidth.toFixed(1)}m</label>
            <input 
              type="range" min="4" max="12" step="0.5"
              value={settings.galleryWidth}
              onChange={(e) => onSettingsChange({ ...settings, galleryWidth: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Distance Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Wall Distance: {settings.wallDistance.toFixed(1)}m</label>
            <input 
              type="range" min="2" max="6" step="0.5"
              value={settings.wallDistance}
              onChange={(e) => onSettingsChange({ ...settings, wallDistance: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>

          {/* Size Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Thumbnail Size: {(settings.thumbnailHeight * 100).toFixed(0)}cm</label>
            <input 
              type="range" min="0.3" max="1.0" step="0.05"
              value={settings.thumbnailHeight}
              onChange={(e) => onSettingsChange({ ...settings, thumbnailHeight: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Curve Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Wall Curvature: {settings.wallCurvature === 0 ? 'Flat' : `${(settings.wallCurvature * 100).toFixed(0)}%`}</label>
            <input 
              type="range" min="0" max="1" step="0.1"
              value={settings.wallCurvature}
              onChange={(e) => onSettingsChange({ ...settings, wallCurvature: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Depth Intensity */}
          <div style={settingStyle}>
            <label style={labelStyle}>Depth Intensity: {(settings.depthScale * 100).toFixed(0)}%</label>
            <input 
              type="range" min="0" max="0.2" step="0.01"
              value={settings.depthScale}
              onChange={(e) => onSettingsChange({ ...settings, depthScale: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Spacing Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Spacing: {(settings.gap * 100).toFixed(0)}%</label>
            <input 
              type="range" min="0.02" max="0.15" step="0.01"
              value={settings.gap}
              onChange={(e) => onSettingsChange({ ...settings, gap: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Instructions */}
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
            <strong>Controls:</strong><br/>
            • Thumbstick: Scroll up/down<br/>
            • A/X or B/Y button: Toggle this menu
          </div>
        </div>
      </div>
    </Html>
  );
}

export default VRSettingsPanel;
