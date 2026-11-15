import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

const TS = '{ts,tsx,mts,cts}'
const IMPORTS = 'Import through #web from the package.json imports field.'

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'public/', 'test-results/', 'playwright-report/'] },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    rules: { 'no-console': 'error' },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vite.config.ts'],
          defaultProject: 'tsconfig.node.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { URL: 'readonly', fetch: 'readonly', AbortSignal: 'readonly' } },
  },
  {
    files: [`src/**/*.${TS}`],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: '^[./]', message: IMPORTS }] }],
    },
  },
  {
    files: [`src/**/*.${TS}`],
    extends: [reactHooks.configs.flat['recommended-latest']],
  },
)
