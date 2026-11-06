/** English copy for the `game` namespace: the title screen, the game menu and the frames panels open in. */
export const game = {
  // Title screen
  'title.tagline': 'Your honor, bro is cooked.',
  'title.menu': 'Main menu',
  'title.play': 'Play',
  'title.continue': 'Continue',
  'title.newGame': 'New game',
  'title.newGame.confirm': 'Start over? Your look and chosen trial on this device are cleared. You stay verified.',
  'title.newGame.yes': 'Start over',
  'title.newGame.no': 'Keep my progress',
  'title.howToPlay': 'How to play',
  'title.settings': 'Settings',
  'title.hint': 'Arrow keys to choose, Enter to select',
  'title.testnet': 'Testnet build: every coin is test USDC.',

  // Game menu (pause)
  'menu.open': 'Menu',
  'menu.title': 'Game menu',
  'menu.resume': 'Resume',
  'menu.leaderboard': 'Leaderboard',
  'menu.cases': 'My cases',
  'menu.howToPlay': 'How to play',
  'menu.settings': 'Settings',
  'menu.courts': 'The three courts',
  'menu.quit': 'Quit to title',

  // Panel and scene frames
  'frame.back': 'Back to the game',
  'frame.menu': 'Menu',
  'frame.clerk': 'Clerk of the court',

  // My cases
  'cases.title': 'My cases',
  'cases.lede': 'Every case you filed, joined or sat on, by court.',

  // World
  'world.loading': 'Raising the sky islands…',
  'world.loadingLabel': 'Loading the world',
  'world.error': 'The world could not load. The menus still work.',
  'world.noWebgl': 'This browser has no WebGL2, so the 3D world is off. Every court still works from the menu.',
  'world.enter': 'All rise. The {mode} court is in session.',
} as const;
