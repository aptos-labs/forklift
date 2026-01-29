import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";
import { LocalNode } from "../localNode";

describe("Live Mode", () => {
  let localNode: LocalNode;
  let harness: Harness;
  let sender: string;
  let address: string;

  const message = "Hello, Live Aptos!";

  /**
   * Helper to verify FeeStatement event is present
   */
  function expectFeeStatementEvent(events: any[]) {
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    const feeStatement = events.find(
      (e: any) => e.type === "0x1::transaction_fee::FeeStatement",
    );
    expect(feeStatement).toBeDefined();
    expect(feeStatement.data).toBeDefined();
  }

  afterAll(async () => {
    await localNode.stop();
    harness.cleanup();
  });

  describe("Setup", () => {
    it("spawn local node and initialize harness", async () => {
      localNode = new LocalNode({ showStdout: false });
      await localNode.run();
      harness = Harness.createLive("local");
    });

    it("initialize CLI profile", () => {
      sender = "alice";
      harness.init_cli_profile(sender);
      address = harness.getAccountAddress(sender);
    });

    it("fund account via faucet", () => {
      harness.fundAccount(sender, 100000000);
    });

    it("get APT balance via fungible store", () => {
      const balance = harness.getAPTBalanceFungibleStore(sender);
      expect(balance).toBe(BigInt(100000000));
    });
  });

  describe("Package Publishing", () => {
    it("publish package", () => {
      const packageDir = path.join(__dirname, "../../move_packages/message");
      const publishRes = harness.publishPackage({
        sender,
        packageDir,
        namedAddresses: { simple_message: address },
        includeEvents: true,
      });
      assertTxnSuccess(publishRes);
      expectFeeStatementEvent(publishRes.Result.events);
    });
  });

  describe("Move Functions and Scripts", () => {
    it("set message via runMoveFunction", () => {
      const runRes = harness.runMoveFunction({
        sender,
        functionId: `${address}::message::set_message`,
        args: [`string:${message}`],
        includeEvents: true,
      });
      assertTxnSuccess(runRes);
      expectFeeStatementEvent(runRes.Result.events);
    });

    it("view message via runViewFunction", () => {
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
        namedAddresses: { simple_message: address },
        includeEvents: true,
      });
      assertTxnSuccess(runRes);
      expectFeeStatementEvent(runRes.Result.events);
    });

    it("verify message was set by script", () => {
      const viewRes = harness.runViewFunction({
        functionId: `${address}::message::get_message`,
        args: [`address:${address}`],
      });
      expect(viewRes.Result[0]).toBe("Hello, Aptos!");
    });
  });

  describe("Resource Viewing", () => {
    it("view resource", () => {
      const resource = harness.viewResource(
        address,
        `${address}::message::MessageHolder`,
      );
      expect(resource.Result.message).toBe("Hello, Aptos!");
    });

    it("return null for non-existent resource type", () => {
      const result = harness.viewResource(
        address,
        "0x1::nonexistent::Resource",
      );
      expect(result).toHaveProperty("Result");
      expect(result.Result).toBeNull();
    });

    it("return null for non-existent account", () => {
      const result = harness.viewResource(
        "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
      );
      expect(result).toHaveProperty("Result");
      expect(result.Result).toBeNull();
    });

    it("throw error for viewResourceGroup in live mode", () => {
      expect(() => {
        harness.viewResourceGroup(address, "0x1::object::ObjectGroup");
      }).toThrow(
        "viewResourceGroup is not supported in live mode. Use viewResource() to query individual resources within a group directly.",
      );
    });

    it("get current time micros", () => {
      const timeMicros = harness.getCurrentTimeMicros();
      expect(timeMicros).toBeGreaterThan(BigInt(0));
    });

    it("get gas schedule", () => {
      const gasSchedule = harness.getGasSchedule();
      expect(gasSchedule).toHaveProperty("entries");
      expect(gasSchedule).toHaveProperty("feature_version");
    });
  });

  describe("Code Objects", () => {
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
        includeEvents: true,
      });
      assertTxnSuccess(res);
      codeObjectAddress = res.Result.deployed_object_address;
      expect(codeObjectAddress).toBeDefined();
      expect(codeObjectAddress).toMatch(/^0x[a-fA-F0-9]+$/);
      expectFeeStatementEvent(res.Result.events);
    });

    it("verify deployment via PackageRegistry", () => {
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
        includeEvents: true,
      });
      assertTxnSuccess(res);
      expectFeeStatementEvent(res.Result.events);
    });

    it("verify upgrade via PackageRegistry", () => {
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

  describe("Large Package Publishing", () => {
    let largePackageSender: string;
    let largePackageAddress: string;
    let largeCodeObjectAddress: string;

    it("initialize profile for large package tests", async () => {
      largePackageSender = "charlie";
      harness.init_cli_profile(largePackageSender);
      harness.fundAccount(largePackageSender, 500000000);
      largePackageAddress = harness.getAccountAddress(largePackageSender);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }, 10000);

    // --- publishPackage with chunked option ---

    it("publish large package with chunked option", () => {
      const packageDir = path.join(
        __dirname,
        "../../move_packages/large_package",
      );
      const publishRes = harness.publishPackage({
        sender: largePackageSender,
        packageDir,
        namedAddresses: { my_addr: largePackageAddress },
        chunked: true,
        includeEvents: true,
        maxGas: 2000000, // Note: Need to specify max gas manually to workaround remote simulation error
      });
      assertTxnSuccess(publishRes);
      expectFeeStatementEvent(publishRes.Result.events);
    });

    it("verify large package in PackageRegistry", () => {
      const registry = harness.viewResource(
        largePackageAddress,
        "0x1::code::PackageRegistry",
      );
      expect(registry.Result).toBeDefined();
      expect(registry.Result.packages).toBeDefined();
      expect(registry.Result.packages.length).toBeGreaterThan(0);

      const packageMetadata = registry.Result.packages.find(
        (pkg: any) => pkg.name === "LargePackage",
      );
      expect(packageMetadata).toBeDefined();
      expect(packageMetadata.upgrade_number).toBe("0");
    });

    it("verify data length via view function (publishPackage)", () => {
      const res = harness.runViewFunction({
        functionId: `${largePackageAddress}::large_module::get_data_len`,
      });
      expect(res.Result).toBeDefined();
      expect(Number(res.Result[0])).toBeGreaterThan(100000);
    });

    // --- deployCodeObject with chunked option ---

    it("deploy large code object with chunked option", () => {
      const packageDir = path.join(
        __dirname,
        "../../move_packages/large_package",
      );
      const res = harness.deployCodeObject({
        sender: largePackageSender,
        packageDir,
        packageAddressName: "my_addr",
        chunked: true,
        includeEvents: true,
        maxGas: 2000000, // Note: Need to specify max gas manually to workaround remote simulation error
      });
      assertTxnSuccess(res);
      largeCodeObjectAddress = res.Result.deployed_object_address;
      expect(largeCodeObjectAddress).toBeDefined();
      expect(largeCodeObjectAddress).toMatch(/^0x[a-fA-F0-9]+$/);
      expectFeeStatementEvent(res.Result.events);
    });

    it("verify large code object deployment via PackageRegistry", () => {
      const registry = harness.viewResource(
        largeCodeObjectAddress,
        "0x1::code::PackageRegistry",
      );
      expect(registry.Result).toBeDefined();
      const packageMetadata = registry.Result.packages.find(
        (pkg: any) => pkg.name === "LargePackage",
      );
      expect(packageMetadata).toBeDefined();
      expect(packageMetadata.upgrade_number).toBe("0");
    });

    it("verify data length via view function (deployCodeObject)", () => {
      const res = harness.runViewFunction({
        functionId: `${largeCodeObjectAddress}::large_module::get_data_len`,
      });
      expect(res.Result).toBeDefined();
      expect(Number(res.Result[0])).toBeGreaterThan(100000);
    });
  });
});
