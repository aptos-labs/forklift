import { TestHarness, assertTxnSuccess } from "forklift";

describe("Sample Workflow", () => {
  let harness: TestHarness = new TestHarness();

  afterAll(() => {
    harness.cleanup();
  });

  it("fund account", () => {
    harness.fundAccount("default", 100000000 /* 1 APT */);
  });

  it("transfer 100 Octa to self", () => {
    const res = harness.runMoveFunction({
      profile: "default",
      functionId: "0x1::aptos_account::transfer",
      args: ["address:default", "u64:100"],
    });

    assertTxnSuccess(res);
  });

  it("view sequence number", () => {
    // View the sequence number
    const viewRes = harness.runViewFunction({
      functionId: "0x1::account::get_sequence_number",
      args: ["address:default"],
    });

    expect(viewRes.Result[0]).toBe("1");
  });
});
