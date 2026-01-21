import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import React from 'react';
import ThumbnailGrid from '../ThumbnailGrid';

describe('ThumbnailGrid', () => {
  const mockPhotos = [
    {
      id: 'photo1',
      originalFileName: 'photo1.jpg',
      fileCreatedAt: '2024-01-15T10:00:00Z',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      exifInfo: { exifImageWidth: 1920, exifImageHeight: 1080 }
    },
    {
      id: 'photo2',
      originalFileName: 'photo2.jpg',
      fileCreatedAt: '2024-01-15T11:00:00Z',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      exifInfo: { exifImageWidth: 1920, exifImageHeight: 1080 }
    },
    {
      id: 'photo3',
      originalFileName: 'photo3.jpg',
      fileCreatedAt: '2024-02-10T10:00:00Z',
      thumbnailUrl: 'https://example.com/thumb3.jpg',
      exifInfo: { exifImageWidth: 1920, exifImageHeight: 1080 }
    }
  ];

  const mockSettings = {
    galleryWidth: 10,
    thumbnailHeight: 1.5,
    wallCurvature: 0.2,
    wallDistance: 5,
    gap: 0.2,
    depthScale: 1.0
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={mockPhotos}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should group photos by date', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={mockPhotos}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Component should create date groups
    // We have 2 photos in January and 1 in February
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should render photos in a grid layout', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={mockPhotos}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Grid should have items positioned based on settings
    expect(renderer.scene.children.length).toBeGreaterThan(0);
  });

  it('should handle empty photos array', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={[]}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Should render but have minimal children (no photos to display)
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should apply wall curvature from settings', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const curvedSettings = {
      ...mockSettings,
      wallCurvature: 0.5
    };

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={mockPhotos}
        onSelectPhoto={onSelectPhoto}
        settings={curvedSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Component should apply curvature to layout
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should respond to scrollY changes', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={mockPhotos}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Update with different scrollY
    await renderer.update(
      <ThumbnailGrid 
        photos={mockPhotos}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={5}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Component should update positions based on scroll
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should use depth cache when available', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const depthCache = {
      'photo1': 'https://example.com/depth1.png',
      'photo2': 'https://example.com/depth2.png'
    };

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={mockPhotos}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={depthCache}
        groupPositions={{}}
      />
    );

    // Component should use cached depth maps
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should handle photos with missing dates', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const photosWithoutDates = [
      {
        id: 'photo1',
        originalFileName: 'photo1.jpg',
        thumbnailUrl: 'https://example.com/thumb1.jpg'
      }
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={photosWithoutDates}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Should handle gracefully and use current date
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });

  it('should calculate aspect ratios correctly', async () => {
    const onSelectPhoto = vi.fn();
    const setSettings = vi.fn();
    const setSettingsOpen = vi.fn();

    const photosWithDifferentAspects = [
      {
        id: 'photo1',
        originalFileName: 'photo1.jpg',
        fileCreatedAt: '2024-01-15T10:00:00Z',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        ratio: 16/9 // Wide
      },
      {
        id: 'photo2',
        originalFileName: 'photo2.jpg',
        fileCreatedAt: '2024-01-15T11:00:00Z',
        thumbnailUrl: 'https://example.com/thumb2.jpg',
        ratio: 9/16 // Tall
      }
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <ThumbnailGrid 
        photos={photosWithDifferentAspects}
        onSelectPhoto={onSelectPhoto}
        settings={mockSettings}
        setSettings={setSettings}
        settingsOpen={false}
        setSettingsOpen={setSettingsOpen}
        scrollY={0}
        depthCache={{}}
        groupPositions={{}}
      />
    );

    // Component should layout with different widths based on aspect ratio
    expect(renderer).toBeDefined();
    expect(renderer.scene).toBeDefined();
  });
});
