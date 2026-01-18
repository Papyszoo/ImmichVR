/**
 * threePolyfill.js
 * 
 * Polyfill for THREE.js features that are missing in older versions
 * but required by @sparkjsdev/spark.
 * 
 * This must be imported BEFORE any code that uses SparkJS.
 */
import * as THREE from 'three';

// Define a minimal Matrix2 class compatible with SparkJS requirements
// Matrix2 was added in three.js 0.178.0, but our project uses 0.160.0
class Matrix2 {
  constructor() {
    this.elements = [1, 0, 0, 1];
  }
  set(n11, n12, n21, n22) {
    const e = this.elements;
    e[0] = n11; e[1] = n21;
    e[2] = n12; e[3] = n22;
    return this;
  }
  identity() {
    this.set(1, 0, 0, 1);
    return this;
  }
  copy(m) {
    const e = this.elements;
    const me = m.elements;
    e[0] = me[0]; e[1] = me[1];
    e[2] = me[2]; e[3] = me[3];
    return this;
  }
  clone() {
    return new Matrix2().copy(this);
  }
}

// Check if THREE already has Matrix2
const hasMatrix2 = 'Matrix2' in THREE;

// Try to add Matrix2 to THREE, but handle the case where THREE is not extensible
if (!hasMatrix2) {
  try {
    Object.defineProperty(THREE, 'Matrix2', {
      value: Matrix2,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    // THREE object is frozen/sealed (common in newer bundlers)
    // We'll export a patched version instead
    console.warn('THREE object is not extensible, using polyfill wrapper for Matrix2');
  }
}

// Create a patched THREE export that always includes Matrix2
const PatchedTHREE = {
  ...THREE,
  Matrix2: THREE.Matrix2 || Matrix2
};

// Also set on globalThis for libraries that access THREE globally
if (typeof globalThis !== 'undefined' && globalThis.THREE) {
  try {
    globalThis.THREE.Matrix2 = globalThis.THREE.Matrix2 || Matrix2;
  } catch (e) {
    // Ignore if globalThis.THREE is also frozen
  }
}

export default PatchedTHREE;
export { Matrix2 };
