import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';

describe('Alert', () => {
  it('assertive is role=alert', () => {
    render(<Alert live="assertive" title="Failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('polite is role=status', () => {
    render(<Alert live="polite" title="Saved" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('default has no live role', () => {
    render(<Alert title="FYI">Details</Alert>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('FYI')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        <Alert tone="danger" live="assertive" title="Bad" actions={<button type="button">Retry</button>}>Body</Alert>
        <Alert tone="success" live="polite" title="Good" />
        <Alert title="Note" />
      </div>,
    );
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
