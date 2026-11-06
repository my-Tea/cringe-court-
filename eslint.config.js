import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Only the app and its packages are linted; cc-art, judge and the sprite tools
    // are generator scripts with their own conventions.
    ignores: ['**/dist/**', '**/node_modules/**', 'cc-art/**', 'judge/**', 'sprite-forge/**', 'pixel-art-sprites/**', 'docs/**', 'idea/**', 'contracts/typechain-types/**', 'contracts/artifacts/**', 'contracts/cache/**', 'contracts/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/web/src/**/*.tsx', 'packages/*/src/react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
      // Lists styled with list-style:none keep role="list": Safari/VoiceOver drops their semantics otherwise.
      'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['useMotion', 'useReducedMotion', 'useToast', 'buttonClassName', 'Dialog', 'DialogTrigger', 'DialogClose', 'TooltipProvider', 'ICON_NAMES'] },
      ],
    },
  },
  {
    files: ['**/*.config.{ts,js}', 'apps/web/scripts/**', 'packages/*/scripts/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Browser-driving audit scripts: Node at the top level, page code inside evaluate().
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, axe: 'readonly' } },
  },
);
