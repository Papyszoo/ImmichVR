import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

/**
 * CameraController - Handles scroll via camera movement and ensures camera looks forward
 */
function CameraController({ scrollY }) {
  const { camera } = useThree();
  const targetY = useRef(1.6);
  const initialized = useRef(false);
  
  useEffect(() => {
    targetY.current = 1.6 + scrollY;
  }, [scrollY]);
  
  useFrame(() => {
    // Ensure camera looks at -Z on first frame
    if (!initialized.current) {
      camera.position.set(0, 1.6, 0);
      camera.lookAt(0, 1.6, -10);
      initialized.current = true;
    }
  });
  
  return null;
}

export default CameraController;
