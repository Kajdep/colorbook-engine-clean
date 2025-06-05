import { render, screen } from '@testing-library/react';
import App from './App';

// Mock fetch for the /api/auth/me endpoint
global.fetch = jest.fn((url) => {
  if (url === '/api/auth/me' || url === 'http://localhost:3001/api/auth/me') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', token: 'test-token' } }),
    });
  }
  if (url === '/api/auth/logout' || url === 'http://localhost:3001/api/auth/logout') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: 'Logged out' }),
    });
  }
  // For any other fetch calls, you might want to return a generic response or throw an error
  return Promise.reject(new Error(`Unhandled fetch call to ${url}`));
}) as jest.Mock;


test('renders App component without crashing', async () => {
  render(<App />);
  // You can add more specific assertions here if needed
  // For example, checking for a specific text or element
  // Look for an H1 tag that contains the exact text "Colorbook Engine"
  expect(await screen.findByRole('heading', { name: /^Colorbook Engine$/i, level: 1 })).toBeInTheDocument();
});
