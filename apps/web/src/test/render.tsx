import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { MotionProvider } from '../ds/motion/MotionProvider';
import { ToastProvider } from '../ds/components/Toast/Toast';
import { TooltipProvider } from '../ds/components/Tooltip/Tooltip';

/** Render inside every provider the app has, at an optional route. */
export function renderWithProviders(ui: ReactElement, { route = '/', ...options }: RenderOptions & { route?: string } = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <MotionProvider>
          <TooltipProvider delayDuration={0}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </MotionProvider>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
