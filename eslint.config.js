import eslint from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'

export default [
  { ignores: ['dist', 'node_modules', 'android', 'ios', 'coverage'] },
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', extraFileExtensions: ['.vue'] },
    },
    plugins: { '@typescript-eslint': tseslint, vue },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
