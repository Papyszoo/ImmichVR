/**
 * Photo3DViewsPanel.jsx
 * Floating panel on the RIGHT side of a photo showing available 3D views.
 * Displays list of depth models with generate/remove icons based on status.
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
 */
const ModelRow = ({ model, isGenerated, isActive, isDownloaded, onGenerate, onRemove }) => {
  
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
          backgroundColor={isGenerated ? COLORS.success : 'transparent'}
          borderWidth={isGenerated ? 0 : 1}
          borderColor="#6B7280"
        />
        <Text color={COLORS.textMain} fontSize={16}>
          {model.name} ({model.params})
        </Text>
      </Container>
      
      {/* Action button */}
      {isGenerated ? (
        <IconButton icon="🗑️" onClick={() => onRemove(model.key)} color="#EF4444" />
      ) : isDownloaded ? (
        <IconButton icon="➕" onClick={() => onGenerate(model.key)} color={COLORS.primary} />
      ) : (
        <Text color={COLORS.textMuted} fontSize={12}>Not installed</Text>
      )}
    </Container>
  );
};

/**
 * Photo3DViewsPanel
 * 
 * Props:
 * - photoId: Current photo ID
 * - generatedFiles: Array of { modelKey, id } for files already generated
 * - downloadedModels: Array of model keys that are downloaded
 * - activeModel: Currently viewing model key
 * - onGenerate: Callback when user clicks generate (modelKey) => void
 * - onRemove: Callback when user clicks remove (modelKey, fileId) => void
 * - position: [x, y, z] position for the panel (default: right of photo)
 */
function Photo3DViewsPanel({
  photoId,
  generatedFiles = [],
  downloadedModels = ['small'],
  models = [],
  activeModel = null,
  onGenerate = () => {},
  onRemove = () => {},
  position = [1.5, 0, 0], // Right side of photo
}) {
  // Create a set of generated model keys for quick lookup
  const generatedModels = new Set(generatedFiles.map(f => f.modelKey));
  
  // Find file ID for a given model (for removal)
  const getFileId = (modelKey) => {
    const file = generatedFiles.find(f => f.modelKey === modelKey);
    return file?.id;
  };
  
  const handleRemove = (modelKey) => {
    const fileId = getFileId(modelKey);
    if (fileId) {
      onRemove(modelKey, fileId);
    }
  };
  
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
            {models.length > 0 ? (
                models.map((model) => (
                  <ModelRow
                    key={model.key}
                    model={model}
                    isGenerated={generatedModels.has(model.key)}
                    isActive={activeModel === model.key}
                    isDownloaded={downloadedModels.includes(model.key)}
                    onGenerate={onGenerate}
                    onRemove={handleRemove}
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
