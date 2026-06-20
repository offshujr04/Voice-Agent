import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'plugin:import/recommended',
    'prettier',
    'plugin:prettier/recommended'
  ),
  {
    // Accept either LF or CRLF so Windows checkouts (autocrlf) don't fail the
    // build's lint step. eslint-plugin-prettier only honors endOfLine when it's
    // passed as a rule option (it ignores it from .prettierrc).
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // Allow underscore-prefixed identifiers as intentional throwaways
      // (e.g. `const { match: _match, ...rest } = entry`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default eslintConfig;
