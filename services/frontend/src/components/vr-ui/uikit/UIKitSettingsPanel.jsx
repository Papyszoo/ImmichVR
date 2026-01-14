import React, { useState, useEffect } from 'react';
import { Root, Container, Text } from '@react-three/uikit';

const COLORS = {
    bg: '#111827', // Gray-900 (Opaque)
    textMain: '#FFFFFF',
    textMuted: '#9CA3AF',
    primary: '#3B82F6', 
    surface: '#374151', // Gray-700
    surfaceHighlight: '#4B5563', // Gray-600
};

// --- Components ---

const UiButton = ({ text, onClick, active = false, width, height = 40, backgroundColor, ...props }) => {
  return (
    <Container
      width={width}
      height={height}
      backgroundColor={backgroundColor || (active ? "#6B7280" : COLORS.surface)} 
      hover={{ backgroundColor: "#9CA3AF" }} 
      active={{ backgroundColor: "#1F2937" }} 
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      // Removed borderRadius for safety
      onClick={onClick}
      {...props}
    >
      <Text color="white" fontSize={20}>{text}</Text>
    </Container>
  );
};

const TabButton = ({ id, label, isActive, onClick }) => {
  return (
    <Container
      flexGrow={1}
      height={44}
      alignItems="center"
      justifyContent="center"
      backgroundColor={isActive ? COLORS.surface : "transparent"} 
      hover={{ backgroundColor: isActive ? COLORS.surface : "#1F2937" }}
      onClick={() => onClick(id)}
      cursor="pointer"
      margin={4}
    >
      <Text 
        fontSize={20} 
        color={isActive ? "#FFFFFF" : "#9CA3AF"} 
      >
        {label}
      </Text>
    </Container>
  );
};

const LabeledStepper = ({ label, value, min, max, step, onChange, formatValue, unit = "" }) => {
  return (
    <Container flexDirection="column" gap={8} width="100%" flexShrink={0}>
      <Text fontSize={20} color="#E5E7EB">{label}</Text>
      <Container flexDirection="row" alignItems="center" gap={12} width="100%">
        <UiButton text="-" onClick={() => onChange(Math.max(min, value - step))} width={44} />
        
        <Container 
          flexGrow={1} 
          height={40} 
          backgroundColor="#111827" 
          alignItems="center" 
          justifyContent="center"
        >
          <Text color="#F3F4F6" fontSize={20}>
              {formatValue ? formatValue(value) : `${value}${unit}`}
          </Text>
        </Container>

        <UiButton text="+" onClick={() => onChange(Math.min(max, value + step))} width={44} />
      </Container>
    </Container>
  );
};

const LabeledToggle = ({ label, checked, onChange }) => {
  return (
    <Container flexDirection="row" justifyContent="space-between" alignItems="center" width="100%" flexShrink={0}>
      <Text fontSize={20} color="#E5E7EB">{label}</Text>
      <Container 
        width={56} 
        height={32} 
        backgroundColor={checked ? "#10B981" : "#4B5563"} 
        padding={4} 
        justifyContent={checked ? "flex-end" : "flex-start"}
        onClick={() => onChange(!checked)}
        cursor="pointer"
      >
        <Container width={24} height={24} backgroundColor="#FFFFFF" />
      </Container>
    </Container>
  );
};

