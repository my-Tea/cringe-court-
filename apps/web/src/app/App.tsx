import { RouterProvider } from 'react-router';
import { MotionProvider, ToastProvider, TooltipProvider } from '@/ds';
import { WorldIdConnectHost } from '@/platform/identity';
import { AudioMotionBridge } from '@/platform/audio';
import { I18nProvider } from '@/i18n';
import { router } from './router';

export function App() {
  return (
    <I18nProvider>
    <MotionProvider>
      <AudioMotionBridge />
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          <RouterProvider router={router} />
          <WorldIdConnectHost />
        </ToastProvider>
      </TooltipProvider>
    </MotionProvider>
    </I18nProvider>
  );
}
