import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorldIdConnectDialog } from './WorldIdConnectDialog';

describe('WorldIdConnectDialog', () => {
  it('shows the link, waiting status and honest QR note, and cancels', async () => {
    const onCancel = vi.fn();
    render(<WorldIdConnectDialog uri="https://world.org/verify?t=1" onCancel={onCancel} />);
    expect(screen.getByTestId('world-id-link')).toHaveTextContent('https://world.org/verify?t=1');
    expect(screen.getByText(/Waiting for World App/)).toBeInTheDocument();
    expect(screen.getByText(/does not render a QR code/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in World App' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
  it('renders nothing while there is no request', () => {
    render(<WorldIdConnectDialog uri={null} onCancel={() => undefined} />);
    expect(screen.queryByTestId('world-id-link')).toBeNull();
  });
});
