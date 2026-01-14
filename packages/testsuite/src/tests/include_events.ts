import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";

/**
 * Tests for the includeEvents option across all transaction-executing functions.
 * Each test verifies that the FeeStatement event is present when includeEvents is true.
 */
describe("includeEvents option", () => {
  const harness = Harness.createLocal();
  const sender = "events_tester";
  let senderAddress: string;
  let codeObjectAddress: string;

  const packageDir = path.resolve(__dirname, "../../move_packages/message");

  beforeAll(() => {
    harness.init_cli_profile(sender);
    senderAddress = harness.getAccountAddress(sender);
    harness.fundAccount(sender, 500_000_000);
  });

  afterAll(() => {
    harness.cleanup();
  });

  /**
   * Helper to verify FeeStatement event is present
   */
  function expectFeeStatementEvent(events: any[]) {
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    const feeStatement = events.find(
      (e) => e.type === "0x1::transaction_fee::FeeStatement",
    );
    expect(feeStatement).toBeDefined();
    expect(feeStatement.data).toBeDefined();
    expect(feeStatement.data.total_charge_gas_units).toBeDefined();
  }

  it("publishPackage should include events when requested", () => {
    const res = harness.publishPackage({
      sender,
      packageDir,
      namedAddresses: { simple_message: senderAddress },
      includeEvents: true,
    });

    assertTxnSuccess(res);
    expectFeeStatementEvent(res.Result.events);
  });

  it("runMoveFunction should include events when requested", () => {
    const res = harness.runMoveFunction({
      sender,
      functionId: `${senderAddress}::message::set_message`,
      args: ["string:Hello Events"],
      includeEvents: true,
    });

    assertTxnSuccess(res);
    expectFeeStatementEvent(res.Result.events);
  });

  it("runMoveScript should include events when requested", () => {
    const res = harness.runMoveScript({
      sender,
      packageDir,
      scriptName: "script_hello_aptos",
      namedAddresses: { simple_message: senderAddress },
      includeEvents: true,
    });

    assertTxnSuccess(res);
    expectFeeStatementEvent(res.Result.events);
  });

  it("deployCodeObject should include events when requested", () => {
    const deployer = "code_deployer";
    harness.init_cli_profile(deployer);
    harness.fundAccount(deployer, 500_000_000);

    const res = harness.deployCodeObject({
      sender: deployer,
      packageDir,
      packageAddressName: "simple_message",
      includeEvents: true,
    });

    assertTxnSuccess(res);
    codeObjectAddress = res.Result.deployed_object_address;
    expectFeeStatementEvent(res.Result.events);
  });

  it("upgradeCodeObject should include events when requested", () => {
    const res = harness.upgradeCodeObject({
      sender: "code_deployer",
      packageDir,
      packageAddressName: "simple_message",
      objectAddress: codeObjectAddress,
      includeEvents: true,
    });

    assertTxnSuccess(res);
    expectFeeStatementEvent(res.Result.events);
  });
});
