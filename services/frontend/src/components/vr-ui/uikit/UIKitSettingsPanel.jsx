import React, { useState, useEffect } from 'react';
import { Root, Container, Text } from '@react-three/uikit';
import { getSettings, updateSettings, getModels, getAIModels, loadModel, unloadModel, markModelDownloaded, downloadModel } from '../../../services/api';
import { modelSocket } from '../../../services/socket';

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
    success: '#10B981',
};

// Model metadata is now fetched from the API

// --- Components ---

const UiButton = ({ text, onClick, active = false, width, height = 40, backgroundColor, disabled = false, ...props }) => {
  return (
    <Container
      width={width}
      height={height}
      backgroundColor={disabled ? '#4B5563' : (backgroundColor || (active ? "#6B7280" : COLORS.surface))} 
      hover={disabled ? {} : { backgroundColor: "#9CA3AF" }} 
      active={disabled ? {} : { backgroundColor: "#1F2937" }} 
      alignItems="center"
      justifyContent="center"
      cursor={disabled ? "default" : "pointer"}
      borderRadius={6}
      onClick={(e) => {
        if (onClick && !disabled) onClick(e);
      }}
      {...props}
    >
      <Text color={disabled ? "#6B7280" : "white"} fontSize={20}>{text}</Text>
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
  const [models, setModels] = useState([]);
  const [loadingModel, setLoadingModel] = useState(null);
  const [currentLoadedModel, setCurrentLoadedModel] = useState(null);
  const [activeDevice, setActiveDevice] = useState(null); // 'cpu', 'gpu'

  const fetchModels = async () => {
    try {
      // 1. Fetch source of truth from Database (includes metadata and download status)
      const dbData = await getModels();
      const dbModels = dbData.models || [];
      
      // 2. Fetch runtime status from AI Service (what's loaded in memory)
      let aiModelsData = { current_model: null, models: [] };
      try {
        aiModelsData = await getAIModels();
      } catch (e) {
        console.warn('Failed to fetch AI service status (service might be busy or starting):', e);
      }
      
      setCurrentLoadedModel(aiModelsData.current_model);
      if (aiModelsData.current_device) {
          // Normalize backend device to 'cpu' or 'gpu' (or 'auto' if unknown)
          // Backend sends 'cpu' or 'gpu'
          setActiveDevice(aiModelsData.current_device); 
      }
      
      // 3. Merge: Use DB models as base, overlay runtime info
      const mergedModels = dbModels.map(dbModel => {
        // Find corresponding runtime info if any
        const runtimeInfo = aiModelsData.models?.find(m => m.key === dbModel.key);
        
        return {
          ...dbModel,
          // DB status is primary for 'downloaded' vs 'not_downloaded'
          // API might return more granular 'downloading' state if we implemented it, 
          // but for now DB is reliable for persistence.
          
          // Helper flags
          is_loaded: runtimeInfo?.is_loaded ?? (aiModelsData.current_model === dbModel.key),
          // If AI service reports it as downloaded, trust that too (e.g. manual file placement)
          status: (runtimeInfo?.is_downloaded || dbModel.status === 'downloaded') ? 'downloaded' : 'not_downloaded'
        };
      });
      
      setModels(mergedModels);
      
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  };

  // --- TEST BRIDGE ---
  // Expose internal state and actions for Playwright E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__VR_UI_INTERNALS = {
        state: {
          activeTab,
          models,
          loadingModel,
          settings,
          isOpen
        },
        actions: {
          setActiveTab,
          downloadModel: handleDownloadModel,
          toggleModel: handleToggleModel,
          updateSetting,
        }
      };
    }
  }, [activeTab, models, loadingModel, settings, isOpen]);

  // Fetch settings and models when panel opens
  useEffect(() => {
    if (isOpen) {
      console.log("Settings Panel Open - Fetching data");
      
      // Fetch user settings from backend
      getSettings()
        .then(data => {
          onSettingsChange(prev => ({
            ...prev,
            defaultDepthModel: data.defaultDepthModel || 'small',
            autoGenerateOnEnter: data.autoGenerateOnEnter || false,
            disableAutoQuality: data.disableAutoQuality || false,
          }));
        })
        .catch(err => console.warn('Failed to fetch settings:', err));
      
      fetchModels();
    }
  }, [isOpen]);



  // Get installed models for dropdown filtering
  const installedModels = models.filter(m => m.status === 'downloaded');
    // Handle model activation (load into memory) with specific device
  const handleToggleModel = async (modelKey, device) => {
    // If currently loading anything, block
    if (loadingModel) return;

    // Check current status
    const model = models.find(m => m.key === modelKey);
    const isLoaded = model?.is_loaded;
    const currentDevice = activeDevice; // global state updated from fetchModels

    setLoadingModel(modelKey);
    
    if (isLoaded && currentDevice === device) {
        // Unload
        modelSocket.unload();
    } else {
        // Load
        modelSocket.load(modelKey, 'manual', { device });
    }
    // No finally{setLoadingModel(null)} here because socket event will clear it
  };

  const updateSetting = async (key, value) => {
    // Update local state immediately
    onSettingsChange({ ...settings, [key]: value });
    
    // Sync to backend
    try {
      // Map frontend keys to backend keys if they differ
      const payload = {};
      if (key === 'defaultDepthModel') payload.defaultDepthModel = value;
      else if (key === 'autoGenerateOnEnter') payload.autoGenerateOnEnter = value;
      else if (key === 'disableAutoQuality') payload.disableAutoQuality = value;
      
      if (Object.keys(payload).length > 0) {
          await updateSettings(payload);
      }
      
      // Logic for auto-loading is now handled lazily or via idle timeout on backend
      // We don't eagerly load anymore unless explicit 'Activate' button is clicked.

    } catch (err) {
      console.error('Failed to save setting:', err);
    }
  };

  // Listen for Socket.IO updates
  useEffect(() => {
    const handleStatus = (data) => {
        console.log('[SettingsPanel] Socket Update:', data);
        
        // Handle Download Status
        if (data.status === 'downloading') {
            setLoadingModel(data.modelKey);
        }
        else if (data.status === 'downloaded') {
            setLoadingModel(null);
            fetchModels();
        }
        else if (data.status === 'error') {
            setLoadingModel(null);
            console.error('[SettingsPanel] Model Error:', data.message);
        }
        
        // Handle Load/Unload Status
        else if (data.status === 'loading') {
            setLoadingModel(data.modelKey);
        }
        else if (data.status === 'loaded') {
            setLoadingModel(null);
            setCurrentLoadedModel(data.modelKey);
            fetchModels();
        }
        else if (data.status === 'unloaded') {
             setLoadingModel(null);
             setCurrentLoadedModel(null);
             fetchModels();
        }
    };

    const cleanup = modelSocket.onStatusChange(handleStatus);
    
    // Also listen for errors specifically if separate
    const cleanupError = modelSocket.onError((data) => {
        setLoadingModel(null);
        console.error('[SettingsPanel] Socket Error:', data);
    });

    return () => {
        cleanup();
        cleanupError();
    };
  }, []);

  // Handle model downloading via Socket.IO
  const handleDownloadModel = (modelKey) => {
    setLoadingModel(modelKey);
    // Fire and forget - status comes back via socket
    modelSocket.download(modelKey);
  };

  if (!isOpen) return null;

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
                <SidebarItem label="Models" isActive={activeTab === 'models'} onClick={() => setActiveTab('models')} />
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
                        text="X" 
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
                               Current Model: {settings.defaultDepthModel || 'Small'}
                            </Text>
                          </Container>

                          {/* Disable Auto Optimization */}
                          <LabeledToggle
                            label="Never automatically optimize quality"
                            checked={settings.disableAutoQuality || false}
                            onChange={(v) => updateSetting('disableAutoQuality', v)}
                          />
                        </>
                    )}

                  {activeTab === 'models' && (
                        <>
                          {/* Default Model Selection - Only installed models */}
                          <Container flexDirection="column" gap={8} width="100%" flexShrink={0}>
                            <Text fontSize={20} color="#E5E7EB">Default Depth Model</Text>
                            <Container flexDirection="row" gap={8}>
                              {installedModels.length > 0 ? (
                                installedModels.map((model) => (
                                  <Container
                                    key={model.key}
                                    flexGrow={1}
                                    height={40}
                                    backgroundColor={settings.defaultDepthModel === model.key ? COLORS.primary : COLORS.surface}
                                    hover={{ backgroundColor: settings.defaultDepthModel === model.key ? COLORS.primary : COLORS.surfaceHighlight }}
                                    alignItems="center"
                                    justifyContent="center"
                                    borderRadius={6}
                                    cursor="pointer"
                                    onClick={() => updateSetting('defaultDepthModel', model.key)}
                                  >
                                    <Text color="white" fontSize={18}>
                                      {model.name || model.key}
                                    </Text>
                                  </Container>
                                ))
                              ) : (
                                <Text color={COLORS.textMuted} fontSize={16}>No models installed</Text>
                              )}
                            </Container>
                          </Container>

                          {/* Model Cards - All models */}
                          <Container flexDirection="column" gap={12} width="100%" flexShrink={0}>
                            <Text fontSize={20} color="#E5E7EB">Available Models</Text>
                            
                              {models.map((model) => {
                                const isInstalled = model.status === 'downloaded';
                                const isLoading = loadingModel === model.key;
                                const isLoaded = model.is_loaded;
                                
                                // activeDevice is 'gpu' or 'cpu' (or null)
                                const isGpuActive = isLoaded && activeDevice === 'gpu';
                                const isCpuActive = isLoaded && activeDevice === 'cpu';

                                return (
                                  <Container
                                    key={model.key}
                                    backgroundColor={COLORS.surface}
                                    padding={16}
                                    borderRadius={12}
                                    flexDirection="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    flexShrink={0}
                                  >
                                    <Container flexDirection="column" gap={4}>
                                      <Text color="#FFFFFF" fontSize={18}>{model.name} ({model.params})</Text>
                                      <Text color="#9CA3AF" fontSize={14}>{model.memory} - {model.description || ''}</Text>
                                    </Container>
                                  
                                  {isInstalled ? (
                                    <Container flexDirection="row" gap={8} alignItems="center">
                                       <Text fontSize={14} color="#9CA3AF" marginRight={4}>Load On:</Text>
                                       
                                       {/* GPU Button */}
                                       <UiButton 
                                            text="GPU" 
                                            width={70} 
                                            height={32} 
                                            disabled={isLoading}
                                            backgroundColor={isGpuActive ? COLORS.primary : COLORS.surfaceHighlight}
                                            hover={{ backgroundColor: isGpuActive ? COLORS.primaryHover : "#4B5563" }}
                                            onClick={() => handleToggleModel(model.key, 'gpu')}
                                        />

                                        {/* CPU Button */}
                                        <UiButton 
                                            text="CPU" 
                                            width={70} 
                                            height={32} 
                                            disabled={isLoading}
                                            backgroundColor={isCpuActive ? COLORS.primary : COLORS.surfaceHighlight}
                                            hover={{ backgroundColor: isCpuActive ? COLORS.primaryHover : "#4B5563" }}
                                            onClick={() => handleToggleModel(model.key, 'cpu')}
                                        />
                                    </Container>
                                  ) : (
                                    <UiButton 
                                      text={isLoading ? "..." : "Download"} 
                                      width={100} 
                                      height={32} 
                                      disabled={isLoading}
                                      onClick={() => handleDownloadModel(model.key)}
                                    />
                                  )}
                                </Container>
                              );
                            })}
                          </Container>

                          {/* Auto-generate Toggle */}
                          <LabeledToggle
                            label="Auto-generate depth on photo enter"
                            checked={settings.autoGenerateOnEnter || false}
                            onChange={(v) => updateSetting('autoGenerateOnEnter', v)}
                          />
                        </>
                    )}

                    {activeTab === 'controls' && (
                        <Container flexDirection="column" gap={16}>
                          <Text fontSize={20} color="#F9FAFB">VR Controller - Gallery</Text>
                          <Text fontSize={18} color="#D1D5DB">- Thumbstick: Scroll</Text>
                          <Text fontSize={18} color="#D1D5DB">- A/X: Toggle Menu</Text>
                          <Text fontSize={18} color="#D1D5DB">- B/Y: Back / Close</Text>
                          <Text fontSize={18} color="#D1D5DB">- L3 (Left Stick Click): Toggle FPS Monitor</Text>
                          
                          <Container height={1} backgroundColor="rgba(255,255,255,0.1)" marginY={8} />

                          <Text fontSize={20} color="#F9FAFB">VR Controller - Viewer</Text>
                          <Text fontSize={18} color="#D1D5DB">- Thumbstick Left/Right: Navigate Photos</Text>
                          <Text fontSize={18} color="#D1D5DB">- B/Y: Exit Viewer</Text>
                          
                          <Container height={1} backgroundColor="rgba(255,255,255,0.1)" marginY={8} />
                          
                          <Text fontSize={20} color="#F9FAFB">Gaussian Splat Manipulation</Text>
                          <Text fontSize={18} color="#D1D5DB">- Left or Right Grip: Move Splat</Text>
                          <Text fontSize={18} color="#D1D5DB">- Both Grips: Scale (Pinch) + Rotate (Yaw & Roll)</Text>
                          <Text fontSize={18} color="#D1D5DB">- R3 (Right Stick Click): Reset Splat</Text>
                          <Text fontSize={16} color="#9CA3AF">* Grips only affect 3D splats, not photos</Text>

                          <Container height={1} backgroundColor="rgba(255,255,255,0.1)" marginY={8} />

                          <Text fontSize={20} color="#F9FAFB">Keyboard</Text>
                          <Text fontSize={18} color="#D1D5DB">- Arrows/WASD: Navigate</Text>
                          <Text fontSize={18} color="#D1D5DB">- Escape: Close</Text>
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

