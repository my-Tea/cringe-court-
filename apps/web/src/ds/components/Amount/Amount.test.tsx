import { usdc } from '@cringe-court/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Amount } from './Amount';

describe('Amount', () => {
  it('shows the number, the unit and a spoken form', () => {
    const { container } = render(<Amount value={usdc('1.2')} />);
    expect(screen.getByText('1.20')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('1.20 test USDC')).toHaveClass('cc-visually-hidden');
    expect(container).not.toHaveTextContent('+');
  });

  it('credit shows + and is spoken as plus', () => {
    render(<Amount value={usdc('1.20')} direction="credit" />);
    expect(screen.getByText('+1.20')).toBeInTheDocument();
    expect(screen.getByText('plus 1.20 test USDC')).toBeInTheDocument();
  });

  it('debit is spoken as minus', () => {
    render(<Amount value={usdc('0.5')} direction="debit" />);
    expect(screen.getByText('minus 0.50 test USDC')).toBeInTheDocument();
  });
});
