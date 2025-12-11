import { TestHarness } from "forklift";

describe("fund account", () => {
  const harness = new TestHarness();

  afterAll(() => {
    harness.cleanup();
  });

  it("should fund account and check balance", () => {
    const profileName = "alice_fund";
    harness.init_cli_profile(profileName);

    const amount = 142857;
    harness.fundAccount(profileName, amount);

    const balance = harness.getAPTBalanceFungibleStore(profileName);
    expect(balance).toBe(BigInt(amount));
  });

  it("should accumulate balance when funded multiple times", () => {
    const profileName = "bob_fund";
    harness.init_cli_profile(profileName);

    harness.fundAccount(profileName, 100);
    expect(harness.getAPTBalanceFungibleStore(profileName)).toBe(BigInt(100));

    harness.fundAccount(profileName, 50);
    expect(harness.getAPTBalanceFungibleStore(profileName)).toBe(BigInt(150));
  });

  it("should handle zero amount funding", () => {
    const profileName = "charlie_fund";
    harness.init_cli_profile(profileName);
    harness.fundAccount(profileName, 100);

    harness.fundAccount(profileName, 0);
    expect(harness.getAPTBalanceFungibleStore(profileName)).toBe(BigInt(100));
  });

  it("should throw error when funding with negative amount", () => {
    const profileName = "negative_fund";
    harness.init_cli_profile(profileName);

    expect(() => {
      harness.fundAccount(profileName, -100);
    }).toThrow();
  });

  it("should handle huge amount of funding (BigInt)", () => {
    const profileName = "whale";
    harness.init_cli_profile(profileName);

    // Max u64 is 18446744073709551615
    // Let's use something larger than MAX_SAFE_INTEGER (9007199254740991) but within u64
    const hugeAmount = BigInt("10000000000000000000"); // 10^19

    harness.fundAccount(profileName, hugeAmount);
    expect(harness.getAPTBalanceFungibleStore(profileName)).toBe(hugeAmount);
  });

  it("should throw error when funding with amount > u64::MAX", () => {
    const profileName = "overflow_fund";
    harness.init_cli_profile(profileName);

    // Max u64 is 18446744073709551615
    const overflowAmount = BigInt("18446744073709551616"); // u64::MAX + 1

    expect(() => {
      harness.fundAccount(profileName, overflowAmount);
    }).toThrow();
  });

  it("should throw error when funding non-existent profile", () => {
    const profileName = "non_existent";
    // We expect aptos CLI to fail because profile doesn't exist
    expect(() => {
      harness.fundAccount(profileName, 100);
    }).toThrow();
  });

  it("should succeed when funding with u64::MAX", () => {
    const profileName = "max_u64_test";
    harness.init_cli_profile(profileName);

    const maxU64 = BigInt("18446744073709551615");
    harness.fundAccount(profileName, maxU64);
    expect(harness.getAPTBalanceFungibleStore(profileName)).toBe(maxU64);
  });

  it("should fail when cumulative funding exceeds u64::MAX", () => {
    const profileName = "cumulative_overflow_test";
    harness.init_cli_profile(profileName);

    const almostMax = BigInt("18446744073709551615") - BigInt(10);
    harness.fundAccount(profileName, almostMax);

    expect(() => {
      harness.fundAccount(profileName, 20);
    }).toThrow();
  });
});
