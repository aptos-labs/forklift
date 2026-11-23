import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";

const apiKey = process.env.APTOS_API_KEY;

(apiKey ? describe : describe.skip)("network forking", () => {
  let harness: Harness;
  let initialBalance: bigint;

  const testnetAccountAddr =
    "0x3f9e0589ca0668a5273b86bfcb5f357164408a889bc733b309cf1901098c8ce5";

  afterAll(() => {
    harness?.cleanup();
  });

  it("should initialize harness", () => {
    harness = Harness.createNetworkFork("testnet", apiKey!);
  });

  it("view account balance", () => {
    initialBalance = harness.getAPTBalanceFungibleStore(testnetAccountAddr);
    expect(typeof initialBalance).toBe("bigint");
    expect(initialBalance >= BigInt(0)).toBe(true);
  });

  it("transfer to existing account", () => {
    const sender = "alice";
    harness.initCliProfile(sender);
    harness.fundAccount(sender, 100000000);

    const res = harness.runMoveFunction({
      sender: sender,
      functionId: "0x1::aptos_account::transfer",
      args: [`address:${testnetAccountAddr}`, "u64:2000"],
    });
    assertTxnSuccess(res);

    const balance = harness.getAPTBalanceFungibleStore(testnetAccountAddr);
    expect(balance).toBe(initialBalance + BigInt(2000));
  });
});
