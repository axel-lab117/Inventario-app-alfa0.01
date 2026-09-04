const base = require('./base');

module.exports = {
  ...base,
  extends: [
    ...base.extends,
    'plugin:@next/next/recommended',
  ],
  plugins: [...base.plugins, '@next'],
  rules: {
    ...base.rules,
    '@next/next/no-html-link-for-pages': 'off',
    '@next/next/no-img-element': 'warn',
  },
};