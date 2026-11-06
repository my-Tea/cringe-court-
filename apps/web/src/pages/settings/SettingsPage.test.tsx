import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { I18nProvider } from '@/i18n';
import { setActiveLocale } from '@/i18n/runtime';
import { renderWithProviders } from '@/test/render';
import { readPlatformConfig } from '@/platform/config';
import { ConnectionsPanel } from './ConnectionsPanel';
import { DemoDataPanel } from './DemoDataPanel';
import { SettingsPage } from './SettingsPage';

// Color contrast needs real layout; jsdom has none.
const AXE = { rules: { 'color-contrast': { enabled: false } } };

describe('Settings page', () => {
  beforeEach(() => localStorage.clear());

  it('has sound, motion, court connections and demo data sections, with no axe violations', async () => {
    const { container } = renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    for (const name of ['Sound', 'Motion', 'Court connections', 'Demo data']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('switch', { name: /Reduce motion/ })).toBeInTheDocument();
    // The demo ledger is read through the real adapter: every mode's on-chain terms match the app's.
    const table = await screen.findByRole('table', { name: /Terms on the ledger/ }, { timeout: 5000 });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(within(row).getByText('Matches')).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('shows the fallback warning and the Arc details for a configured deploy', async () => {
    const half = readPlatformConfig({ VITE_LEDGER: 'arc-testnet', VITE_ARC_COURT: '0x1234' });
    renderWithProviders(<ConnectionsPanel config={half} />);
    expect(screen.getByText(/VITE_ARC_COURT, VITE_ARC_USDC, VITE_ARC_REGISTRY are missing/)).toBeInTheDocument();
    expect(screen.getByText('Demo twin')).toBeInTheDocument();
    expect(screen.getByText('Mock World ID')).toBeInTheDocument();
  });

  it('resets demo cases after confirmation and keeps preferences', async () => {
    localStorage.setItem('cc:solo:docket', '[]');
    localStorage.setItem('cc:audio', '{"muted":true}');
    const onCleared = vi.fn();
    renderWithProviders(<DemoDataPanel onCleared={onCleared} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset demo court' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reset everything' }));
    expect(onCleared).toHaveBeenCalledOnce();
    expect(localStorage.getItem('cc:solo:docket')).toBeNull();
    expect(localStorage.getItem('cc:audio')).toBe('{"muted":true}');
  });
});

describe('Language setting', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    setActiveLocale('en');
  });

  it('offers English and the pseudo-locale, and switches the whole page', async () => {
    const { container } = renderWithProviders(
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^English/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /Pseudo-locale \(testing\)/ }));
    expect(localStorage.getItem('cc:locale')).toBe('en-XA');
    // Everything re-renders against the pseudo catalog: the English heading is gone.
    expect(screen.queryByRole('heading', { level: 2, name: 'Language' })).not.toBeInTheDocument();
    expect(container.querySelector('input[value="en-XA"]')).toBeChecked();
    expect(container.querySelector('input[value="en"]')).not.toBeChecked();
  });
});

describe('readPlatformConfig', () => {
  it('defaults to the demo adapters', () => {
    expect(readPlatformConfig({})).toEqual({ ledger: 'demo', arc: null, identity: 'mock', world: null, backend: null, warnings: [] });
  });

  it('takes a court server URL, and says so when it is not one', () => {
    expect(readPlatformConfig({ VITE_BACKEND_URL: 'http://localhost:8787/' }).backend).toEqual({ url: 'http://localhost:8787' });
    const bad = readPlatformConfig({ VITE_BACKEND_URL: 'localhost:8787' });
    expect(bad.backend).toBeNull();
    expect(bad.warnings[0]).toEqual({ key: 'backend.config.invalid', params: { value: 'localhost:8787' } });
  });

  it('accepts a complete Arc testnet and World ID config', () => {
    const a = '0x' + '1'.repeat(40);
    const c = readPlatformConfig({
      VITE_LEDGER: 'arc-testnet',
      VITE_ARC_COURT: a,
      VITE_ARC_USDC: a,
      VITE_ARC_REGISTRY: a,
      VITE_IDENTITY: 'world-idkit',
      VITE_WORLD_APP_ID: 'app_staging_123',
      VITE_WORLD_BACKEND_URL: 'https://verify.example/',
    });
    expect(c.ledger).toBe('arc-testnet');
    expect(c.arc?.chainId).toBe(5042002);
    expect(c.world).toEqual({ appId: 'app_staging_123', backendUrl: 'https://verify.example' });
    expect(c.warnings).toEqual([]);
  });

  it('rejects unknown kinds with a warning', () => {
    expect(readPlatformConfig({ VITE_LEDGER: 'mainnet' }).warnings[0]).toEqual({ key: 'shell.config.unknownLedger', params: { value: 'mainnet' } });
  });
});
