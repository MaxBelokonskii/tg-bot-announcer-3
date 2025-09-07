module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/../../tests"],
  testMatch: [
    "**/tests/**/*.test.js", 
    "**/tests/**/test-*.spec.js"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/coverage/",
    "**/test-simple-isolated.js",
    "**/test-simple.js",
    "**/test-menu-debug.js",
    "**/test-menu-fix*.js",
    "**/test-menu-simple.js",
    "**/test-integration.js",
    "**/test-menu-integration.js",
    "**/test-database.js",
    "**/test-bot-init.js"
  ],
  collectCoverageFrom: [
    "bot/**/*.js",
    "features/**/*.js",
    "utils/**/*.js",
    "database/**/*.js",
    "interface/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/test-setup.js"],
  moduleDirectories: ["node_modules", "<rootDir>/../../"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/coverage/"
  ],
  verbose: true,
  forceExit: true,
  clearMocks: true
};