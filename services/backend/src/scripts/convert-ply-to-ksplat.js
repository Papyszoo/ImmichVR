/**
 * convert-ply-to-ksplat.js
 * 
 * Standalone Node.js script to convert PLY files to KSPLAT format
 * using @mkkellogg/gaussian-splats-3d library.
 * 
 * Usage: node convert-ply-to-ksplat.js [input.ply] [output.ksplat]
 */
const fs = require('fs');
const path = require('path');

// Dynamic import for ES module
async function main() {
    if (process.argv.length < 4) {
        console.log('Usage: node convert-ply-to-ksplat.js [input.ply] [output.ksplat]');
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
        // Import the library dynamically (it's an ES module)
        const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d');
        
        // Read the input file
        const fileData = fs.readFileSync(inputFile);
        const fileBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
        
        // Determine format from file extension
        const format = inputFile.toLowerCase().endsWith('.ply') 
            ? GaussianSplats3D.SceneFormat.Ply 
            : GaussianSplats3D.SceneFormat.Splat;
        
        console.log(`Detected format: ${format === GaussianSplats3D.SceneFormat.Ply ? 'PLY' : 'SPLAT'}`);
        
        // Parse to uncompressed splat array
        let splatArray;
        if (format === GaussianSplats3D.SceneFormat.Ply) {
            splatArray = GaussianSplats3D.PlyParser.parseToUncompressedSplatArray(fileBuffer, 0);
        } else {
            splatArray = GaussianSplats3D.SplatParser.parseStandardSplatToUncompressedSplatArray(fileBuffer);
        }
        
        console.log(`Parsed ${splatArray.splatCount} splats`);
        
        // Generate compressed splat buffer
        // Use undefined for optional params - the library will use smart defaults
        const splatBufferGenerator = GaussianSplats3D.SplatBufferGenerator.getStandardGenerator(
            1,          // alphaRemovalThreshold (remove very transparent splats)
            0,          // compressionLevel (0=none for max compatibility)
            0,          // sectionSize (0=auto)
            undefined,  // sceneCenter (undefined = auto-calculate from data)
            undefined,  // blockSize (undefined = use default)
            undefined   // bucketSize (undefined = use default)
        );
        
        const splatBuffer = splatBufferGenerator.generateFromUncompressedSplatArray(splatArray);
        
        // Write output file
        fs.writeFileSync(outputFile, Buffer.from(splatBuffer.bufferData));
        
        console.log(`Successfully converted to ${outputFile}`);
        console.log(`Output size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
        
    } catch (err) {
        console.error('Conversion failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