function UIKitSettingsPanel({ isOpen, onClose, settings, onSettingsChange }) {
  const [activeTab, setActiveTab] = useState('layout');

  useEffect(() => {
    if (isOpen) console.log("Settings Panel Open - Rendering Main Panel");
  }, [isOpen]);

  if (!isOpen) return null;

  const updateSetting = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <group position={[0, 1.6, -2.0]}>
      {/* 
         CRITICAL FIX: 
         Root must remain transparent or unscaled to prevent "Red/Blue Screen" occlusion.
         All visible UI content is inside the child Container.
      */}
      <Root pixelSize={0.005}>
        <Container 
          width={500} // Increased slightly from 400 for better layout
          height={400} 
          backgroundColor={COLORS.bg}
          flexDirection="column"
          padding={32}
          gap={24}
          // Removed borderRadius for stability
        >
            {/* Header */}
            <Container
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              height={48}
              flexShrink={0}
            >
              <Text fontSize={28} color="#F9FAFB">Settings</Text>
              <UiButton 
                text="CLOSE" 
                onClick={onClose} 
                backgroundColor="#DC2626"
                width={80} 
                height={40} 
              />
            </Container>

            {/* Tabs */}
            <Container 
              flexDirection="row" 
              backgroundColor="#000000" 
              padding={4}
              height={52}
              width="100%"
              flexShrink={0}
            >
              <TabButton id="layout" label="LAYOUT" isActive={activeTab === 'layout'} onClick={setActiveTab} />
              <TabButton id="depth" label="DEPTH" isActive={activeTab === 'depth'} onClick={setActiveTab} />
              <TabButton id="controls" label="CONTROLS" isActive={activeTab === 'controls'} onClick={setActiveTab} />
            </Container>

            {/* Content Area */}
            <Container 
              flexGrow={1} 
              flexDirection="column" 
              width="100%" 
              gap={24}
              padding={8} 
              overflow="scroll" // Re-enabling scroll as it should be safe in Container
            >
              {activeTab === 'layout' && (
                <Container flexDirection="column" gap={24} width="100%">
                  <LabeledStepper
                    label="Gallery Width"
                    value={settings.galleryWidth}
                    min={4}
                    max={12}
                    step={0.5}
                    onChange={(v) => updateSetting('galleryWidth', v)}
                    formatValue={(v) => `${v.toFixed(1)}m`}
                  />
                  
                  <LabeledStepper
                    label="Thumbnail Size"
                    value={settings.thumbnailHeight}
                    min={0.3}
                    max={1.0}
                    step={0.05}
                    onChange={(v) => updateSetting('thumbnailHeight', v)}
                    formatValue={(v) => `${(v * 100).toFixed(0)}cm`}
                  />
                  
                  <LabeledStepper
                    label="Wall Distance"
                    value={settings.wallDistance}
                    min={2}
                    max={6}
                    step={0.5}
                    onChange={(v) => updateSetting('wallDistance', v)}
                    formatValue={(v) => `${v.toFixed(1)}m`}
                  />

                   <LabeledStepper
                    label="Wall Curvature"
                    value={settings.wallCurvature}
                    min={0}
                    max={1}
                    step={0.1}
                    onChange={(v) => updateSetting('wallCurvature', v)}
                    formatValue={(v) => v === 0 ? 'Flat' : `${(v * 100).toFixed(0)}%`}
                  />

                  <LabeledStepper
                    label="Spacing"
                    value={settings.gap}
                    min={0.02}
                    max={0.15}
                    step={0.01}
                    onChange={(v) => updateSetting('gap', v)}
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                </Container>
              )}

              {activeTab === 'depth' && (
                <Container flexDirection="column" gap={24} width="100%">
                  <LabeledToggle
                    label="Enable Depth in Grid"
                    checked={settings.enableGridDepth}
                    onChange={(v) => updateSetting('enableGridDepth', v)}
                  />
                  
                  <LabeledStepper
                    label="Depth Intensity"
                    value={settings.depthScale}
                    min={0}
                    max={0.4}
                    step={0.02}
                    onChange={(v) => updateSetting('depthScale', v)}
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                  />

                  <Container
                    backgroundColor="#374151"
                    padding={16}
                    width="100%"
                    marginTop={16}
                  >
                    <Text fontSize={20} color="#9CA3AF" textAlign="center">
                      Active Model: M8 (High Quality)
                    </Text>
                  </Container>
                </Container>
              )}

              {activeTab === 'controls' && (
                <Container flexDirection="column" gap={16} width="100%">
                  <Text fontSize={20} color="#F9FAFB">VR Controller</Text>
                  <Text fontSize={20} color="#D1D5DB">• Thumbstick: Scroll up/down</Text>
                  <Text fontSize={20} color="#D1D5DB">• Thumbstick L/R: Navigate photos</Text>
                  <Text fontSize={20} color="#D1D5DB">• A/X Button: Toggle menu</Text>
                  <Text fontSize={20} color="#D1D5DB">• B/Y Button: Close viewer</Text>
                  
                  <Text fontSize={20} color="#F9FAFB" marginTop={16}>Keyboard</Text>
                  <Text fontSize={20} color="#D1D5DB">• Arrow keys / WASD: Scroll</Text>
                  <Text fontSize={20} color="#D1D5DB">• Arrow L/R: Navigate photos</Text>
                  <Text fontSize={20} color="#D1D5DB">• Escape: Close viewer</Text>
                </Container>
              )}
            </Container>
        </Container>
      </Root>
    </group>
  );
}

export default UIKitSettingsPanel;

