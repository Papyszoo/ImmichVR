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
  textMain: '#FFFFFF',
  textMuted: '#9CA3AF',
};

// Model metadata passed via props

/**
 * Icon button for generate/remove actions
 */
const IconButton = ({ icon, onClick, color = '#FFFFFF' }) => (
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
    <Text color={color} fontSize={18}>{icon}</Text>
  </Container>
);

/**
 * Single model row showing status and action
 * Now accepts a viewOption object with pre-computed status
 */
const ModelRow = ({ viewOption, isActive, onGenerate, onRemove, onConvert }) => {
  const { key, name, params, status, canGenerate, canRemove, canConvert } = viewOption;
  
  // Determine visual state
  const isReady = status === 'ready';
  const isNotInstalled = status === 'not_installed';
  
  return (
    <Container
      width="100%"
      height={44}
      backgroundColor={isActive ? COLORS.primary : 'transparent'}
      hover={{ backgroundColor: isActive ? COLORS.primary : 'rgba(255,255,255,0.05)' }}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingX={12}
      borderRadius={8}
    >
      <Container flexDirection="row" alignItems="center" gap={8}>
        {/* Status indicator */}
        <Container
          width={8}
          height={8}
          borderRadius={4}
          backgroundColor={isReady ? COLORS.success : 'transparent'}
          borderWidth={isReady ? 0 : 1}
          borderColor="#6B7280"
        />
        <Text color={COLORS.textMain} fontSize={16}>
          {name} {params && `(${params})`}
        </Text>
      </Container>
      
      {/* Action button based on status */}
      {isNotInstalled ? (
        <Text color={COLORS.textMuted} fontSize={12}>Not installed</Text>
      ) : canRemove ? (
        <IconButton icon="🗑️" onClick={() => onRemove(key)} color="#EF4444" />
      ) : canConvert ? (
        <IconButton icon="🔄" onClick={() => onConvert(key)} color="#F59E0B" />
      ) : canGenerate ? (
        <IconButton icon="➕" onClick={() => onGenerate(key)} color={COLORS.primary} />
      ) : null}
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
 * - position: [x, y, z] position for the panel (default: right of photo)
 */
function Photo3DViewsPanel({
  viewOptions = [],
  activeModel = null,
  onGenerate = () => {},
  onRemove = () => {},
  onConvert = () => {},
  position = [1.5, 0, 0], // Right side of photo
}) {
  return (
    <group position={position}>
      <Root pixelSize={0.003}>
        <Container
          width={200}
          height={180}
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
          
          {/* Model list */}
          <Container flexDirection="column" gap={4} width="100%">
            {viewOptions.length > 0 ? (
                viewOptions.map((viewOption) => (
                  <ModelRow
                    key={viewOption.key}
                    viewOption={viewOption}
                    isActive={activeModel === viewOption.key}
                    onGenerate={onGenerate}
                    onRemove={onRemove}
                    onConvert={onConvert}
                  />
                ))
            ) : (
                <Text color={COLORS.textMuted} fontSize={14}>Loading models...</Text>
            )}
          </Container>
        </Container>
      </Root>
    </group>
  );
}

export default Photo3DViewsPanel;
