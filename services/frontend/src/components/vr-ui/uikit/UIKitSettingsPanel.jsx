import React, { useState, useEffect } from 'react';
import { Root, Container, Text } from '@react-three/uikit';

const COLORS = {
    bg: '#000000', // Pure Black backing
    bgOpacity: 0.7, // Semi-transparent glass
    
    textMain: '#FFFFFF',
    textMuted: '#9CA3AF', // Gray-400
    
    primary: '#3B82F6', // Blue-500
    primaryHover: '#60A5FA', // Blue-400
    
    surface: '#1F2937', // Gray-800
    surfaceOpacity: 0.6,
    
    surfaceHighlight: '#374151', // Gray-700
    
    danger: '#EF4444', 
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
      borderRadius={6}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
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
      borderRadius={6}
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
          borderRadius={6}
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
        borderRadius={16}
      >
        <Container width={24} height={24} backgroundColor="#FFFFFF" borderRadius={12} />
      </Container>
    </Container>
  );
};

const SidebarItem = ({ label, isActive, onClick, icon }) => {
  return (
    <Container
      width="100%"
      height={48}
      alignItems="center"
      flexDirection="row"
      paddingX={16}
      gap={12}
      backgroundColor={isActive ? "rgba(255, 255, 255, 0.1)" : "transparent"}
      hover={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
      onClick={onClick}
      borderRadius={12}
      cursor="pointer"
    >
      <Container width={4} height={24} backgroundColor={isActive ? COLORS.primary : "transparent"} borderRadius={2} />
      <Text 
        fontSize={18} 
        color={isActive ? "#FFFFFF" : "#9CA3AF"}
        fontWeight={isActive ? "bold" : "normal"}
      >
        {label}
      </Text>
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
       {/* Main Glass Panel */}
      <Root pixelSize={0.005}>
        <Container 
          width={700} // Wider for sidebar layout
          height={450} 
          backgroundColor={COLORS.bg}
          backgroundOpacity={COLORS.bgOpacity}
          flexDirection="row" // Horizontal layout
          borderRadius={32}
          padding={0} // Padding handled inside
          onClick={(e) => e.stopPropagation()}
        >
            {/* --- LEFT SIDEBAR --- */}
            <Container 
                width={200} 
                height="100%" 
                backgroundColor="rgba(0, 0, 0, 0.3)" 
                flexDirection="column"
                padding={24}
                gap={8}
            >
                <Text fontSize={24} color="#FFFFFF" marginBottom={24} marginLeft={12}>Settings</Text>
                
                <SidebarItem label="Layout" isActive={activeTab === 'layout'} onClick={() => setActiveTab('layout')} />
                <SidebarItem label="Depth" isActive={activeTab === 'depth'} onClick={() => setActiveTab('depth')} />
                <SidebarItem label="Controls" isActive={activeTab === 'controls'} onClick={() => setActiveTab('controls')} />
            </Container>

            {/* --- RIGHT CONTENT --- */}
            <Container 
                flexGrow={1} 
                height="100%" 
                flexDirection="column"
                padding={32}
            >
                {/* Header with Close */}
                <Container flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={24}>
                     <Text fontSize={24} color={COLORS.textMuted}>
                        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                     </Text>
                     <UiButton 
                        text="✕" 
                        onClick={onClose} 
                        width={44} 
                        height={44} 
                        borderRadius={22} // Circular
                        backgroundColor="rgba(255, 255, 255, 0.1)"
                        hover={{ backgroundColor: "#EF4444" }}
                     />
                </Container>

                {/* Scrollable Settings List */}
                <Container 
                    flexGrow={1} 
                    flexDirection="column" 
                    gap={24} 
                    overflow="scroll"
                    paddingRight={16} // Space for scrollbar
                >
                    {activeTab === 'layout' && (
                        <>
                           <LabeledStepper
                            label="Gallery Width"
                            value={settings.galleryWidth}
                            min={2}
                            max={25}
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
                            min={0.5}
                            max={15}
                            step={0.5}
                            onChange={(v) => updateSetting('wallDistance', v)}
                            formatValue={(v) => `${v.toFixed(1)}m`}
                          />
                           {/* Wall Curvature Disabled - Needs Fix
                           <LabeledStepper
                            label="Wall Curvature"
                            value={settings.wallCurvature}
                            min={0}
                            max={1}
                            step={0.1}
                            onChange={(v) => updateSetting('wallCurvature', v)}
                            formatValue={(v) => v === 0 ? 'Flat' : `${(v * 100).toFixed(0)}%`}
                          />
                          */}
                          <LabeledStepper
                            label="Spacing"
                            value={settings.gap}
                            min={0.02}
                            max={0.15}
                            step={0.01}
                            onChange={(v) => updateSetting('gap', v)}
                            formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                          />
                        </>
                    )}

                    {activeTab === 'depth' && (
                        <>
                           <LabeledToggle
                            label="Enable Depth in Grid"
                            checked={settings.enableGridDepth}
                            onChange={(v) => updateSetting('enableGridDepth', v)}
                          />
                          <LabeledStepper
                            label="Depth Intensity"
                            value={settings.depthScale}
                            min={0}
                            max={3.0}
                            step={0.1}
                            onChange={(v) => updateSetting('depthScale', v)}
                            formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                          />
                           <Container
                            backgroundColor={COLORS.surface}
                            padding={16}
                            width="100%"
                            borderRadius={12}
                          >
                            <Text fontSize={16} color={COLORS.textMuted} textAlign="center">
                               Model: M8 (High Quality)<br/>
                               Depth enhances 3D effect but costs performance.
                            </Text>
                          </Container>
                        </>
                    )}

                    {activeTab === 'controls' && (
                        <Container flexDirection="column" gap={16}>
                          <Text fontSize={20} color="#F9FAFB">VR Controller</Text>
                          <Text fontSize={18} color="#D1D5DB">• Thumbstick: Scroll</Text>
                          <Text fontSize={18} color="#D1D5DB">• A/X: Toggle Menu</Text>
                          <Text fontSize={18} color="#D1D5DB">• B/Y: Back / Close</Text>
                          
                          <Container height={1} backgroundColor="rgba(255,255,255,0.1)" marginY={8} />

                          <Text fontSize={20} color="#F9FAFB">Keyboard</Text>
                          <Text fontSize={18} color="#D1D5DB">• Arrows/WASD: Navigate</Text>
                          <Text fontSize={18} color="#D1D5DB">• Escape: Close</Text>
                        </Container>
                    )}
                </Container>
            </Container>
        </Container>
      </Root>
    </group>
  );
}

export default UIKitSettingsPanel;

