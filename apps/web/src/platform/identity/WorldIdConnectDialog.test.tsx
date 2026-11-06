import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toDataURL } from 'qrcode';
import { describe, expect, it, vi } from 'vitest';
import { WorldIdConnectDialog } from './WorldIdConnectDialog';

vi.mock('qrcode', () => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,AAAA') }));

const URI = 'https://world.org/verify?t=1';

describe('WorldIdConnectDialog', () => {
  it('shows a QR code of the link, not the link, and cancels', async () => {
    const onCancel = vi.fn();
    render(<WorldIdConnectDialog uri={URI} onCancel={onCancel} />);
    const qr = await screen.findByRole('img', { name: /Scan it with your phone/ });
    expect(qr).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));
    expect(toDataURL).toHaveBeenCalledWith(URI, expect.anything());
    expect(screen.queryByText(URI)).toBeNull();
    expect(screen.queryByRole('button', { name: /Copy/ })).toBeNull();
    expect(screen.getAllByText(/Waiting for World App/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('opens World App directly for someone already on their phone', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<WorldIdConnectDialog uri={URI} onCancel={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Open World App/ }));
    expect(open).toHaveBeenCalledWith(URI, '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('renders nothing while there is no request', () => {
    render(<WorldIdConnectDialog uri={null} onCancel={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
