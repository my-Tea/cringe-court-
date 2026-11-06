import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ModeFacts } from './ModeFacts';

/** UX evaluation §4.10: the landing listed only the live windows; the playable demo uses shorter ones. */
describe('ModeFacts deadlines', () => {
  it('shows the live windows and the demo court’s own windows, labelled', () => {
    renderWithProviders(<ModeFacts id="solo" detailed />);
    expect(screen.getByText('Deadlines (live cases)').nextElementSibling).toHaveTextContent('30 min jury · 20 min seal · 10 min reveal');
    expect(screen.getByText('Deadlines (this demo court)').nextElementSibling).toHaveTextContent('5 min jury · 15 min seal · 5 min reveal');
  });

  it('labels each mode’s demo windows from its own definition', () => {
    renderWithProviders(<ModeFacts id="versus" detailed />);
    expect(screen.getByText('Deadlines (this demo court)').nextElementSibling).toHaveTextContent('15 min consent · 10 min jury · 6 min seal · 2 min reveal');
  });
});
