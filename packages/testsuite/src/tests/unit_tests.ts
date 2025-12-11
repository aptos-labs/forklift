import { TestHarness } from "forklift";
import { Ed25519PrivateKey, Account } from "@aptos-labs/ts-sdk";
import * as path from "path";

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
});

describe("initialize CLI profiles", () => {
  const harness = new TestHarness();

  afterAll(() => {
    harness.cleanup();
  });

  it("should have default profile initialized", () => {
    const address = harness.getAccountAddress("default");
    expect(address).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("initialize a profile with a random private key", () => {
    const profileName = "alice";

    harness.init_cli_profile(profileName);

    const address = harness.getAccountAddress(profileName);
    expect(address).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("initialize a profile with a specific private key", () => {
    const profileName = "bob";
    const pk = Ed25519PrivateKey.generate();
    const account = Account.fromPrivateKey({ privateKey: pk });
    const pkStr = pk.toHexString();

    harness.init_cli_profile(profileName, pkStr);

    const address = harness.getAccountAddress(profileName);
    const expectedAddress = account.accountAddress.toString();
    expect(address).toBe(expectedAddress);
  });

  it("initialize a profile with invalid private key", () => {
    const profileName = "charlie";
    const invalidPk = "invalid_key";

    expect(() => {
      harness.init_cli_profile(profileName, invalidPk);
    }).toThrow();
  });

  it("should throw error if profile with same name already exists", () => {
    const profileName = "duplicate";
    harness.init_cli_profile(profileName);

    expect(() => {
      harness.init_cli_profile(profileName);
    }).toThrow(/already exists/);
  });
});

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

describe("publish package", () => {
  const harness = new TestHarness();
  const alice = "alice";

  afterAll(() => {
    harness.cleanup();
  });

  it("should publish message package and verify registry", () => {
    harness.init_cli_profile(alice);
    harness.fundAccount(alice, 100000000);

    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    harness.publishPackage({
      profile: alice,
      packageDir,
      namedAddresses: {
        simple_message: alice,
      },
    });

    const registry = harness.viewResource(
      alice,
      "0x1::code::PackageRegistry",
    );
    expect(registry.Result).toBeDefined();
    expect(registry.Result.packages).toBeDefined();
    expect(registry.Result.packages.length).toBeGreaterThan(0);

    // verify the package name
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("0");
  });

  it("should upgrade message package and verify upgrade number is incremented", () => {
    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    harness.publishPackage({
      profile: alice,
      packageDir,
      namedAddresses: {
        simple_message: alice,
      },
    });

    const registry = harness.viewResource(
      alice,
      "0x1::code::PackageRegistry",
    );
    expect(registry.Result).toBeDefined();
    expect(registry.Result.packages).toBeDefined();
    expect(registry.Result.packages.length).toBeGreaterThan(0);

    // verify the package name
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("1");
  });

  it("should fail when publishing with invalid package directory", () => {
    const invalidPackageDir = path.resolve(__dirname, "non_existent_dir");

    expect(() => {
      harness.publishPackage({
        profile: alice,
        packageDir: invalidPackageDir,
        namedAddresses: {
          simple_message: alice,
        },
      });
    }).toThrow();
  });

  it("should fail when publishing without required named address", () => {
    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    expect(() => {
      harness.publishPackage({
        profile: alice,
        packageDir,
      });
    }).toThrow();
  });

  it("should publish with included artifacts set to none", () => {
    const artifactProfile = "artifact_tester";
    harness.init_cli_profile(artifactProfile);
    harness.fundAccount(artifactProfile, 100000000);

    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    harness.publishPackage({
      profile: artifactProfile,
      packageDir,
      namedAddresses: {
        simple_message: harness.getAccountAddress(artifactProfile),
      },
      includedArtifacts: "none",
    });

    const registry = harness.viewResource(
      artifactProfile,
      "0x1::code::PackageRegistry",
    );
    // verify the package exists
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
  });
});
