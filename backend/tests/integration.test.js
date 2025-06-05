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
