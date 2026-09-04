const base = require('./base');

module.exports = {
  ...base,
  env: {
    ...base.env,
    jest: true,
  },
  extends: [
    ...base.extends,
    'plugin:@typescript-eslint/recommended-type-checked',
  ],
  parserOptions: {
    ...base.parserOptions,
    project: ['./tsconfig.json', './tsconfig.build.json'],
  },
  rules: {
    ...base.rules,
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
  },
};