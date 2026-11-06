import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/render';
import { DemoCourtPage } from './DemoCourtPage';

describe('DemoCourtPage', () => {
  it('renders the docket and jury choices, and degrades to an error without WebGL/assets', async () => {
    const { container } = renderWithProviders(<DemoCourtPage />, { route: '/courtroom' });
    expect(screen.getByRole('heading', { level: 1, name: 'Demo court' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Replied-all with a frog meme/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /Mistrial/ }));
    expect(screen.getByRole('radio', { name: /Mistrial/ })).toBeChecked();
    // jsdom cannot fetch the file:// assets, so the courtroom reports an error instead of hanging.
    await waitFor(() => expect(screen.getByText('The courtroom could not load')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Call the court to order/ })).toHaveAttribute('aria-disabled', 'true');
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
