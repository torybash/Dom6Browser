import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // src/data/legacy is a mechanical port of upstream code; it is checked by `npm run lint:legacy`
  { ignores: ['dist', 'vendor', 'public', 'node_modules', 'src/data/legacy/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': hooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...hooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-prototype-builtins': 'off',
    },
  },
  { files: ['**/*.mjs', 'scripts/**', 'tests/**'], languageOptions: { globals: globals.node } },
);
