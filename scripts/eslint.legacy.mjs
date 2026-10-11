// Strict-mode safety check for the ported legacy modules: ES modules run in strict mode, so any
// implicit global assignment from the sloppy-mode upstream code would throw at runtime.
// Usage: npm run lint:legacy
import tseslint from 'typescript-eslint';
export default [
  { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser, sourceType: 'module', globals: { console: 'readonly', Math: 'readonly', JSON: 'readonly', String: 'readonly', parseInt: 'readonly', parseFloat: 'readonly', isNaN: 'readonly', Object: 'readonly', Array: 'readonly', Number: 'readonly', RegExp: 'readonly', Error: 'readonly', Function: 'readonly', BigInt: 'readonly', Infinity: 'readonly', undefined: 'readonly', isFinite: 'readonly', Date: 'readonly', Set: 'readonly', Map: 'readonly', encodeURIComponent: 'readonly' } },
    rules: { 'no-undef': 'error', 'no-dupe-keys': 'error', 'no-redeclare': 'off' } },
];
