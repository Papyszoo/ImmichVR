#!/usr/bin/env python3
"""
Test script for the Depth Anything V2 AI service.
"""

import sys
import io
import os
import tempfile
import requests
from PIL import Image, ImageDraw

def create_test_image():
    """Create a simple test image with gradients."""
    width, height = 640, 480
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)
    
    # Draw some shapes to create depth variation
    draw.rectangle([50, 50, 250, 250], fill='red', outline='black', width=3)
    draw.ellipse([350, 100, 550, 300], fill='blue', outline='black', width=3)
    draw.polygon([(100, 350), (200, 450), (50, 450)], fill='green', outline='black')
    
    return image

def test_health_check(base_url):
    """Test the health check endpoint."""
    print("Testing health check endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check passed: {data}")
            return True
        else:
            print(f"✗ Health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

def test_depth_endpoint(base_url, image):
    """Test the depth generation endpoint."""
    print("\nTesting depth generation endpoint...")
    try:
        # Convert image to bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        # Send request
        files = {'image': ('test_image.png', img_byte_arr, 'image/png')}
        response = requests.post(f"{base_url}/api/depth", files=files, timeout=60)
        
        if response.status_code == 200:
            print(f"✓ Depth generation successful")
            print(f"  Response size: {len(response.content)} bytes")
            print(f"  Content-Type: {response.headers.get('Content-Type')}")
            
            # Save the result to temp directory
            temp_dir = tempfile.gettempdir()
            output_path = os.path.join(temp_dir, 'test_depth_output.png')
            with open(output_path, 'wb') as f:
                f.write(response.content)
            print(f"  Saved depth map to: {output_path}")
            return True
        else:
            print(f"✗ Depth generation failed with status {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Depth generation error: {e}")
        return False

def main():
    """Main test function."""
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
    print(f"Testing AI service at: {base_url}\n")
    
    # Test health check
    if not test_health_check(base_url):
        print("\n❌ Health check failed. Is the service running?")
        sys.exit(1)
    
    # Create test image
    print("\nCreating test image...")
    test_image = create_test_image()
    temp_dir = tempfile.gettempdir()
    input_path = os.path.join(temp_dir, 'test_input.png')
    test_image.save(input_path)
    print(f"✓ Test image created and saved to: {input_path}")
    
    # Test depth endpoint
    if test_depth_endpoint(base_url, test_image):
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Depth generation test failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
