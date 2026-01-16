# ADR 003: Lazy Resource Management

## Status
Accepted

## Context
Running AI models (like Depth Anything V2 or Gaussian Splatting) is VRAM-intensive. A VR application relies on maintaining a high frame rate (usually 72-90Hz) to prevent motion sickness. Running an AI model simultaneously with a complex VR scene can cause performance degradation. Furthermore, users often leave the application idle.

## Decision
We implement a **Lazy Loading and Auto-Unloading** strategy for AI resources.

1.  **Never Load on Startup**: The AI service must start in a "dormant" state with no models loaded into VRAM.
2.  **On-Demand Activation**: Models are loaded ONLY when explicitly needed (e.g., user enters a photo view with `autoGenerate` on, or clicks a button).
3.  **Sliding Window Timeout**: We implement an inactivity timer. If no inference requests are received for a set period (e.g., 30 minutes), the model is automatically unloaded from VRAM to free up resources.
4.  **Priority**: VR Rendering performance takes priority over "instant" AI results. We accept the latency of loading a model (seconds) to ensure the baseline VR experience is always smooth.

## Consequences
*   **Latency**: Users will experience a delay when first requesting a depth map as the model loads.
*   **Efficiency**: System resources are respected. The app can run in the background without hogging the GPU.
*   **Stability**: Reduces the risk of Out-Of-Memory (OOM) crashes during extended sessions.
