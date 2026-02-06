import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/', 'out/', '.vite/', 'node_modules/', '*.config.js', '*.config.ts'],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // React recommended rules
  {
    plugins: {
      react,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
    },
  },

  // Global configuration for all files
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },

  // Main process (Node.js)
  {
    files: ['src/main/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Renderer process (Browser)
  {
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Test files
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
