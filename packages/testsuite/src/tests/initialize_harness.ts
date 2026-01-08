import { Harness } from "forklift";

describe("initialize harness", () => {
  it("should initialize local harness", () => {
    const harness = Harness.createLocal();
    expect(harness).toBeDefined();
    harness.cleanup();
  });

  it("should initialize live harness", () => {
    const harness = Harness.createLive("testnet");
    expect(harness).toBeDefined();
    harness.cleanup();
  });

  it("should fail to initialize network fork harness with invalid API key", () => {
    expect(() => {
      Harness.createNetworkFork("mainnet", "invalid_api_key");
    }).toThrow();
  });
});
