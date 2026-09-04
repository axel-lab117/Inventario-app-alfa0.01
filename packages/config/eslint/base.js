module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: ['./tsconfig.json', './tsconfig.*.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'tailwindcss'],
  settings: {
    react: {
      version: '18.2',
    },
    tailwindcss: {
      config: 'tailwind.config.ts',
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'tailwindcss/no-custom-classname': 'warn',
    'tailwindcss/enforce-consistent-ordering': 'warn',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', '.next/', '*.config.*'],
};