import { Harness } from "@aptos-labs/forklift";

describe("advance epoch", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = Harness.createLocal();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("should advance to the next epoch", () => {
    const result = harness.advanceEpoch();

    expect(result.newEpoch).toBe(result.oldEpoch + BigInt(1));
  });

  it("should advance multiple epochs", () => {
    const first = harness.advanceEpoch();
    const second = harness.advanceEpoch();
    const third = harness.advanceEpoch();

    expect(first.newEpoch).toBe(first.oldEpoch + BigInt(1));
    expect(second.oldEpoch).toBe(first.newEpoch);
    expect(third.oldEpoch).toBe(second.newEpoch);
    expect(third.newEpoch).toBe(first.oldEpoch + BigInt(3));
  });

  it("should advance time past the epoch boundary", () => {
    const timeBefore = harness.getCurrentTimeMicros();
    harness.advanceEpoch();
    const timeAfter = harness.getCurrentTimeMicros();

    expect(timeAfter).toBeGreaterThan(timeBefore);
  });

  it("should return consistent results with newBlock", () => {
    const blockResult = harness.newBlock({ offsetUsecs: 1000 });
    expect(blockResult.oldEpoch).toBe(blockResult.newEpoch);

    const epochResult = harness.advanceEpoch();
    expect(epochResult.newEpoch).toBe(epochResult.oldEpoch + BigInt(1));
    expect(epochResult.oldEpoch).toBe(blockResult.newEpoch);
  });

  it("should throw in live mode", () => {
    const liveHarness = Harness.createLive("testnet");
    try {
      expect(() => {
        liveHarness.advanceEpoch();
      }).toThrow("only available in simulation mode");
    } finally {
      liveHarness.cleanup();
    }
  });
});
