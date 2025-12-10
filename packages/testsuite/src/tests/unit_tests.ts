import { TestHarness } from "forklift";
import { Ed25519PrivateKey, Account } from "@aptos-labs/ts-sdk";

describe("Init CLI Profiles", () => {
    const harness = new TestHarness();

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
});
