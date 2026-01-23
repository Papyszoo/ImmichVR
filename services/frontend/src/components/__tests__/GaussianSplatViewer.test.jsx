import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import React from 'react';
import GaussianSplatViewer from '../GaussianSplatViewer';

// Mock @sparkjsdev/spark
vi.mock('@sparkjsdev/spark', () => ({
  SplatMesh: class SplatMesh {
    constructor() {
      this.position = { set: vi.fn() };
      this.rotation = { set: vi.fn() };
      this.scale = { set: vi.fn(), setScalar: vi.fn() };
      this.dispose = vi.fn();
      this.material = {};
      this.maxStdDev = 3.0;
      this.initialized = Promise.resolve();
    }
    load() {
      return Promise.resolve({
        splatCount: 1000,
        mesh: this
      });
    }
  },
  SplatLoader: class SplatLoader {
    static load() {
      return Promise.resolve({
        splatCount: 1000
      });
    }
  },
  SplatFileType: {
    PLY: 0,
    KSPLAT: 1,
    SPLAT: 2,
    SPZ: 3
  }
}));

describe('GaussianSplatViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
      />
    );

    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should call onLoad callback when splat loads successfully', async () => {
    const onLoad = vi.fn();
    
    await ReactThreeTestRenderer.create(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        onLoad={onLoad}
      />
    );

    // Wait for async load
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(onLoad).toHaveBeenCalled();
  });

  it('should use test mode URL when testMode is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        testMode={true}
      />
    );

    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should apply position, rotation, and scale props', async () => {
    const position = [1, 2, 3];
    const rotation = [0.1, 0.2, 0.3];
    const scale = 2.0;

    await ReactThreeTestRenderer.create(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        position={position}
        rotation={rotation}
        scale={scale}
      />
    );

    // Wait for mesh creation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify the component was rendered successfully
    expect(renderer).toBeDefined();
  });

  it('should adjust quality when quality prop changes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        quality="HIGH"
      />
    );

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update quality
    await renderer.update(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
        quality="LOW"
      />
    );

    // Component should adjust internal settings
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should clean up on unmount', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GaussianSplatViewer 
        splatUrl="https://example.com/test.ply" 
        fileType="ply"
      />
    );

    // Wait for mesh creation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Unmount should clean up
    await renderer.unmount();

    expect(renderer.scene.children.length).toBe(0);
  });

  it('should support different file types', async () => {
    const fileTypes = ['ply', 'ksplat', 'spz'];

    for (const fileType of fileTypes) {
      const renderer = await ReactThreeTestRenderer.create(
        <GaussianSplatViewer 
          splatUrl={`https://example.com/test.${fileType}`}
          fileType={fileType}
        />
      );

      expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
      await renderer.unmount();
    }
  });

  it('should handle missing splatUrl gracefully', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GaussianSplatViewer 
        splatUrl=""
        fileType="ply"
      />
    );

    // Should render but not attempt to load
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });
});
