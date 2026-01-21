const axios = require('axios');

const https = require('https');

async function checkTimeline() {
  try {
    const agent = new https.Agent({  
      rejectUnauthorized: false
    });
    const response = await axios.get('https://localhost:21370/api/immich/timeline', { httpsAgent: agent });
    console.log('Timeline Buckets (First 3):');
    console.log(JSON.stringify(response.data.data.slice(0, 3), null, 2));
    
    // Check first bucket content
    if (response.data.data.length > 0) {
        const bucket = response.data.data[0].timeBucket;
        console.log(`\nFetching bucket: ${bucket}`);
        const bucketRes = await axios.get(`https://localhost:21370/api/immich/timeline/${encodeURIComponent(bucket)}`, { httpsAgent: agent });
        console.log('Bucket Assets (First 1):');
        // Check if we get metadata like blurhash, width, height
        const firstAsset = bucketRes.data.data[0];
        // Log keys only to be concise
        console.log('Asset Keys:', Object.keys(firstAsset));
        console.log('Sample Asset Data:', {
            id: firstAsset.id,
            width: firstAsset.exifInfo?.exifImageWidth,
            height: firstAsset.exifInfo?.exifImageHeight,
            blurhash: firstAsset.blurhash,
            thumbhash: firstAsset.thumbhash
        });
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) console.error('Data:', error.response.data);
  }
}

checkTimeline();
