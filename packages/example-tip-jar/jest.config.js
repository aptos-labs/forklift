/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/src/**/*.ts"],
    testTimeout: 60000,
    verbose: true,
};
