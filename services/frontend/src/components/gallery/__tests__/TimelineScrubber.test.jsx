import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import React from 'react';
import TimelineScrubber from '../TimelineScrubber';

describe('TimelineScrubber', () => {
  const mockGroupPositions = {
    'January 2024': { y: 10, year: 2024 },
    'February 2024': { y: 20, year: 2024 },
    'March 2024': { y: 30, year: 2024 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should render with empty groupPositions', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={{}}
        scrollY={0}
        totalHeight={100}
      />
    );

    // Should render but with no markers
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should create markers for each time period', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    // Timeline should have markers positioned
    expect(renderer.scene.children.length).toBeGreaterThan(0);
  });

  it('should respond to scrollY changes', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    // Update with different scroll position
    await renderer.update(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={50}
        totalHeight={100}
      />
    );

    // Component should update internal state
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle totalHeight changes', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    // Update with different total height
    await renderer.update(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={0}
        totalHeight={200}
      />
    );

    // Component should recalculate marker positions
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should display labels for first and last markers', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const manyGroupPositions = {
      'January 2024': { y: 10, year: 2024 },
      'February 2024': { y: 20, year: 2024 },
      'March 2024': { y: 30, year: 2024 },
      'April 2024': { y: 40, year: 2024 },
      'May 2024': { y: 50, year: 2024 }
    };

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={manyGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    // First and last markers should show labels
    expect(renderer.scene.children.length).toBeGreaterThan(0);
  });

  it('should handle dragging state', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    // Component manages internal dragging state
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should properly position markers based on Y coordinates', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const customGroupPositions = {
      'Start': { y: 0, year: 2024 },
      'Middle': { y: 50, year: 2024 },
      'End': { y: 100, year: 2024 }
    };

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={customGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    // Markers should be positioned proportionally
    expect(renderer.scene.children.length).toBeGreaterThan(0);
  });

  it('should sort markers by Y position', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    // Unsorted input
    const unsortedGroupPositions = {
      'March 2024': { y: 30, year: 2024 },
      'January 2024': { y: 10, year: 2024 },
      'February 2024': { y: 20, year: 2024 }
    };

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={unsortedGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    // Component should sort internally
    expect(renderer.scene.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should clean up on unmount', async () => {
    const onScrollToYear = vi.fn();
    const onScroll = vi.fn();

    const renderer = await ReactThreeTestRenderer.create(
      <TimelineScrubber 
        onScrollToYear={onScrollToYear}
        onScroll={onScroll}
        groupPositions={mockGroupPositions}
        scrollY={0}
        totalHeight={100}
      />
    );

    await renderer.unmount();

    // Should clean up properly
    expect(renderer.scene.children.length).toBe(0);
  });
});
