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

  it("view on-chain chain id", () => {
    const chainId = harness.viewResource("0x1", "0x1::chain_id::ChainId");
    expect(chainId.Result.id).toBe(2);
  });

  it("fund account in forked session", () => {
    const sender = "alice";
    harness.initCliProfile(sender);
    harness.fundAccount(sender, 100000000);
    expect(harness.getAPTBalanceFungibleStore(sender)).toBe(BigInt(100000000));
  });

  // Skipped until Aptos CLI 9.x restores --session support for deploy-object and --profile-gas:
  // Aptos CLI 8.1.0 VM hits UNEXPECTED_ERROR_FROM_KNOWN_MOVE_FUNCTION executing 0x1 prologue
  // against current testnet's newer on-chain framework.
  it.skip("transfer to existing account", () => {
    const sender = "bob";
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
