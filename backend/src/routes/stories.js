const express = require('express');
const Joi = require('joi');
const { query, withTransaction } = require('../database/connection');
const { validateRequest } = require('../middleware/validation');
// Assuming authenticateToken is applied globally or at a higher router level

const router = express.Router();

// Joi schema for story page (used in create and update)
const storyPageSchema = Joi.object({
  pageNumber: Joi.number().integer().min(1).required(),
  story: Joi.string().allow('').required(),
  imagePrompt: Joi.string().trim().allow('').optional(),
  wordCount: Joi.number().integer().min(0).optional(),
  imageGenerated: Joi.boolean().optional().default(false),
  imageData: Joi.string().trim().allow('').optional()
});

// Joi schema for creating a story
const createStorySchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  title: Joi.string().trim().max(255).required(),
  content: Joi.string().allow('').optional(),
  metadata: Joi.object().optional().default({}),
  story_pages: Joi.array().items(storyPageSchema).optional().default([])
});

// Joi schema for updating a story
const updateStorySchema = Joi.object({
  title: Joi.string().trim().max(255).optional(),
  content: Joi.string().allow('').optional(),
  metadata: Joi.object().optional(),
  story_pages: Joi.array().items(storyPageSchema).optional() // If provided, it's a full replacement
}).min(1); // Requires at least one field to be present for an update

// Joi schema for getting stories by projectId (query parameter)
const getProjectStoriesSchema = Joi.object({
  projectId: Joi.string().uuid().required()
});

// Joi schema for getting/updating/deleting a story by ID (path parameter)
const storyIdSchema = Joi.object({
  id: Joi.string().uuid().required()
});

// Create a new story
router.post('/', validateRequest(createStorySchema), async (req, res) => {
  const { projectId, title, content, metadata, story_pages } = req.body;
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const result = await query(
      `INSERT INTO stories (user_id, project_id, title, content, story_pages, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, project_id, title, content, story_pages, metadata, version, created_at, updated_at`,
      [
        userId,
        projectId,
        title,
        content,
        JSON.stringify(story_pages),
        JSON.stringify(metadata)
      ]
    );

    const newStory = result.rows[0];
    res.status(201).json(newStory);
  } catch (error) {
    console.error('Error creating story:', error);
    if (error.code === '23503') {
        if (error.constraint === 'stories_project_id_fkey') {
            return res.status(400).json({ error: `Project with ID ${projectId} not found.` });
        }
    }
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Get all stories for a specific project (and authenticated user)
router.get('/', validateRequest(getProjectStoriesSchema, 'query'), async (req, res) => {
  const { projectId } = req.query;
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const result = await query(
      `SELECT id, user_id, project_id, title, content, story_pages, metadata, version, created_at, updated_at
       FROM stories
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [projectId, userId]
    );

    const stories = result.rows.map(story => ({
      ...story,
      story_pages: typeof story.story_pages === 'string' ? JSON.parse(story.story_pages) : story.story_pages,
      metadata: typeof story.metadata === 'string' ? JSON.parse(story.metadata) : story.metadata,
    }));

    res.json({ stories });
  } catch (error) {
    console.error('Error fetching stories for project:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Get a specific story by ID
router.get('/:id', validateRequest(storyIdSchema, 'params'), async (req, res) => {
  const { id: storyId } = req.params;
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const result = await query(
      `SELECT id, user_id, project_id, title, content, story_pages, metadata, version, created_at, updated_at
       FROM stories
       WHERE id = $1 AND user_id = $2`,
      [storyId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found or access denied' });
    }

    let story = result.rows[0];
    story = {
      ...story,
      story_pages: typeof story.story_pages === 'string' ? JSON.parse(story.story_pages) : story.story_pages,
      metadata: typeof story.metadata === 'string' ? JSON.parse(story.metadata) : story.metadata,
    };

    res.json({ story });
  } catch (error) {
    console.error(`Error fetching story ${storyId}:`, error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Update a specific story by ID
router.put('/:id', validateRequest(storyIdSchema, 'params'), validateRequest(updateStorySchema, 'body'), async (req, res) => {
  const { id: storyId } = req.params;
  const userId = req.user.id;
  const updates = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const setClauses = [];
  const values = [];
  let valueCount = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${valueCount++}`);
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    setClauses.push(`content = $${valueCount++}`);
    values.push(updates.content);
  }
  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${valueCount++}`);
    values.push(JSON.stringify(updates.metadata));
  }
  if (updates.story_pages !== undefined) {
    setClauses.push(`story_pages = $${valueCount++}`);
    values.push(JSON.stringify(updates.story_pages));
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  setClauses.push('version = version + 1');

  values.push(storyId);
  values.push(userId);

  const updateQuery = `
    UPDATE stories
    SET ${setClauses.join(', ')}
    WHERE id = $${valueCount++} AND user_id = $${valueCount++}
    RETURNING id, user_id, project_id, title, content, story_pages, metadata, version, created_at, updated_at`;

  try {
    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found or access denied' });
    }

    let updatedStory = result.rows[0];
    updatedStory = {
        ...updatedStory,
        story_pages: typeof updatedStory.story_pages === 'string' ? JSON.parse(updatedStory.story_pages) : updatedStory.story_pages,
        metadata: typeof updatedStory.metadata === 'string' ? JSON.parse(updatedStory.metadata) : updatedStory.metadata,
    };

    res.json({ story: updatedStory });
  } catch (error) {
    console.error(`Error updating story ${storyId}:`, error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete a specific story by ID
router.delete('/:id', validateRequest(storyIdSchema, 'params'), async (req, res) => {
  const { id: storyId } = req.params;
  const userId = req.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const result = await query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING id',
      [storyId, userId]
    );

    if (result.rows.length === 0) { // Or result.rowCount === 0 depending on driver
      return res.status(404).json({ error: 'Story not found or access denied' });
    }

    res.status(200).json({ message: 'Story deleted successfully', deletedStoryId: result.rows[0].id });
    // Or for 204 No Content:
    // res.status(204).send();
  } catch (error) {
    console.error(`Error deleting story ${storyId}:`, error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
