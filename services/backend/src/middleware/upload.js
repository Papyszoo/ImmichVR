const multer = require('multer');
const fs = require('fs').promises;

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(err => {
  console.error('Failed to create upload directory - file uploads will fail:', err.message);
});

const upload = multer({ 
  dest: uploadDir,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
});

module.exports = upload;
