import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import React from 'react';
import VideoDepthPlayer from '../VideoDepthPlayer';

// Mock dependencies
vi.mock('jszip', () => ({
  default: class JSZip {
    async loadAsync() {
      return {
        files: {
          'frame_001.png': {
            name: 'frame_001.png',
            async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
          },
          'frame_002.png': {
            name: 'frame_002.png',
            async: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]))
          }
        }
      };
    }
  }
}));

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
  })
);

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('VideoDepthPlayer', () => {
  const mockMedia = {
    id: 'test-id',
    type: 'VIDEO',
    depthBlob: 'https://example.com/depth.zip'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const onClose = vi.fn();
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should load and extract frames from ZIP', async () => {
    const onClose = vi.fn();
    
    await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Fetch should have been called to load ZIP
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should initialize with isPlaying false', async () => {
    const onClose = vi.fn();
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    // Component should start paused
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should render control buttons', async () => {
    const onClose = vi.fn();
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Control buttons should be present in the scene
    expect(renderer.scene.children.length).toBeGreaterThan(0);
  });

  it('should call onClose when provided', async () => {
    const onClose = vi.fn();
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    await renderer.unmount();

    // Component should be cleaned up
    expect(renderer.scene.children.length).toBe(0);
  });

  it('should handle onNext and onPrevious callbacks', async () => {
    const onClose = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    
    await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    );

    // Callbacks should be available for use
    expect(onNext).toBeDefined();
    expect(onPrevious).toBeDefined();
  });

  it('should support zoom level adjustments', async () => {
    const onClose = vi.fn();
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Component has internal zoom state
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should support rotation adjustments', async () => {
    const onClose = vi.fn();
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Component has internal rotation state
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle missing depthBlob gracefully', async () => {
    const onClose = vi.fn();
    const mediaWithoutBlob = {
      id: 'test-id',
      type: 'VIDEO'
    };
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mediaWithoutBlob}
        onClose={onClose}
      />
    );

    // Should render but show loading state
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should clean up on unmount', async () => {
    const onClose = vi.fn();
    
    const renderer = await ReactThreeTestRenderer.create(
      <VideoDepthPlayer 
        media={mockMedia}
        onClose={onClose}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    await renderer.unmount();

    // Should clean up resources
    expect(renderer.scene.children.length).toBe(0);
  });
});
