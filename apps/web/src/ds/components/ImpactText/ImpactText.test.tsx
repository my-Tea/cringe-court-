import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImpactText } from './ImpactText';

describe('ImpactText', () => {
  it('renders default text for its kind', () => {
    render(<ImpactText kind="cook" />);
    expect(screen.getByText('Let bro cook')).toBeInTheDocument();
  });

  it('renders overridden text', () => {
    render(<ImpactText>Hold it!</ImpactText>);
    expect(screen.getByText('Hold it!')).toBeInTheDocument();
    expect(screen.queryByText('Objection!')).not.toBeInTheDocument();
  });
});
