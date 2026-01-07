import { Harness } from "forklift";

describe("initialize harness", () => {
  it("should initialize with default options", () => {
    const harness = new Harness();
    expect(harness).toBeDefined();
    harness.cleanup();
  });

  it("should throw error if only network is provided", () => {
    expect(() => {
      new Harness({ network: "mainnet" });
    }).toThrow("Both network and apiKey must be provided together, or neither");
  });

  it("should throw error if only apiKey is provided", () => {
    expect(() => {
      new Harness({ apiKey: "sometoken" });
    }).toThrow("Both network and apiKey must be provided together, or neither");
  });

  it("should fail when initializing with invalid API key", () => {
    expect(() => {
      new Harness({
        network: "mainnet",
        apiKey: "invalid_api_key",
      });
    }).toThrow();
  });

  it("should throw error if networkVersion is provided without network", () => {
    expect(() => {
      new Harness({ networkVersion: 123 });
    }).toThrow("networkVersion cannot be set when network is not set");
  });
});
