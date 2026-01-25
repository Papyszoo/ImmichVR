import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import GaussianSplatViewer from '../GaussianSplatViewer';

// Mock everything from @react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useThree: vi.fn(),
  useFrame: vi.fn(),
}));

// Mock @sparkjsdev/spark
const mockSplatMesh = {
  position: { set: vi.fn() },
  rotation: { set: vi.fn() },
  scale: { set: vi.fn(), setScalar: vi.fn() },
  dispose: vi.fn(),
  material: {},
  maxStdDev: 3.0,
  initialized: Promise.resolve(),
};

const mockLoadAsync = vi.fn();

vi.mock('@sparkjsdev/spark', () => {
  return {
    SplatMesh: class SplatMesh {
      constructor() {
        return mockSplatMesh;
      }
    },
    SplatLoader: class SplatLoader {
      constructor() {
        return {
          loadAsync: mockLoadAsync,
          fileType: 0
        };
      }
    },
    SplatFileType: {
      PLY: 0,
      KSPLAT: 1,
      SPLAT: 2,
      SPZ: 3
    }
  };
});

describe('GaussianSplatViewer', () => {
  let sceneAddSpy;
  let sceneRemoveSpy;
  let useThreeMock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup scene mocks
    sceneAddSpy = vi.fn();
    sceneRemoveSpy = vi.fn();
    useThreeMock = {
      scene: {
        add: sceneAddSpy,
        remove: sceneRemoveSpy,
      }
    };

    const { useThree } = await import('@react-three/fiber');
    useThree.mockReturnValue(useThreeMock);

    // Setup SplatLoader mock response
    mockLoadAsync.mockResolvedValue({
      splatCount: 1000,
      size: 1000,
      numSplats: 1000
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should render without crashing and attempt to load splat', async () => {
    render(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
      />
    );

    await waitFor(() => {
      expect(mockLoadAsync).toHaveBeenCalledWith("https://example.com/test.ply");
    });
  });

  it('should call onLoad callback when splat loads successfully via SparkJS loading', async () => {
    const onLoad = vi.fn();
    
    render(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        onLoad={onLoad}
      />
    );

    await waitFor(() => {
      expect(mockLoadAsync).toHaveBeenCalled();
      expect(sceneAddSpy).toHaveBeenCalled();
      expect(onLoad).toHaveBeenCalled();
    });
  });

  it('should use test mode URL when testMode is true', async () => {
    render(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        testMode={true}
      />
    );

    await waitFor(() => {
      expect(mockLoadAsync).toHaveBeenCalledWith("https://sparkjs.dev/assets/splats/butterfly.spz");
    });
  });

  it('should apply position, rotation, and scale props to the SplatMesh', async () => {
    const position = [1, 2, 3];
    const rotation = [0.1, 0.2, 0.3];
    const scale = 2.0;

    render(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        position={position}
        rotation={rotation}
        scale={scale}
      />
    );

    await waitFor(() => {
      expect(mockSplatMesh.position.set).toHaveBeenCalledWith(1, 2, 3);
      expect(mockSplatMesh.rotation.set).toHaveBeenCalledWith(0.1, 0.2, 0.3);
      expect(mockSplatMesh.scale.setScalar).toHaveBeenCalledWith(2.0);
    });
  });

  it('should adjust quality when quality prop changes', async () => {
    const { rerender } = render(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        quality="HIGH"
      />
    );

    await waitFor(() => {
        expect(sceneAddSpy).toHaveBeenCalled();
    });

    // Update to LOW
    rerender(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        quality="LOW"
      />
    );

    await waitFor(() => {
       expect(mockSplatMesh.maxStdDev).toBe(2.0);
    });
  });

  it('should clean up on unmount', async () => {
    const { unmount } = render(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
      />
    );

    await waitFor(() => {
        expect(sceneAddSpy).toHaveBeenCalled();
    });

    unmount();

    expect(sceneRemoveSpy).toHaveBeenCalled();
    expect(mockSplatMesh.dispose).toHaveBeenCalled();
  });

  it('should handle different file types logic', async () => {
    const { unmount } = render(
        <GaussianSplatViewer 
          splatUrl={`https://example.com/test.ksplat`}
          fileType="ksplat"
        />
    );
      
    await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalled();
    });
    
    unmount();
  });
});
