import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('renders an article with a heading and has no axe violations', async () => {
    const { container } = render(
      <main>
        <Card>
          <CardHeader eyebrow="Case #0001">
            <CardTitle as="h2">Who ate the leftovers</CardTitle>
            <CardDescription>A grave matter.</CardDescription>
          </CardHeader>
          <CardBody>Details</CardBody>
        </Card>
      </main>,
    );
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Who ate the leftovers' })).toBeInTheDocument();
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
