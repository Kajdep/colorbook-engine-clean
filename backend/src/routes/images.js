const express = require('express');
const Joi = require('joi');
const path = require('path');
const fs = require('fs'); // Added fs import
const { query, withTransaction } = require('../database/connection');
const { validateRequest } = require('../middleware/validation');
const upload = require('../middleware/upload');
// Assuming authenticateToken is applied globally or at a higher router level

const router = express.Router();

// Joi schema for image upload metadata (req.body)
const uploadImageSchema = Joi.object({
  projectId: Joi.string().uuid().optional().allow(null, ''),
  title: Joi.string().trim().max(255).optional().default('Untitled Image'),
  altText: Joi.string().trim().max(1000).optional().allow(''),
  metadata: Joi.object().optional().default({})
});

// Joi schema for updating image metadata (req.body)
const updateImageSchema = Joi.object({
  title: Joi.string().trim().max(255).optional(),
  altText: Joi.string().trim().max(1000).optional().allow(''),
  metadata: Joi.object().optional(),
  projectId: Joi.string().uuid().optional().allow(null)
}).min(1);

// Joi schema for getting images by projectId (query parameter)
const getProjectImagesSchema = Joi.object({
  projectId: Joi.string().uuid().required()
});

// Joi schema for image ID (path parameter)
const imageIdSchema = Joi.object({
  id: Joi.string().uuid().required()
});

// Upload a new image
router.post('/upload', upload.single('image'), validateRequest(uploadImageSchema, 'body'), async (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded or file type not supported.' });
  }

  const { projectId, title, altText, metadata: customMetadata } = req.body;
  const { filename, mimetype, size } = req.file;

  const relativeFilepath = path.join('uploads', filename).replace(/\\/g, "/");

  try {
    const result = await query(
      `INSERT INTO images (user_id, project_id, filename, filepath, mimetype, size_bytes, title, alt_text, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id, project_id, filename, filepath, mimetype, size_bytes, title, alt_text, metadata, created_at, updated_at`,
      [
        userId,
        projectId || null,
        filename,
        relativeFilepath,
        mimetype,
        size,
        title,
        altText,
        JSON.stringify(customMetadata)
      ]
    );

    const newImageRecord = result.rows[0];
    res.status(201).json(newImageRecord);
  } catch (error) {
    console.error('Error saving image record to database:', error);
    if (error.code === '23503') {
        if (error.constraint && error.constraint.includes('project_id')) {
            return res.status(400).json({ error: `Invalid project ID: ${projectId}. Project may not exist.` });
        }
    }
    res.status(500).json({ error: 'Failed to save image information.' });
  }
});

