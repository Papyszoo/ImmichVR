import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

/**
 * ParallaxDepthMaterial - Custom shader for stereo parallax depth effect
 * 
 * This material creates a 3D depth effect using parallax occlusion mapping.
 * It's much more performant than displacement mapping because:
 * - Uses only 4 vertices (flat quad) instead of 1024+ (32x32 grid)
 * - All depth calculation happens in fragment shader
 * - Per-pixel precision instead of per-vertex interpolation
 * 
 * The effect works by:
 * 1. Reading depth from the depth map
 * 2. Offsetting UV coordinates based on view angle and depth
 * 3. Creating stereo disparity for VR viewing
 */

// Vertex shader - simple pass-through
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader - parallax depth effect
const fragmentShader = /* glsl */ `
  uniform sampler2D colorMap;
  uniform sampler2D depthMap;
  uniform float depthScale;
  uniform float parallaxMinLayers;
  uniform float parallaxMaxLayers;
  uniform bool hasDepth;
  uniform float opacity;
  
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  
  /**
   * Parallax Occlusion Mapping
   * Traces rays through the height field for accurate depth
   */
  vec2 parallaxMapping(vec2 uv, vec3 viewDir) {
    if (!hasDepth) {
      return uv;
    }
    
    // Number of layers based on view angle (more layers at grazing angles)
    float numLayers = mix(parallaxMaxLayers, parallaxMinLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)));
    
    // Calculate layer depth and UV delta
    float layerDepth = 1.0 / numLayers;
    float currentLayerDepth = 0.0;
    
    // Scale and direction of UV offset
    vec2 P = viewDir.xy * depthScale;
    vec2 deltaUV = P / numLayers;
    
    // Current values
    vec2 currentUV = uv;
    float currentDepthValue = 1.0 - texture2D(depthMap, currentUV).r;
    
    // Ray march through depth layers
    for (int i = 0; i < 32; i++) {
      if (currentLayerDepth >= currentDepthValue) break;
      if (i >= int(numLayers)) break;
      
      currentUV -= deltaUV;
      currentDepthValue = 1.0 - texture2D(depthMap, currentUV).r;
      currentLayerDepth += layerDepth;
    }
    
    // Get UV offset before and after collision for interpolation
    vec2 prevUV = currentUV + deltaUV;
    
    // Depth values for interpolation
    float afterDepth = currentDepthValue - currentLayerDepth;
    float beforeDepth = (1.0 - texture2D(depthMap, prevUV).r) - currentLayerDepth + layerDepth;
    
    // Interpolate for smooth result
    float weight = afterDepth / (afterDepth - beforeDepth);
    vec2 finalUV = prevUV * weight + currentUV * (1.0 - weight);
    
    // Clamp to prevent sampling outside texture
    return clamp(finalUV, vec2(0.001), vec2(0.999));
  }
  
  void main() {
    // Calculate view direction in tangent space
    vec3 viewDir = normalize(vViewPosition);
    
    // Transform view direction to tangent space
    // For a front-facing plane, tangent space is roughly aligned with view space
    vec3 tangentViewDir = normalize(vec3(viewDir.x, viewDir.y, abs(viewDir.z)));
    
    // Apply parallax mapping
    vec2 parallaxUV = parallaxMapping(vUv, tangentViewDir);
    
    // Sample color at parallax-adjusted UV
    vec4 color = texture2D(colorMap, parallaxUV);
    
    // Simple edge fade to hide artifacts at extreme angles
    float edgeFade = smoothstep(0.0, 0.05, parallaxUV.x) * 
                     smoothstep(1.0, 0.95, parallaxUV.x) *
                     smoothstep(0.0, 0.05, parallaxUV.y) * 
                     smoothstep(1.0, 0.95, parallaxUV.y);
    
    gl_FragColor = vec4(color.rgb, color.a * edgeFade * opacity);
  }
`;

/**
 * Create the parallax material using drei's shaderMaterial helper
 * This makes it work seamlessly with React Three Fiber
 */
const ParallaxDepthMaterial = shaderMaterial(
  // Uniforms with default values
  {
    colorMap: null,
    depthMap: null,
    depthScale: 0.08,          // Reduced from 0.15 for parallax (it's more sensitive)
    parallaxMinLayers: 4,       // Minimum ray march steps (when viewing straight-on)
    parallaxMaxLayers: 16,      // Maximum ray march steps (at grazing angles)
    hasDepth: false,
    opacity: 1.0,
  },
  vertexShader,
  fragmentShader
);

// Extend Three.js so we can use it as <parallaxDepthMaterial />
export { ParallaxDepthMaterial };

/**
 * Alternative: Simple parallax (single sample, faster but less accurate)
 * Use this for distant thumbnails or lower-end devices
 */
const simpleVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewPosition;
  
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const simpleFragmentShader = /* glsl */ `
  uniform sampler2D colorMap;
  uniform sampler2D depthMap;
  uniform float depthScale;
  uniform bool hasDepth;
  uniform float opacity;
  
  varying vec2 vUv;
  varying vec3 vViewPosition;
  
  void main() {
    vec2 uv = vUv;
    
    if (hasDepth) {
      // Simple single-sample parallax offset
      vec3 viewDir = normalize(vViewPosition);
      float depth = 1.0 - texture2D(depthMap, vUv).r;
      vec2 offset = viewDir.xy * depth * depthScale;
      uv = clamp(vUv - offset, vec2(0.0), vec2(1.0));
    }
    
    vec4 color = texture2D(colorMap, uv);
    gl_FragColor = vec4(color.rgb, color.a * opacity);
  }
`;

const SimpleParallaxMaterial = shaderMaterial(
  {
    colorMap: null,
    depthMap: null,
    depthScale: 0.05,
    hasDepth: false,
    opacity: 1.0,
  },
  simpleVertexShader,
  simpleFragmentShader
);

export { SimpleParallaxMaterial };
