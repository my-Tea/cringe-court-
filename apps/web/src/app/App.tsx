import { RouterProvider } from 'react-router';
import { MotionProvider, ToastProvider, TooltipProvider } from '@/ds';
import { WorldIdConnectHost } from '@/platform/identity';
import { AudioMotionBridge } from '@/platform/audio';
import { router } from './router';

export function App() {
  return (
    <MotionProvider>
      <AudioMotionBridge />
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          <RouterProvider router={router} />
          <WorldIdConnectHost />
        </ToastProvider>
      </TooltipProvider>
    </MotionProvider>
  );
}
