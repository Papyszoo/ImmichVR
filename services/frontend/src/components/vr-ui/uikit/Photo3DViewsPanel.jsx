/**
 * Photo3DViewsPanel.jsx
 * 
 * Pure presentation component for displaying 3D view options.
 * Floating panel on the RIGHT side of a photo showing available 3D views.
 * 
 * Business logic is handled by usePhoto3DManager hook.
 * This component only renders the UI based on viewOptions prop.
 */
import React from 'react';
import { Root, Container, Text } from '@react-three/uikit';

const COLORS = {
  bg: '#000000',
  bgOpacity: 0.7,
  surface: '#1F2937',
  surfaceHighlight: '#374151',
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  textMain: '#FFFFFF',
  textMuted: '#9CA3AF',
};

// Text-based icons that render reliably in WebGL/Three.js
const ICONS = {
  generate: '+',
  remove: 'X',
  convert: '~',
  apply: '>',
};

/**
 * Icon button for actions
 */
const IconButton = ({ icon, onClick, color = '#FFFFFF', title = '' }) => (
  <Container
    width={32}
    height={32}
    backgroundColor={COLORS.surface}
    hover={{ backgroundColor: COLORS.surfaceHighlight }}
    alignItems="center"
    justifyContent="center"
    borderRadius={6}
    cursor="pointer"
    onClick={onClick}
  >
    <Text color={color} fontSize={18} fontWeight="bold">{icon}</Text>
  </Container>
);

/**
 * Single model row showing status and action
 * Now accepts a viewOption object with pre-computed status
 */
const ModelRow = ({ viewOption, isActive, onGenerate, onRemove, onConvert, onSelect }) => {
  const { key, name, params, status, canGenerate, canRemove, canConvert } = viewOption;
  
  // Determine visual state
  const isReady = status === 'ready';
  const isNotInstalled = status === 'not_installed';
  const isMissing = status === 'missing';
  
  // Click on the row to select this view (if ready)
  const handleRowClick = () => {
    if (isReady && onSelect) {
      onSelect(key);
    }
  };
  
  return (
    <Container
      width="100%"
      height={44}
      backgroundColor={isActive ? COLORS.primary : 'transparent'}
      hover={{ backgroundColor: isActive ? COLORS.primary : 'rgba(255,255,255,0.08)' }}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingX={12}
      borderRadius={8}
      cursor={isReady ? 'pointer' : 'default'}
      onClick={handleRowClick}
    >
      <Container flexDirection="row" alignItems="center" gap={8}>
        {/* Status indicator */}
        <Container
          width={10}
          height={10}
          borderRadius={5}
          backgroundColor={isReady ? COLORS.success : isMissing ? COLORS.warning : 'transparent'}
          borderWidth={isReady || isMissing ? 0 : 1}
          borderColor="#6B7280"
        />
        <Text color={COLORS.textMain} fontSize={15}>
          {name} {params && `(${params})`}
        </Text>
      </Container>
      
      {/* Action buttons based on status */}
      <Container flexDirection="row" gap={4}>
        {isNotInstalled ? (
          <Text color={COLORS.textMuted} fontSize={11}>Not installed</Text>
        ) : isReady ? (
          <>
            {/* Select button to apply this depth */}
            {!isActive && (
              <IconButton 
                icon={ICONS.apply} 
                onClick={(e) => { e.stopPropagation(); onSelect && onSelect(key); }} 
                color={COLORS.success}
                title="Apply this depth"
              />
            )}
            {/* Remove button */}
            <IconButton 
              icon={ICONS.remove} 
              onClick={(e) => { e.stopPropagation(); onRemove(key); }} 
              color={COLORS.danger}
              title="Remove"
            />
          </>
        ) : canConvert ? (
          <IconButton 
            icon={ICONS.convert} 
            onClick={(e) => { e.stopPropagation(); onConvert(key); }} 
            color={COLORS.warning}
            title="Convert"
          />
        ) : canGenerate ? (
          <IconButton 
            icon={ICONS.generate} 
            onClick={(e) => { e.stopPropagation(); onGenerate(key); }} 
            color={COLORS.primary}
            title="Generate"
          />
        ) : null}
      </Container>
    </Container>
  );
};

