import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";
import { LocalNode } from "../localNode";

describe("live mode: publish, set message, and view message", () => {
  let localNode: LocalNode;
  let harness: Harness;
  let sender: string;
  let address: string;

  const message = "Hello, Live Aptos!";

  afterAll(async () => {
    await localNode.stop();
    harness.cleanup();
  });

  it("spawn local node and initialize harness", async () => {
    localNode = new LocalNode({ showStdout: false });
    await localNode.run();
    harness = Harness.createLive("local");
  });

  it("initialize custom CLI profile", () => {
    sender = "alice";
    harness.init_cli_profile(sender);
    address = harness.getAccountAddress(sender);
  });

  it("fund account via faucet", () => {
    harness.fundAccount(sender, 100000000);
  });

  it("get APT balance via fungible store", () => {
    const balance = harness.getAPTBalanceFungibleStore(sender);
    // After funding with 100000000 octas and spending some on gas, balance should be positive
    expect(balance).toBe(BigInt(100000000));
  });

  it("publish package", async () => {
    const packageDir = path.join(__dirname, "../../move_packages/message");
    const publishRes = harness.publishPackage({
      sender,
      packageDir,
      namedAddresses: {
        simple_message: address,
      },
    });
    assertTxnSuccess(publishRes);
  });

  it("set message via runMoveFunction", async () => {
    const runRes = harness.runMoveFunction({
      sender,
      functionId: `${address}::message::set_message`,
      args: [`string:${message}`],
    });
    assertTxnSuccess(runRes);
  });

  it("view message after runMoveFunction", async () => {
    const viewRes = harness.runViewFunction({
      functionId: `${address}::message::get_message`,
      args: [`address:${address}`],
    });
    expect(viewRes.Result[0]).toBe(message);
  });

  it("set message via runMoveScript", () => {
    const runRes = harness.runMoveScript({
      sender,
      packageDir: path.join(__dirname, "../../move_packages/message"),
      scriptName: "script_hello_aptos",
      namedAddresses: {
        simple_message: address,
      },
    });
    assertTxnSuccess(runRes);
  });

  it("view message after runMoveScript", () => {
    const viewRes = harness.runViewFunction({
      functionId: `${address}::message::get_message`,
      args: [`address:${address}`],
    });
    // The script sets the message to "Hello, Aptos!"
    expect(viewRes.Result[0]).toBe("Hello, Aptos!");
  });

  it("view resource", () => {
    const resource = harness.viewResource(
      address,
      `${address}::message::MessageHolder`,
    );
    // Response format is normalized to { Result: data }
    // Message was last set by the script to "Hello, Aptos!"
    expect(resource.Result.message).toBe("Hello, Aptos!");
  });

  it("get current time micros", () => {
    const timeMicros = harness.getCurrentTimeMicros();
    // Should return a positive bigint representing microseconds
    expect(timeMicros).toBeGreaterThan(BigInt(0));
  });

  it("get gas schedule", () => {
    const gasSchedule = harness.getGasSchedule();
    // Gas schedule should have entries array
    expect(gasSchedule).toHaveProperty("entries");
    expect(gasSchedule).toHaveProperty("feature_version");
  });

  it("should return null result for non-existent resource type", () => {
    const result = harness.viewResource(address, "0x1::nonexistent::Resource");
    expect(result).toHaveProperty("Result");
    expect(result.Result).toBeNull();
  });

  it("should return null result for non-existent account", () => {
    const result = harness.viewResource(
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
    );
    expect(result).toHaveProperty("Result");
    expect(result.Result).toBeNull();
  });

  it("should throw error for viewResourceGroup in live mode", () => {
    expect(() => {
      harness.viewResourceGroup(address, "0x1::object::ObjectGroup");
    }).toThrow(
      "viewResourceGroup is not supported in live mode. Use viewResource() to query individual resources within a group directly.",
    );
  });

  // Code object tests - use a separate profile to avoid conflicts
  let codeObjectSender: string;
  let codeObjectAddress: string;

  it("initialize profile for code object tests", () => {
    codeObjectSender = "bob";
    harness.init_cli_profile(codeObjectSender);
    harness.fundAccount(codeObjectSender, 100000000);
  });

  it("deploy code object", () => {
    const packageDir = path.join(__dirname, "../../move_packages/message");
    const res = harness.deployCodeObject({
      sender: codeObjectSender,
      packageDir,
      packageAddressName: "simple_message",
    });
    assertTxnSuccess(res);
    codeObjectAddress = res.Result.deployed_object_address;
    expect(codeObjectAddress).toBeDefined();
    // Harness should normalize address to include 0x prefix
    expect(codeObjectAddress).toMatch(/^0x[a-fA-F0-9]+$/);
  });

  it("verify code object deployment via PackageRegistry", () => {
    const registry = harness.viewResource(
      codeObjectAddress,
      "0x1::code::PackageRegistry",
    );
    expect(registry.Result).toBeDefined();
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("0");
  });

  it("upgrade code object", () => {
    const packageDir = path.join(__dirname, "../../move_packages/message");
    const res = harness.upgradeCodeObject({
      sender: codeObjectSender,
      packageDir,
      packageAddressName: "simple_message",
      objectAddress: codeObjectAddress,
    });
    assertTxnSuccess(res);
  });

  it("verify code object upgrade via PackageRegistry", () => {
    const registry = harness.viewResource(
      codeObjectAddress,
      "0x1::code::PackageRegistry",
    );
    expect(registry.Result).toBeDefined();
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("1");
  });
});
