import type { AudioEngine } from '@cringe-court/audio';
import { createAudioEngine, memoryStore } from '@cringe-court/audio';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { __setAppAudioForTests } from './audio';
import { SoundButton, SoundSettings } from './SoundSettings';

const AXE = { rules: { 'color-contrast': { enabled: false } } } as const;

/** A real engine with a stub AudioContext, so state is 'locked' and unlock() runs. */
function lockedEngine(): { engine: AudioEngine; play: ReturnType<typeof vi.spyOn> } {
  const ctx = {
    state: 'suspended',
    sampleRate: 44100,
    destination: {},
    resume: async () => {
      ctx.state = 'running';
    },
    createBuffer: () => ({}),
    createBufferSource: () => ({ connect() {}, start() {}, buffer: null }),
  };
  const engine = createAudioEngine({ createContext: () => ctx as never, store: memoryStore(), matchMedia: null });
  const play = vi.spyOn(engine, 'play').mockReturnValue({ stop() {} } as never);
  vi.spyOn(engine, 'unlock').mockImplementation(async () => true);
  return { engine, play };
}

afterEach(() => __setAppAudioForTests(null));

describe('SoundSettings', () => {
  it('has a mute switch, three labelled sliders with live value text and a reduce-sound radio group', async () => {
    const { engine } = lockedEngine();
    __setAppAudioForTests(engine);
    const { container } = renderWithProviders(
      <main>
        <SoundSettings />
      </main>,
    );
    const sw = screen.getByRole('switch', { name: 'Sound on' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(engine.getSnapshot().settings.muted).toBe(true);

    for (const name of ['Master', 'Effects', 'Music']) {
      const slider = screen.getByRole('slider', { name });
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '100');
    }
    const master = screen.getByRole('slider', { name: 'Master' });
    expect(master).toHaveAttribute('aria-valuetext', '80 percent');
    act(() => engine.setVolume('master', 0.3));
    expect(master).toHaveAttribute('aria-valuetext', '30 percent');
    expect(screen.getByText('30%')).toBeInTheDocument();

    const group = screen.getByRole('group', { name: 'Reduce sound' });
    expect(group).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Reduced/ }));
    expect(engine.getSnapshot().settings.reduceSound).toBe('reduced');
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('"Play a test sound" unlocks and plays the gavel', async () => {
    const { engine, play } = lockedEngine();
    __setAppAudioForTests(engine);
    renderWithProviders(<SoundSettings />);
    await userEvent.click(screen.getByRole('button', { name: 'Play a test sound' }));
    expect(engine.unlock).toHaveBeenCalled();
    expect(play).toHaveBeenCalledWith('gavel_strike');
    expect(await screen.findByText('Order in the court!')).toBeInTheDocument();
  });

  it('disables itself where there is no Web Audio', () => {
    __setAppAudioForTests(createAudioEngine({ createContext: null, store: memoryStore() }));
    renderWithProviders(<SoundSettings />);
    expect(screen.getByRole('switch', { name: 'Sound on' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play a test sound' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('SoundButton', () => {
  it('toggles mute on click and opens the settings dialog from its neighbour', async () => {
    const { engine } = lockedEngine();
    __setAppAudioForTests(engine);
    const { container } = renderWithProviders(
      <header>
        <SoundButton />
      </header>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(engine.getSnapshot().settings.muted).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Unmute sound' }));
    expect(engine.getSnapshot().settings.muted).toBe(false);
    expect(await axe(container, AXE)).toHaveNoViolations();

    await userEvent.click(screen.getByRole('button', { name: 'Sound settings' }));
    expect(await screen.findByRole('dialog', { name: 'Sound settings' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Music' })).toBeInTheDocument();
  });

  it('renders nothing where sound is unavailable', () => {
    __setAppAudioForTests(createAudioEngine({ createContext: null, store: memoryStore() }));
    renderWithProviders(<SoundButton />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
