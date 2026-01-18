/**
 * convert-ply-to-splat.js
 * 
 * Converts PLY files to standard .splat format (32 bytes per gaussian)
 * antimatter15/splat format: position(12) + scale(12) + color(4) + rotation(4)
 * 
 * Usage: node convert-ply-to-splat.js [input.ply] [output.splat]
 */
const fs = require('fs');

async function main() {
    if (process.argv.length < 4) {
        console.log('Usage: node convert-ply-to-splat.js [input.ply] [output.splat]');
        process.exit(1);
    }

    const inputFile = process.argv[2];
    const outputFile = process.argv[3];

    if (!fs.existsSync(inputFile)) {
        console.error(`Input file not found: ${inputFile}`);
        process.exit(1);
    }

    console.log(`Converting ${inputFile} to ${outputFile}...`);

    try {
        const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d');
        
        const fileData = fs.readFileSync(inputFile);
        const fileBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
        
        console.log(`Read ${fileData.length} bytes from PLY file`);
        
        const splatArray = GaussianSplats3D.PlyParser.parseToUncompressedSplatArray(fileBuffer, 0);
        const splatCount = splatArray.splatCount;
        console.log(`Parsed ${splatCount} splats`);
        
        // Debug: show first splat structure
        const firstSplat = splatArray.getSplat(0);
        console.log('First splat:', Array.from(firstSplat));
        
        // antimatter15/splat format: 32 bytes per gaussian
        // Layout: position(3xf32=12) + scale(3xf32=12) + color(4xu8=4) + rotation(4xu8=4)
        const bytesPerSplat = 32;
        const outputBuffer = Buffer.alloc(splatCount * bytesPerSplat);
        
        // splatArray.getSplat(i) returns array with 14 components:
        // [0-2]: position x, y, z (float)
        // [3-6]: quaternion w, x, y, z (float, normalized -1 to 1)
        // [7-9]: scale x, y, z (float)
        // [10-13]: color R, G, B, A (0-255)
        
        for (let i = 0; i < splatCount; i++) {
            const offset = i * bytesPerSplat;
            const splat = splatArray.getSplat(i);
            
            // Position (3x float32 = 12 bytes) - indices 0, 1, 2
            outputBuffer.writeFloatLE(splat[0], offset + 0);
            outputBuffer.writeFloatLE(splat[1], offset + 4);
            outputBuffer.writeFloatLE(splat[2], offset + 8);
            
            // Scale (3x float32 = 12 bytes) - indices 7, 8, 9
            outputBuffer.writeFloatLE(splat[7], offset + 12);
            outputBuffer.writeFloatLE(splat[8], offset + 16);
            outputBuffer.writeFloatLE(splat[9], offset + 20);
            
            // Color (4x uint8 = 4 bytes) - indices 10, 11, 12, 13
            outputBuffer.writeUInt8(Math.round(splat[10]), offset + 24);
            outputBuffer.writeUInt8(Math.round(splat[11]), offset + 25);
            outputBuffer.writeUInt8(Math.round(splat[12]), offset + 26);
            outputBuffer.writeUInt8(Math.round(splat[13]), offset + 27);
            
            // Rotation quaternion (4x uint8 = 4 bytes) - indices 3, 4, 5, 6
            // antimatter15 uses unorm8 (0-255) where 128 = 0.0
            // Quaternion from library is normalized (-1 to 1), convert to (0 to 255)
            outputBuffer.writeUInt8(Math.round((splat[3] + 1) * 127.5), offset + 28);
            outputBuffer.writeUInt8(Math.round((splat[4] + 1) * 127.5), offset + 29);
            outputBuffer.writeUInt8(Math.round((splat[5] + 1) * 127.5), offset + 30);
            outputBuffer.writeUInt8(Math.round((splat[6] + 1) * 127.5), offset + 31);
        }
        
        fs.writeFileSync(outputFile, outputBuffer);
        
        console.log(`Successfully converted to ${outputFile}`);
        console.log(`Output size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Splat count: ${splatCount}`);
        
    } catch (err) {
        console.error('Conversion failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
