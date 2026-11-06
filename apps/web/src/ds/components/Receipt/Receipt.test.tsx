import { caseNumber, usdc, type ReceiptLine } from '@cringe-court/core';
import { screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Receipt } from './Receipt';

const lines: ReceiptLine[] = [
  { kind: 'bond-returned', label: 'Bond returned', amount: usdc('5') },
  { kind: 'reward', label: 'Juror reward', amount: usdc('1.25') },
  { kind: 'fee', label: 'Court fee', amount: usdc('0.5') },
];

describe('Receipt', () => {
  it('lists each line as a term and a definition', () => {
    const { container } = renderWithProviders(<Receipt caseNumber={caseNumber(69)} lines={lines} />);
    expect(container.querySelectorAll('dl dt')).toHaveLength(3);
    expect(container.querySelectorAll('dl dd')).toHaveLength(3);
    expect(screen.getByText('Bond returned')).toBeInTheDocument();
    expect(screen.getByText('plus 5.00 test USDC')).toBeInTheDocument();
    expect(screen.getByText('minus 0.50 test USDC')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Settlement receipt, CASE #0069/ })).toBeInTheDocument();
  });

  it('computes the net total from credits and debits', () => {
    renderWithProviders(<Receipt caseNumber={caseNumber(1)} lines={lines} />);
    const total = screen.getByText('Net').parentElement!;
    expect(within(total).getByText('plus 5.75 test USDC')).toBeInTheDocument();
  });

  it('shows a net loss as a debit', () => {
    renderWithProviders(
      <Receipt caseNumber={caseNumber(1)} lines={[{ kind: 'refund', label: 'Refund', amount: usdc('1') }, { kind: 'forfeit', label: 'Forfeit', amount: usdc('3') }]} />,
    );
    const total = screen.getByText('Net').parentElement!;
    expect(within(total).getByText('minus 2.00 test USDC')).toBeInTheDocument();
  });

  it('explorer link opens safely in a new tab and says so', () => {
    renderWithProviders(<Receipt caseNumber={caseNumber(1)} lines={lines} explorerUrl="https://explorer.example/tx/0x1" />);
    const link = screen.getByRole('link', { name: /View on Arc testnet explorer/ });
    expect(link).toHaveAttribute('href', 'https://explorer.example/tx/0x1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link).toHaveTextContent('(opens in a new tab)');
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<Receipt caseNumber={caseNumber(7)} lines={lines} note="Test money." explorerUrl="https://x.example" />);
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
