import { Harness } from "forklift";
import { Ed25519PrivateKey, Account } from "@aptos-labs/ts-sdk";

describe("initialize CLI profiles", () => {
  const harness = new Harness();

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
