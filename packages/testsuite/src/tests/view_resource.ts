import { TestHarness } from "forklift";

describe("view resource", () => {
  const harness = new TestHarness();

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
});
