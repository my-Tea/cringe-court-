import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnonymousPortrait, Portrait } from './Portrait';

describe('Portrait', () => {
  it('defaults alt to the character name', () => {
    render(<Portrait character="judge" />);
    expect(screen.getByRole('img', { name: 'Judge Gavel.exe' })).toBeInTheDocument();
  });

  it('allows decorative alt=""', () => {
    const { container } = render(<Portrait character="judge" alt="" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('allows a custom alt', () => {
    render(<Portrait character="clerk" alt="The clerk, smirking" />);
    expect(screen.getByRole('img', { name: 'The clerk, smirking' })).toBeInTheDocument();
  });
});

describe('AnonymousPortrait', () => {
  it('is an img with a label', () => {
    render(<AnonymousPortrait />);
    expect(screen.getByRole('img', { name: 'Anonymous defendant' })).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<AnonymousPortrait label="Defendant, identity hidden" />);
    expect(screen.getByRole('img', { name: 'Defendant, identity hidden' })).toBeInTheDocument();
  });
});
