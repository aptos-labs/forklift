import { Harness } from "@aptos-labs/forklift";

describe("view resource", () => {
  const harness = Harness.createLocal();

  afterAll(() => {
    harness.cleanup();
  });

  it("should get current time micros", () => {
    const time = harness.getCurrentTimeMicros();
    expect(time).toBe(BigInt(0));
  });

  it("should get gas schedule", () => {
    const gasSchedule = harness.getGasSchedule();
    expect(gasSchedule).toBeDefined();
    expect(gasSchedule).toHaveProperty("entries");
    expect(gasSchedule).toHaveProperty("feature_version");
  });

  it("should return null result for non-existent resource type", () => {
    const result = harness.viewResource("0x1", "0x1::nonexistent::Resource");
    expect(result).toHaveProperty("Result");
    expect(result.Result).toBeNull();
  });

  it("should return null result for non-existent account", () => {
    // Use an address that doesn't exist in the simulation
    const result = harness.viewResource(
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
    );
    expect(result).toHaveProperty("Result");
    expect(result.Result).toBeNull();
  });
});
