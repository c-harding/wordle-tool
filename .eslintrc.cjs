module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    "airbnb-base",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "no-restricted-syntax": "off",
    "no-shadow": "off",
    "@typescript-eslint/no-shadow": ["error"],
    "no-await-in-loop": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-console": "off",
    "no-constant-condition": ["warn", {
      checkLoops: false
    }],
    "prettier/prettier": ["warn", { printWidth: 100 }],
  },
};