/**
 * Photo3DViewsPanel
 * 
 * Pure presentation component for displaying 3D view options.
 * All business logic is handled by the usePhoto3DManager hook.
 * 
 * Props:
 * - viewOptions: Array of view option objects from usePhoto3DManager
 * - activeModel: Currently viewing model key (optional)
 * - onGenerate: Callback when user clicks generate (modelKey) => void
 * - onRemove: Callback when user clicks remove (modelKey) => void
 * - onConvert: Callback when user clicks convert (modelKey) => void
 * - onSelect: Callback when user selects a view to apply (modelKey) => void
 * - position: [x, y, z] position for the panel (default: right of photo)
 */
function Photo3DViewsPanel({
  viewOptions = [],
  activeModel = null,
  onGenerate = () => {},
  onRemove = () => {},
  onConvert = () => {},
  onSelect = () => {},
  position = [1.5, 0, 0], // Right side of photo
}) {
  // Group options by type
  const depthOptions = viewOptions.filter(opt => opt.type === 'depth');
  const splatOptions = viewOptions.filter(opt => opt.type === 'splat');
  
  // Calculate dynamic height based on content
  // Each section header is 24px, each row is 44px, gaps, padding
  const baseHeight = 60; // Header + padding
  const sectionHeaderHeight = 28;
  const rowHeight = 48;
  const totalHeight = baseHeight 
    + (depthOptions.length > 0 ? sectionHeaderHeight + depthOptions.length * rowHeight : 0)
    + (splatOptions.length > 0 ? sectionHeaderHeight + splatOptions.length * rowHeight : 0);
  
  return (
    <group position={position}>
      <Root pixelSize={0.003}>
        <Container
          width={240}
          height={Math.max(200, totalHeight)}
          backgroundColor={COLORS.bg}
          backgroundOpacity={COLORS.bgOpacity}
          flexDirection="column"
          borderRadius={16}
          padding={16}
        >
          {/* Header */}
          <Text fontSize={18} color={COLORS.textMain} marginBottom={12}>
            3D Views
          </Text>
          
          {viewOptions.length === 0 ? (
            <Text color={COLORS.textMuted} fontSize={14}>Loading models...</Text>
          ) : (
            <Container flexDirection="column" gap={8} width="100%">
              {/* Depth Maps Section */}
              {depthOptions.length > 0 && (
                <Container flexDirection="column" gap={4} width="100%">
                  <Text fontSize={12} color={COLORS.textMuted} marginBottom={4}>
                    DEPTH MAPS
                  </Text>
                  {depthOptions.map((viewOption) => (
                    <ModelRow
                      key={viewOption.key}
                      viewOption={viewOption}
                      isActive={activeModel === viewOption.key}
                      onGenerate={onGenerate}
                      onRemove={onRemove}
                      onConvert={onConvert}
                      onSelect={onSelect}
                    />
                  ))}
                </Container>
              )}
              
              {/* Gaussian Splats Section */}
              {splatOptions.length > 0 && (
                <Container flexDirection="column" gap={4} width="100%">
                  <Text fontSize={12} color={COLORS.textMuted} marginBottom={4}>
                    GAUSSIAN SPLATS
                  </Text>
                  {splatOptions.map((viewOption) => (
                    <ModelRow
                      key={viewOption.key}
                      viewOption={viewOption}
                      isActive={activeModel === viewOption.key}
                      onGenerate={onGenerate}
                      onRemove={onRemove}
                      onConvert={onConvert}
                      onSelect={onSelect}
                    />
                  ))}
                </Container>
              )}
            </Container>
          )}
        </Container>
      </Root>
    </group>
  );
}

export default Photo3DViewsPanel;

