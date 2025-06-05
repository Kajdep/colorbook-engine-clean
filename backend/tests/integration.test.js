process.env.JWT_SECRET = 'testsecret';
process.env.STRIPE_SECRET_KEY = 'sk_test';

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    on: jest.fn()
  }))
}));

jest.mock('../src/database/connection', () => require('./mockDb'));

jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth');
  return {
    ...actual,
    authenticateToken: (req, res, next) => {
      req.user = { id: 1, email: 'test@example.com', subscription_tier: 'pro', subscription_status: 'active' };
      next();
    }
  };
});

const request = require('supertest');
const mockDb = require('./mockDb');
const app = require('./testApp');
const { generateToken } = require('../src/middleware/auth');

afterEach(() => {
  mockDb.reset();
});

describe('API Integration', () => {
  test('registers a user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'Pass1234!' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('a@b.com');
  });

  test('logs in a user', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@test.com', password: 'Pass1234!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Pass1234!' });
    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  test('creates a project', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'proj@test.com', password: 'Pass1234!' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proj@test.com', password: 'Pass1234!' });
    const token = login.body.tokens.accessToken;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My Project' });
    expect(res.status).toBe(201);
    expect(res.body.project.title).toBe('My Project');
  });

  test('monitoring health endpoint', async () => {
    const res = await request(app).get('/api/monitoring/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });

  test('payments plans endpoint', async () => {
    const res = await request(app).get('/api/payments/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toBeDefined();
  });
});

// Workflow test

describe('User workflow', () => {
  test('registration to exporting (404)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'workflow@test.com', password: 'Pass1234!' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'workflow@test.com', password: 'Pass1234!' });
    const token = login.body.tokens.accessToken;

    const proj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Flow Project' });
    expect(proj.status).toBe(201);

    const exportRes = await request(app)
      .post('/api/exports')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: proj.body.project.id });
    expect(exportRes.status).toBe(404);
  });
});

