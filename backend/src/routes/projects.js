const express = require('express');
const { query, withTransaction } = require('../database/connection');
const { validateRequest } = require('../middleware/validation');
const { checkUsageLimits, requireSubscription } = require('../middleware/payment');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createProjectSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string().max(100).optional(),
  targetAgeMin: Joi.number().integer().min(2).max(18).optional(),
  targetAgeMax: Joi.number().integer().min(2).max(18).optional(),
  pages: Joi.array().default([]),
  settings: Joi.object().default({}),
  metadata: Joi.object().default({})
});

const updateProjectSchema = Joi.object({
  title: Joi.string().max(255).optional(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string().max(100).optional(),
  targetAgeMin: Joi.number().integer().min(2).max(18).optional(),
  targetAgeMax: Joi.number().integer().min(2).max(18).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
  pages: Joi.array().optional(),
  settings: Joi.object().optional(),
  metadata: Joi.object().optional()
});

// Get all projects for user
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, sortBy = 'updated_at', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    // Build query conditions
    let whereConditions = ['user_id = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
    }

    if (category) {
      paramCount++;
      whereConditions.push(`category = $${paramCount}`);
      queryParams.push(category);
    }

    const whereClause = whereConditions.join(' AND ');
    const orderClause = `ORDER BY ${sortBy} ${sortOrder}`;

    // Get projects with pagination
    const projectsResult = await query(`
      SELECT 
        id, title, description, category, target_age_min, target_age_max,
        status, pages, settings, metadata, created_at, updated_at, 
        published_at, version, file_size
      FROM projects 
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM projects WHERE ${whereClause}
    `, queryParams);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      projects: projectsResult.rows.map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        category: project.category,
        targetAgeMin: project.target_age_min,
        targetAgeMax: project.target_age_max,
        status: project.status,
        pages: project.pages,
        settings: project.settings,
        metadata: project.metadata,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        publishedAt: project.published_at,
        version: project.version,
        fileSize: project.file_size
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve projects'
    });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const projectResult = await query(`
      SELECT 
        id, title, description, category, target_age_min, target_age_max,
        status, pages, settings, metadata, created_at, updated_at, 
        published_at, version, file_size
      FROM projects 
      WHERE id = $1 AND user_id = $2
    `, [id, req.user.id]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    const project = projectResult.rows[0];

    res.json({
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        category: project.category,
        targetAgeMin: project.target_age_min,
        targetAgeMax: project.target_age_max,
        status: project.status,
        pages: project.pages,
        settings: project.settings,
        metadata: project.metadata,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        publishedAt: project.published_at,
        version: project.version,
        fileSize: project.file_size
      }
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve project'
    });
  }
});

// Create new project
router.post('/', checkUsageLimits('projects'), validateRequest(createProjectSchema), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      targetAgeMin,
      targetAgeMax,
      pages,
      settings,
      metadata
    } = req.body;

    const result = await withTransaction(async (client) => {
      // Create project
      const projectResult = await client.query(`
        INSERT INTO projects (
          user_id, title, description, category, target_age_min, target_age_max,
          pages, settings, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        req.user.id, title, description, category, targetAgeMin, targetAgeMax,
        JSON.stringify(pages), JSON.stringify(settings), JSON.stringify(metadata)
      ]);

      const project = projectResult.rows[0];

      // Log project creation
      await client.query(
        'INSERT INTO usage_logs (user_id, action_type, resource_id, metadata) VALUES ($1, $2, $3, $4)',
        [req.user.id, 'project_created', project.id, { title, category }]
      );

      return project;
    });

    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: result.id,
        title: result.title,
        description: result.description,
        category: result.category,
        targetAgeMin: result.target_age_min,
        targetAgeMax: result.target_age_max,
        status: result.status,
        pages: result.pages,
        settings: result.settings,
        metadata: result.metadata,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        version: result.version
      }
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create project'
    });
  }
});

// Update project
router.put('/:id', validateRequest(updateProjectSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const updateFields = [];
    const queryParams = [id, req.user.id];
    let paramCount = 2;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        paramCount++;
        
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (['pages', 'settings', 'metadata'].includes(key)) {
          updateFields.push(`${dbField} = $${paramCount}`);
          queryParams.push(JSON.stringify(updates[key]));
        } else {
          updateFields.push(`${dbField} = $${paramCount}`);
          queryParams.push(updates[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateFields.push('version = version + 1');

    const updateQuery = `
      UPDATE projects 
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    const project = result.rows[0];

    // Log project update
    await query(
      'INSERT INTO usage_logs (user_id, action_type, resource_id, metadata) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'project_updated', project.id, { updatedFields: Object.keys(updates) }]
    );

    res.json({
      message: 'Project updated successfully',
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        category: project.category,
        targetAgeMin: project.target_age_min,
        targetAgeMax: project.target_age_max,
        status: project.status,
        pages: project.pages,
        settings: project.settings,
        metadata: project.metadata,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        version: project.version
      }
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update project'
    });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      // Check if project exists and belongs to user
      const projectResult = await client.query(
        'SELECT id, title FROM projects WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      const project = projectResult.rows[0];

      // Delete project (cascades to related data)
      await client.query('DELETE FROM projects WHERE id = $1', [id]);

      // Log project deletion
      await client.query(
        'INSERT INTO usage_logs (user_id, action_type, resource_id, metadata) VALUES ($1, $2, $3, $4)',
        [req.user.id, 'project_deleted', id, { title: project.title }]
      );

      return project;
    });

    res.json({
      message: 'Project deleted successfully',
      deletedProject: {
        id: result.id,
        title: result.title
      }
    });

  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    console.error('Delete project error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete project'
    });
  }
});

// Duplicate project
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const result = await withTransaction(async (client) => {
      // Get original project
      const originalResult = await client.query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (originalResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      const original = originalResult.rows[0];

      // Create duplicate
      const duplicateResult = await client.query(`
        INSERT INTO projects (
          user_id, title, description, category, target_age_min, target_age_max,
          pages, settings, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        req.user.id,
        title || `${original.title} (Copy)`,
        original.description,
        original.category,
        original.target_age_min,
        original.target_age_max,
        original.pages,
        original.settings,
        original.metadata
      ]);

      const duplicate = duplicateResult.rows[0];

      // Log project duplication
      await client.query(
        'INSERT INTO usage_logs (user_id, action_type, resource_id, metadata) VALUES ($1, $2, $3, $4)',
        [req.user.id, 'project_duplicated', duplicate.id, { originalId: id, originalTitle: original.title }]
      );

      return duplicate;
    });

    res.status(201).json({
      message: 'Project duplicated successfully',
      project: {
        id: result.id,
        title: result.title,
        description: result.description,
        category: result.category,
        targetAgeMin: result.target_age_min,
        targetAgeMax: result.target_age_max,
        status: result.status,
        pages: result.pages,
        settings: result.settings,
        metadata: result.metadata,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        version: result.version
      }
    });

  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    console.error('Duplicate project error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to duplicate project'
    });
  }
});

module.exports = router;