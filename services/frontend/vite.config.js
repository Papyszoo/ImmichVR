import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Custom Vite plugin to inject Matrix2 polyfill for SparkJS
 * SparkJS requires THREE.Matrix2 from three.js 0.178.0+, but this project uses 0.160.0
 * 
 * SparkJS accesses Matrix2 via the THREE namespace (e.g., `new THREE.Matrix2()`),
 * so we need to:
 * 1. Inject the Matrix2 class definition
 * 2. Replace all `THREE.Matrix2` references with our polyfill class
 */
function threeMatrix2PolyfillPlugin() {
  const matrix2ClassCode = `
// Matrix2 polyfill for three.js < 0.178.0
// Injected by vite.config.js for SparkJS compatibility
class Matrix2Polyfill {
  constructor(n11, n12, n21, n22) {
    this.elements = [1, 0, 0, 1];
    if (n11 !== undefined) {
      this.set(n11, n12, n21, n22);
    }
  }
  
  set(n11, n12, n21, n22) {
    const te = this.elements;
    te[0] = n11; te[2] = n12;
    te[1] = n21; te[3] = n22;
    return this;
  }
  
  identity() {
    this.set(1, 0, 0, 1);
    return this;
  }
  
  copy(m) {
    const te = this.elements;
    const me = m.elements;
    te[0] = me[0]; te[1] = me[1];
    te[2] = me[2]; te[3] = me[3];
    return this;
  }
  
  clone() {
    return new Matrix2Polyfill().fromArray(this.elements);
  }
  
  fromArray(array, offset = 0) {
    for (let i = 0; i < 4; i++) {
      this.elements[i] = array[i + offset];
    }
    return this;
  }
  
  toArray(array = [], offset = 0) {
    const te = this.elements;
    array[offset] = te[0];
    array[offset + 1] = te[1];
    array[offset + 2] = te[2];
    array[offset + 3] = te[3];
    return array;
  }
  
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    
    const a11 = ae[0], a12 = ae[2];
    const a21 = ae[1], a22 = ae[3];
    
    const b11 = be[0], b12 = be[2];
    const b21 = be[1], b22 = be[3];
    
    te[0] = a11 * b11 + a12 * b21;
    te[2] = a11 * b12 + a12 * b22;
    te[1] = a21 * b11 + a22 * b21;
    te[3] = a21 * b12 + a22 * b22;
    
    return this;
  }
  
  multiplyScalar(s) {
    const te = this.elements;
    te[0] *= s; te[2] *= s;
    te[1] *= s; te[3] *= s;
    return this;
  }
  
  determinant() {
    const te = this.elements;
    return te[0] * te[3] - te[2] * te[1];
  }
  
  invert() {
    const te = this.elements;
    const a = te[0], b = te[2];
    const c = te[1], d = te[3];
    const det = a * d - b * c;
    
    if (det === 0) {
      this.set(0, 0, 0, 0);
      return this;
    }
    
    const detInv = 1 / det;
    te[0] = d * detInv;
    te[2] = -b * detInv;
    te[1] = -c * detInv;
    te[3] = a * detInv;
    
    return this;
  }
  
  transpose() {
    const te = this.elements;
    const tmp = te[1];
    te[1] = te[2];
    te[2] = tmp;
    return this;
  }
  
  equals(matrix) {
    const te = this.elements;
    const me = matrix.elements;
    
    for (let i = 0; i < 4; i++) {
      if (te[i] !== me[i]) return false;
    }
    
    return true;
  }
}
Matrix2Polyfill.prototype.isMatrix2 = true;
`;

  return {
    name: 'three-matrix2-polyfill',
    enforce: 'pre',
    
    transform(code, id) {
      // Transform SparkJS to inject Matrix2 polyfill
      // Use path separator-aware matching for node_modules package path
      if (!id.includes('node_modules') || !id.includes('@sparkjsdev') || !id.includes('spark')) {
        return null;
      }
      
      // Check if this file uses THREE.Matrix2
      if (!code.includes('Matrix2')) {
        return null;
      }
      
      // Check if the file imports THREE namespace
      if (!code.includes('import * as THREE from')) {
        return null;
      }
      
      // Replace all THREE.Matrix2 references with our polyfill
      let modifiedCode = code.replace(/THREE\.Matrix2/g, 'Matrix2Polyfill');
      
      // Inject Matrix2 class at the top of the file (after imports)
      // Find a safe insertion point after import statements
      const lastImportMatch = modifiedCode.match(/^(import[\s\S]*?from\s+['"][^'"]+['"];?\s*)+/m);
      if (lastImportMatch) {
        const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
        modifiedCode = modifiedCode.slice(0, insertPosition) + '\n' + matrix2ClassCode + '\n' + modifiedCode.slice(insertPosition);
      } else {
        // Fallback: inject at the beginning
        modifiedCode = matrix2ClassCode + '\n' + modifiedCode;
      }
      
      return {
        code: modifiedCode,
        map: null
      };
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    threeMatrix2PolyfillPlugin(),
    react()
  ],
  resolve: {
    alias: {
      three: path.resolve(__dirname, 'node_modules/three'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      // Suppress the warning about Matrix2 not being exported
      // We handle this with our polyfill plugin
      onwarn(warning, warn) {
        if (warning.code === 'MISSING_EXPORT' && warning.message.includes('Matrix2')) {
          return; // Suppress Matrix2 warning - handled by polyfill
        }
        warn(warning);
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
  },
})
