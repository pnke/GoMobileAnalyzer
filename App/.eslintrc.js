module.exports = {
    extends: ['expo', 'plugin:jsx-a11y/recommended'],
    plugins: ['jsx-a11y'],
    env: {
        jest: true,
    },
    rules: {
        'jsx-a11y/accessible-emoji': 'off', // Not relevant for RN
        // Add other overrides here
    },
};
