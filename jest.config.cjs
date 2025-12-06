module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/services/__tests__", "<rootDir>/src/integration/__tests__"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^config/(.*)$": "<rootDir>/config/$1",
    "^types/(.*)$": "<rootDir>/types/$1",
    "^src/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverage: false,
};
