/**
 * ViewerPositionPanel.jsx
 * 
 * VR-native panel for adjusting GaussianSplatViewer/ViewerItem position, scale, and rotation.
 * Uses @react-three/uikit for VR-compatible UI.
 */
import React from 'react';
import { Root, Container, Text } from '@react-three/uikit';

const COLORS = {
  bg: '#000000',
  bgOpacity: 0.7,
  textMain: '#FFFFFF',
  textMuted: '#9CA3AF',
  primary: '#3B82F6',
  surface: '#1F2937',
  surfaceHighlight: '#374151',
};

// Reusable button component
const UiButton = ({ text, onClick, width = 44, height = 40, disabled = false }) => (
  <Container
    width={width}
    height={height}
    backgroundColor={disabled ? '#4B5563' : COLORS.surface}
    hover={disabled ? {} : { backgroundColor: '#9CA3AF' }}
    active={disabled ? {} : { backgroundColor: '#1F2937' }}
    alignItems="center"
    justifyContent="center"
    cursor={disabled ? 'default' : 'pointer'}
    borderRadius={6}
    onClick={disabled ? undefined : onClick}
  >
    <Text color={disabled ? '#6B7280' : 'white'} fontSize={20}>{text}</Text>
  </Container>
);

// Labeled stepper for position/scale values
const LabeledStepper = ({ label, value, min, max, step, onChange, formatValue, unit = '' }) => (
  <Container flexDirection="column" gap={6} width="100%" flexShrink={0}>
    <Text fontSize={18} color="#E5E7EB">{label}</Text>
    <Container flexDirection="row" alignItems="center" gap={8} width="100%">
      <UiButton text="-" onClick={() => onChange(Math.max(min, value - step))} />
      
      <Container 
        flexGrow={1} 
        height={40} 
        backgroundColor="#111827" 
        alignItems="center" 
        justifyContent="center"
        borderRadius={6}
      >
        <Text color="#F3F4F6" fontSize={18}>
          {formatValue ? formatValue(value) : `${value}${unit}`}
        </Text>
      </Container>

      <UiButton text="+" onClick={() => onChange(Math.min(max, value + step))} />
    </Container>
  </Container>
);

/**
 * ViewerPositionPanel - Adjustable position controls for 3D viewer
 * 
 * @param {object} transform - Current transform: { positionX, positionY, positionZ, scale, rotationY }
 * @param {function} onTransformChange - Callback to update transform
 * @param {array} position - [x, y, z] position of the panel in 3D space
 */
function ViewerPositionPanel({ transform, onTransformChange, position = [-1.7, 1.6, -3] }) {
  const defaults = {
    positionX: 0,
    positionY: 1.5,
    positionZ: 0,
    scale: 0.1,
    rotationY: 0,
  };

  const handleReset = () => {
    onTransformChange(defaults);
  };

  const updateValue = (key, value) => {
    onTransformChange({ ...transform, [key]: value });
  };

  return (
    <group position={position}>
      <Root pixelSize={0.005}>
        <Container
          width={280}
          height={420}
          backgroundColor={COLORS.bg}
          backgroundOpacity={COLORS.bgOpacity}
          flexDirection="column"
          borderRadius={24}
          padding={20}
          gap={12}
        >
          {/* Header */}
          <Container flexDirection="row" alignItems="center" gap={8} marginBottom={8}>
            <Text fontSize={22} color={COLORS.textMain}>🎯 Position</Text>
          </Container>

          {/* Position X */}
          <LabeledStepper
            label="Position X"
            value={transform.positionX}
            min={-5}
            max={5}
            step={0.1}
            onChange={(v) => updateValue('positionX', v)}
            formatValue={(v) => `${v.toFixed(1)}m`}
          />

          {/* Position Y */}
          <LabeledStepper
            label="Position Y"
            value={transform.positionY}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => updateValue('positionY', v)}
            formatValue={(v) => `${v.toFixed(1)}m`}
          />

          {/* Position Z */}
          <LabeledStepper
            label="Position Z"
            value={transform.positionZ}
            min={-5}
            max={5}
            step={0.1}
            onChange={(v) => updateValue('positionZ', v)}
            formatValue={(v) => `${v.toFixed(1)}m`}
          />

          {/* Scale */}
          <LabeledStepper
            label="Scale"
            value={transform.scale}
            min={0.01}
            max={2.0}
            step={0.05}
            onChange={(v) => updateValue('scale', v)}
            formatValue={(v) => v.toFixed(2)}
          />

          {/* Rotation Y */}
          <LabeledStepper
            label="Rotation"
            value={transform.rotationY}
            min={-180}
            max={180}
            step={15}
            onChange={(v) => updateValue('rotationY', v)}
            formatValue={(v) => `${v}°`}
          />

          {/* Reset Button */}
          <Container marginTop={8}>
            <Container
              width="100%"
              height={44}
              backgroundColor={COLORS.surfaceHighlight}
              hover={{ backgroundColor: COLORS.primary }}
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              borderRadius={8}
              onClick={handleReset}
            >
              <Text color="white" fontSize={18}>Reset Defaults</Text>
            </Container>
          </Container>
        </Container>
      </Root>
    </group>
  );
}

export default ViewerPositionPanel;
