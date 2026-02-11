module.exports = {
    env: {
        node: true,
        commonjs: true,
        es2021: true,
        jest: true
    },
    extends: [
        'eslint:recommended',
    ],
    parserOptions: {
        ecmaVersion: 'latest'
    },
    rules: {
        'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
        'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
        'no-undef': 'error',
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'indent': ['error', 4],
        'comma-dangle': ['error', 'never']
    },
    ignorePatterns: [
        'node_modules/',
        'coverage/',
        'dist/',
        'logs/'
    ]
};
