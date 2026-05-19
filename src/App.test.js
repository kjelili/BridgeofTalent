import { render, screen } from '@testing-library/react';
import App from './App';

test('renders BridgeofTalent landing page', () => {
  render(<App />);
  // Brand name appears in several places (nav, hero, footer); use getAllByText.
  const brandMentions = screen.getAllByText(/BridgeofTalent/i);
  expect(brandMentions.length).toBeGreaterThan(0);
});

test('renders the hero headline', () => {
  render(<App />);
  expect(screen.getByText(/Build Your Dream/i)).toBeInTheDocument();
});

test('renders primary calls to action', () => {
  render(<App />);
  // There should be navigation/CTA affordances on the public landing page.
  expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
});