// Get all images for a specific project (and authenticated user)
router.get('/', validateRequest(getProjectImagesSchema, 'query'), async (req, res) => {
  const { projectId } = req.query;
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const result = await query(
      `SELECT id, user_id, project_id, filename, filepath, mimetype, size_bytes, title, alt_text, metadata, created_at, updated_at
       FROM images
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [projectId, userId]
    );

    const images = result.rows.map(image => ({
      ...image,
      metadata: typeof image.metadata === 'string' ? JSON.parse(image.metadata) : image.metadata,
    }));

    res.json({ images });
  } catch (error) {
    console.error(`Error fetching images for project ${projectId}:`, error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get a specific image by ID
router.get('/:id', validateRequest(imageIdSchema, 'params'), async (req, res) => {
  const { id: imageId } = req.params;
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const result = await query(
      `SELECT id, user_id, project_id, filename, filepath, mimetype, size_bytes, title, alt_text, metadata, created_at, updated_at
       FROM images
       WHERE id = $1 AND user_id = $2`,
      [imageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found or access denied' });
    }

    let image = result.rows[0];
    image = {
      ...image,
      metadata: typeof image.metadata === 'string' ? JSON.parse(image.metadata) : image.metadata,
    };

    res.json({ image });
  } catch (error) {
    console.error(`Error fetching image ${imageId}:`, error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Update a specific image's metadata by ID
router.put('/:id', validateRequest(imageIdSchema, 'params'), validateRequest(updateImageSchema, 'body'), async (req, res) => {
  const { id: imageId } = req.params;
  const userId = req.user.id;
  const updates = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const setClauses = [];
  const values = [];
  let valueCount = 1;

  if (updates.hasOwnProperty('title')) {
    setClauses.push(`title = $${valueCount++}`);
    values.push(updates.title);
  }
  if (updates.hasOwnProperty('altText')) {
    setClauses.push(`alt_text = $${valueCount++}`);
    values.push(updates.altText);
  }
  if (updates.hasOwnProperty('metadata')) {
    setClauses.push(`metadata = $${valueCount++}`);
    values.push(JSON.stringify(updates.metadata));
  }
  if (updates.hasOwnProperty('projectId')) {
    setClauses.push(`project_id = $${valueCount++}`);
    values.push(updates.projectId);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');

  values.push(imageId);
  values.push(userId);

  const updateQuery = `
    UPDATE images
    SET ${setClauses.join(', ')}
    WHERE id = $${valueCount++} AND user_id = $${valueCount++}
    RETURNING id, user_id, project_id, filename, filepath, mimetype, size_bytes, title, alt_text, metadata, created_at, updated_at`;

  try {
    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found or access denied' });
    }

    let updatedImage = result.rows[0];
    updatedImage = {
      ...updatedImage,
      metadata: typeof updatedImage.metadata === 'string' ? JSON.parse(updatedImage.metadata) : updatedImage.metadata,
    };

    res.json({ image: updatedImage });
  } catch (error) {
    console.error(`Error updating image ${imageId}:`, error);
     if (error.code === '23503') {
        if (error.constraint && error.constraint.includes('project_id')) {
            return res.status(400).json({ error: `Invalid project ID. Project may not exist.` });
        }
    }
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// Delete a specific image by ID
router.delete('/:id', validateRequest(imageIdSchema, 'params'), async (req, res) => {
  const { id: imageId } = req.params;
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    await withTransaction(async (client) => {
      // 1. Fetch image to get filepath and verify ownership
      const imageResult = await client.query(
        'SELECT id, filepath FROM images WHERE id = $1 AND user_id = $2',
        [imageId, userId]
      );

      if (imageResult.rows.length === 0) {
        const err = new Error('Image not found or access denied');
        err.statusCode = 404;
        throw err;
      }
      const image = imageResult.rows[0];
      const relativeFilepath = image.filepath;

      // 2. Delete image record from database
      const deleteResult = await client.query(
        'DELETE FROM images WHERE id = $1 AND user_id = $2 RETURNING id',
        [imageId, userId]
      );

      // This check is technically redundant if imageResult.rows.length was > 0,
      // but good for safety if DELETE somehow fails after SELECT.
      if (deleteResult.rowCount === 0) {
         const err = new Error('Image not found or access denied during delete operation');
         err.statusCode = 404; // Or 500 if this state is unexpected
         throw err;
      }

      // 3. Delete the actual file from storage
      if (relativeFilepath) {
        // Path is relative to project root e.g. "uploads/filename.png"
        // __dirname is backend/src/routes, so ../../uploads/filename.png
        const absoluteFilepath = path.join(__dirname, '../../', relativeFilepath);
        try {
          if (fs.existsSync(absoluteFilepath)) {
            await fs.promises.unlink(absoluteFilepath);
            console.log(`Successfully deleted file: ${absoluteFilepath}`);
          } else {
            console.warn(`File not found for deletion, but DB record removed: ${absoluteFilepath}`);
          }
        } catch (fileErr) {
          console.error(`Failed to delete file ${absoluteFilepath}:`, fileErr);
          // Not re-throwing, as DB deletion is the primary success indicator for the client.
        }
      }
    });
    // If withTransaction completes without throwing, it means DB operations were successful.
    res.status(200).json({ message: 'Image deleted successfully', deletedImageId: imageId });

  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error(`Error deleting image ${imageId}:`, err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
