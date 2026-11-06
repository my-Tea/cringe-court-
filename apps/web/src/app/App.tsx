import { RouterProvider } from 'react-router';
import { MotionProvider, ToastProvider, TooltipProvider } from '@/ds';
import { router } from './router';

export function App() {
  return (
    <MotionProvider>
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </MotionProvider>
  );
}
