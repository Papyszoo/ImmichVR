# ADR 006: Gaussian Splatting via Apple ml-sharp

## Status
Accepted

## Context
Phase 3 of the roadmap requires implementing photorealistic 3D viewing. Multiple approaches were considered:
- Multi-image Gaussian Splatting (requires many photos)
- Single-image depth-based parallax (current implementation)
- Single-image Gaussian Splatting (Apple ml-sharp)

Apple's ml-sharp model provides state-of-the-art single-image 3D reconstruction in under a second, outputting standard .ply files compatible with web viewers.

## Decision
We implement Gaussian Splatting support using:

1. **Model**: Apple ml-sharp (`apple/ml-sharp`) for single-image 3D reconstruction
2. **Backend Processing**: 
   - AI service generates `.ply` via ml-sharp CLI (subprocess)
   - Backend converts `.ply` → `.ksplat` via `@mkkellogg/gaussian-splats-3d` CLI
3. **Storage**: Raw `.ply` and optimized `.ksplat` stored in `data/splats/`
4. **Frontend**: `GaussianSplatViewer` component wraps `@mkkellogg/gaussian-splats-3d`

### Key Design Choices:
- **CLI over Python imports**: ml-sharp is called via subprocess to avoid memory issues and simplify dependency management
- **Two-step optimization**: `.ply` → `.ksplat` reduces file size ~75% for Quest 3 browser streaming
- **Lazy loading**: Model downloaded on first use, consistent with ADR-003

## Consequences
- **Mac M4 Compatible**: The `predict` command works on Apple Silicon (MPS backend), no CUDA required
- **First-time latency**: ~2GB model download on first splat generation
- **Storage overhead**: Each photo can have both depth map (~100KB) and splat (~5-30MB)
- **Quest 3 optimized**: `.ksplat` format enables streaming mode to prevent browser crashes
