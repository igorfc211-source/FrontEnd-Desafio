import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  { ignores: ['dist/**', 'public/mockServiceWorker.js', 'reports/**', 'playwright-report/**', 'test-results/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
])
