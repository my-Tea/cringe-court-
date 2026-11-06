import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, TestnetBadge } from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge tone="success">Live</Badge>);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});

describe('TestnetBadge', () => {
  it('carries a visually hidden explanation for assistive tech', () => {
    const { container } = render(<TestnetBadge />);
    expect(screen.getByText(/Testnet/)).toBeInTheDocument();
    expect(container).toHaveTextContent('test USDC only');
    expect(screen.getByText(/test USDC only/)).toHaveClass('cc-visually-hidden');
  });
});
