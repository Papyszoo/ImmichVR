/**
 * threePolyfill.js
 * 
 * Polyfill for THREE.js features that are missing in older versions
 * but required by @sparkjsdev/spark.
 * 
 * This must be imported BEFORE any code that uses SparkJS.
 */
import * as THREE from 'three';

// Polyfill Matrix2 for older three.js versions (required by @sparkjsdev/spark)
// Matrix2 was added in three.js 0.178.0, but our project uses 0.160.0
if (!('Matrix2' in THREE)) {
  // Define a minimal Matrix2 class compatible with SparkJS requirements
  const Matrix2 = class Matrix2 {
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
  };
  
  // Patch THREE object
  Object.defineProperty(THREE, 'Matrix2', {
    value: Matrix2,
    writable: true,
    configurable: true,
    enumerable: true
  });
}

export default THREE;