// Image Synchronization Tests
describe('Image Sync', () => {
  let token;

  beforeAll(async () => {
    // Register and login a user to get a token for image operations
    // This user context will be overridden by the authenticateToken mock for req.user,
    // but a token is often still needed if the route explicitly checks for 'Bearer token' format.
    // The mock directly sets req.user, so this token is more for completeness of request format.
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'imageuser@test.com', password: 'Pass1234!' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'imageuser@test.com', password: 'Pass1234!' });
    token = loginRes.body.tokens.accessToken;
  });

  test('uploads an image', async () => {
    const res = await request(app)
      .post('/api/images/upload') // Assuming /api/images/upload is the endpoint
      .set('Authorization', `Bearer ${token}`)
      .field('projectId', 'project123')
      .field('type', 'story_image')
      .attach('image', Buffer.from('fakeimagedata'), 'testimage.png');

    expect(res.status).toBe(201); // Or 200 if it's an update-or-create
    expect(res.body.image).toBeDefined();
    expect(res.body.image.id).toBeDefined();
    expect(res.body.image.url).toMatch(/testimage.png$/); // Or whatever the backend names it
    expect(res.body.image.projectId).toBe('project123');
    // Further check if mockDb.query was called for an INSERT if possible/needed
  });

  test('deletes an image', async () => {
    // Mock that an image exists for deletion
    // For this test, we'll assume an image with ID 'imageToDelete123' exists
    // or that the backend doesn't strictly check for existence before attempting delete for this mock scenario
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'imageToDelete123' }] }); // Mock DB find for the image
    mockDb.query.mockResolvedValueOnce({ rowCount: 1 }); // Mock DB delete success

    const imageIdToDelete = 'imageToDelete123';
    const res = await request(app)
      .delete(`/api/images/${imageIdToDelete}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200); // Or 204
    expect(res.body.message).toBe('Image deleted successfully'); // Or similar
     // Further check if mockDb.query was called for a DELETE
  });
});

// Drawing Synchronization Tests
describe('Drawing Sync', () => {
  let token;
  const drawingData = {
    projectId: 'proj789',
    canvasData: 'base64dummydataforcanvas',
    metadata: { version: 1, lines: 10 }
  };
  let createdDrawingId;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'drawinguser@test.com', password: 'Pass1234!' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'drawinguser@test.com', password: 'Pass1234!' });
    token = loginRes.body.tokens.accessToken;
  });

  test('saves a new drawing', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'drawing123', ...drawingData }] });
    const res = await request(app)
      .post('/api/drawings')
      .set('Authorization', `Bearer ${token}`)
      .send(drawingData);

    expect(res.status).toBe(201);
    expect(res.body.drawing).toBeDefined();
    expect(res.body.drawing.id).toBeDefined();
    createdDrawingId = res.body.drawing.id;
    expect(res.body.drawing.canvasData).toBe(drawingData.canvasData);
  });

  test('updates an existing drawing', async () => {
    const updatedCanvasData = 'updatedbase64dummydata';
    // Assume createdDrawingId is available from the 'saves a new drawing' test
    // or create one here if tests are independent
    const drawingToUpdateId = createdDrawingId || 'drawing123';
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: drawingToUpdateId, ...drawingData, canvasData: updatedCanvasData }] });


    const res = await request(app)
      .put(`/api/drawings/${drawingToUpdateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ canvasData: updatedCanvasData });

    expect(res.status).toBe(200);
    expect(res.body.drawing).toBeDefined();
    expect(res.body.drawing.id).toBe(drawingToUpdateId);
    expect(res.body.drawing.canvasData).toBe(updatedCanvasData);
  });

  test('deletes a drawing', async () => {
    const drawingToDeleteId = createdDrawingId || 'drawing123';
    mockDb.query.mockResolvedValueOnce({ rowCount: 1 }); // Mock DB delete success

    const res = await request(app)
      .delete(`/api/drawings/${drawingToDeleteId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200); // Or 204
    expect(res.body.message).toBe('Drawing deleted successfully'); // Or similar
  });
});

// User Settings (API Settings) Synchronization Tests
describe('User Settings Sync', () => {
  let token;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'settingsuser@test.com', password: 'Pass1234!' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'settingsuser@test.com', password: 'Pass1234!' });
    token = loginRes.body.tokens.accessToken;
  });

  const initialSettings = { someSetting: 'initialValue', apiConfig: { key: 'oldkey', model: 'gpt-3' } };
  const updatedSettings = { someSetting: 'updatedValue', apiConfig: { key: 'newkey', model: 'gpt-4' } };

  test('updates user settings', async () => {
    // Mock the DB update call if the route handler interacts with the DB for settings
    // For this example, assume the route handler returns the updated settings directly or fetches them after update.
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(updatedSettings) }] }); // Mocking user fetch with new settings

    const res = await request(app)
      .put('/api/users/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(updatedSettings);

    expect(res.status).toBe(200);
    expect(res.body.settings).toBeDefined();
    expect(res.body.settings.apiConfig.key).toBe('newkey');
    expect(res.body.settings.apiConfig.model).toBe('gpt-4');
  });

  test('gets user settings', async () => {
     // Mock the DB call that fetches user settings
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(updatedSettings) }] }); // User has updatedSettings

    const res = await request(app)
      .get('/api/users/me/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.settings).toBeDefined();
    expect(res.body.settings.apiConfig.key).toBe('newkey'); // Assuming settings were updated in a previous step or test
  });
});

// Story Synchronization Tests (Basic Structure)
describe('Story Sync', () => {
  let token;
  const storyData = {
    projectId: 'proj123',
    title: 'My Awesome Story',
    content: [{ type: 'paragraph', text: 'Once upon a time...' }],
    pages: 3
  };
  let createdStoryId;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'storyuser@test.com', password: 'Pass1234!' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'storyuser@test.com', password: 'Pass1234!' });
    token = loginRes.body.tokens.accessToken;
  });

  test('creates a new story', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'story987', ...storyData }] });
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${token}`)
      .send(storyData);

    expect(res.status).toBe(201);
    expect(res.body.story).toBeDefined();
    expect(res.body.story.id).toBeDefined();
    createdStoryId = res.body.story.id;
    expect(res.body.story.title).toBe(storyData.title);
  });

  test('updates an existing story', async () => {
    const updatedTitle = "My Even More Awesome Story";
    const storyToUpdateId = createdStoryId || 'story987';
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: storyToUpdateId, ...storyData, title: updatedTitle }] });

    const res = await request(app)
      .put(`/api/stories/${storyToUpdateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: updatedTitle });

    expect(res.status).toBe(200);
    expect(res.body.story).toBeDefined();
    expect(res.body.story.id).toBe(storyToUpdateId);
    expect(res.body.story.title).toBe(updatedTitle);
  });

  test('deletes a story', async () => {
    const storyToDeleteId = createdStoryId || 'story987';
    mockDb.query.mockResolvedValueOnce({ rowCount: 1 }); // Mock DB delete success

    const res = await request(app)
      .delete(`/api/stories/${storyToDeleteId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200); // Or 204
    expect(res.body.message).toBe('Story deleted successfully'); // Or similar
  });
});
