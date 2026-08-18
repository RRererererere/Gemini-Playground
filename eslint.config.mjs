import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    // This 4k-line client component exhausts ESLint's heap even in isolation.
    // Keep it covered by typecheck/build until it is split into smaller modules.
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'app/page.tsx'],
  },
  ...nextVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
];
