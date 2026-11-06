import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stamp } from './Stamp';

describe('Stamp', () => {
  it('renders its text and sub line', () => {
    render(<Stamp tone="guilty" sub="SENTENCE PENDING">GUILTY</Stamp>);
    expect(screen.getByText('GUILTY')).toBeInTheDocument();
    expect(screen.getByText('SENTENCE PENDING')).toBeInTheDocument();
  });
});
