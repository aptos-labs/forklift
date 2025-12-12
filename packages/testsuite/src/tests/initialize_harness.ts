import { TestHarness } from "forklift";

describe("initialize harness", () => {
  it("should initialize with default options", () => {
    const harness = new TestHarness();
    expect(harness).toBeDefined();
    harness.cleanup();
  });

  it("should throw error if only network is provided", () => {
    expect(() => {
      new TestHarness({ network: "mainnet" });
    }).toThrow("Both network and apiKey must be provided together, or neither");
  });

  it("should throw error if only apiKey is provided", () => {
    expect(() => {
      new TestHarness({ apiKey: "sometoken" });
    }).toThrow("Both network and apiKey must be provided together, or neither");
  });

  it("should fail when initializing with invalid API key", () => {
    expect(() => {
      new TestHarness({
        network: "mainnet",
        apiKey: "invalid_api_key",
      });
    }).toThrow();
  });

  it("should throw error if networkVersion is provided without network", () => {
    expect(() => {
      new TestHarness({ networkVersion: 123 });
    }).toThrow("networkVersion cannot be set when network is not set");
  });
});
