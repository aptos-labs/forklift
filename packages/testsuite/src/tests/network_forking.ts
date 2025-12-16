import { assertTxnSuccess, TestHarness } from "forklift";

const apiKey = process.env.APTOS_API_KEY;

(apiKey ? describe : describe.skip)("network forking", () => {
  let harness: TestHarness;

  const testnetAccountAddr =
    "0x3f9e0589ca0668a5273b86bfcb5f357164408a889bc733b309cf1901098c8ce5";

  it("should initialize harness", () => {
    harness = new TestHarness({
      network: "testnet",
      apiKey: apiKey,
      networkVersion: 7111477749,
    });
  });

  it("view account balance", () => {
    const balance = harness.getAPTBalanceFungibleStore(testnetAccountAddr);
    expect(balance).toBe(BigInt(9182903550));
  });

  it("transfer to existing account", () => {
    const sender = "alice";
    harness.init_cli_profile(sender);
    harness.fundAccount(sender, 100000000);

    const res = harness.runMoveFunction({
      sender: sender,
      functionId: "0x1::aptos_account::transfer",
      args: [`address:${testnetAccountAddr}`, "u64:2000"],
    });
    assertTxnSuccess(res);

    const balance = harness.getAPTBalanceFungibleStore(testnetAccountAddr);
    expect(balance).toBe(BigInt(9182905550));
  });
});
