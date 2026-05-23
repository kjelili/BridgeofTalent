import { render, screen } from '@testing-library/react';

// Mock the Supabase client so tests don't construct a real connection and
// don't require live credentials in CI. We expose just the surface App.js
// touches at startup.
jest.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: { message: 'mock' } }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'mock' } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'mock' } }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
  fetchProfile: () => Promise.reject(new Error('mock')),
}));

// IntersectionObserver isn't implemented in jsdom; stub it for any
// component that uses it (lazy lists, animations on scroll, etc).
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Import App AFTER the mock is set up.
// eslint-disable-next-line import/first
const App = require('./App').default;

test('renders BridgeofTalent landing page', () => {
  render(<App />);
  const brandMentions = screen.getAllByText(/BridgeofTalent/i);
  expect(brandMentions.length).toBeGreaterThan(0);
});

test('renders the hero headline', () => {
  render(<App />);
  expect(screen.getByText(/Build Your Dream/i)).toBeInTheDocument();
});

test('renders primary calls to action', () => {
  render(<App />);
  expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
});
