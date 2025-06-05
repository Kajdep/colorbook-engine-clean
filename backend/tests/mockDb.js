const users = [];
let userId = 1;
const projects = [];
let projectId = 1;

const query = jest.fn(async (text, params) => {
  // user existence check
  if (/SELECT id FROM users WHERE email/.test(text)) {
    const user = users.find(u => u.email === params[0] || u.username === params[1]);
    return { rows: user ? [user] : [] };
  }
  // insert user
  if (/INSERT INTO users/.test(text)) {
    const newUser = {
      id: userId++,
      email: params[0],
      password_hash: params[1],
      username: params[2],
      first_name: params[3],
      last_name: params[4],
      subscription_tier: 'free',
      subscription_status: 'active',
      created_at: new Date()
    };
    users.push(newUser);
    return { rows: [newUser] };
  }
  // login fetch
  if (/SELECT id, email, username, password_hash/.test(text)) {
    const user = users.find(u => u.email === params[0]);
    return { rows: user ? [user] : [] };
  }
  if (/SELECT id, email, username, subscription_tier/.test(text)) {
    const user = users.find(u => u.id === params[0]);
    return { rows: user ? [user] : [] };
  }
  if (/SELECT subscription_tier, subscription_status, subscription_expires_at FROM users/.test(text)) {
    const user = users.find(u => u.id === params[0]);
    return { rows: user ? [user] : [] };
  }
  if (/INSERT INTO usage_logs/.test(text)) {
    return { rows: [] };
  }
  if (/UPDATE users SET last_login_at/.test(text)) {
    return { rows: [] };
  }
  // project insert
  if (/INSERT INTO projects/.test(text)) {
    const project = {
      id: projectId++,
      user_id: params[0],
      title: params[1],
      description: params[2],
      category: params[3],
      target_age_min: params[4],
      target_age_max: params[5],
      pages: JSON.parse(params[6] || '[]'),
      settings: JSON.parse(params[7] || '{}'),
      metadata: JSON.parse(params[8] || '{}'),
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date(),
      version: 1
    };
    projects.push(project);
    return { rows: [project] };
  }
  if (/SELECT COUNT\(\*\) as count FROM projects/.test(text)) {
    return { rows: [{ count: projects.length }] };
  }
  return { rows: [] };
});

const withTransaction = jest.fn(async (cb) => {
  const client = { query };
  return cb(client);
});

const reset = () => {
  users.length = 0;
  projects.length = 0;
  userId = 1;
  projectId = 1;
  query.mockClear();
  withTransaction.mockClear();
};

module.exports = {
  query,
  withTransaction,
  pool: { query },
  migrate: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  reset,
  _state: { users, projects }
};
