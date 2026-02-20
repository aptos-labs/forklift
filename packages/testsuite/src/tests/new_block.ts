import { Harness } from "@aptos-labs/forklift";

describe("new block", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = Harness.createLocal();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("should advance timestamp by 1 microsecond by default", () => {
    const before = harness.getCurrentTimeMicros();
    harness.newBlock();
    const after = harness.getCurrentTimeMicros();

    expect(after).toBe(before + BigInt(1));
  });

  it("should advance timestamp by a specified offset", () => {
    const before = harness.getCurrentTimeMicros();
    const offset = 5_000_000; // 5 seconds
    harness.newBlock({ offsetUsecs: offset });
    const after = harness.getCurrentTimeMicros();

    expect(after).toBe(before + BigInt(offset));
  });

  it("should set an absolute timestamp", () => {
    const target = BigInt(1_800_000_000_000_000); // some future timestamp
    harness.newBlock({ timestampUsecs: target });
    const after = harness.getCurrentTimeMicros();

    expect(after).toBe(target);
  });

  it("should reject both timestampUsecs and offsetUsecs", () => {
    expect(() => {
      harness.newBlock({ timestampUsecs: 100, offsetUsecs: 200 });
    }).toThrow("mutually exclusive");
  });

  it("should support multiple consecutive blocks", () => {
    const before = harness.getCurrentTimeMicros();

    harness.newBlock({ offsetUsecs: 1000 });
    harness.newBlock({ offsetUsecs: 2000 });
    harness.newBlock({ offsetUsecs: 3000 });

    const after = harness.getCurrentTimeMicros();
    expect(after).toBe(before + BigInt(6000));
  });

  it("should reject going backwards in time", () => {
    const current = harness.getCurrentTimeMicros();
    const pastTimestamp = current - BigInt(1);

    expect(() => {
      harness.newBlock({ timestampUsecs: pastTimestamp });
    }).toThrow();
  });

  it("should throw in live mode", () => {
    const liveHarness = Harness.createLive("testnet");
    try {
      expect(() => {
        liveHarness.newBlock();
      }).toThrow("only available in simulation mode");
    } finally {
      liveHarness.cleanup();
    }
  });
});
