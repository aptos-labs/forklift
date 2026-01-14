import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";

describe("publish package (large)", () => {
  const harness = Harness.createLocal();
  const sender = "alice";

  afterAll(() => {
    harness.cleanup();
  });

  it("fund sender account", () => {
    // Note: Here we fund the sender account by transferring from a different funder account.
    //       Without this, the package upgrade transaction will fail for some unknown reason.
    //
    //       [aptos_vm] Unexpected success epilogue Move abort: 01::object::393218 (Category: 6 Reason: 2)
    harness.init_cli_profile(sender);

    const funder = "funder";
    harness.init_cli_profile(funder);
    harness.fundAccount(funder, 200000000);

    const res = harness.runMoveFunction({
      sender: funder,
      functionId: "0x1::aptos_account::transfer",
      args: ["address:alice", "u64:100000000"],
    });
    assertTxnSuccess(res);
  });

  it("should publish large package and verify registry", () => {
    const packageDir = path.resolve(
      __dirname,
      "../../move_packages/large_package",
    );

    harness.publishPackage({
      sender: sender,
      packageDir,
      namedAddresses: {
        my_addr: sender,
      },
      chunked: true,
    });

    const registry = harness.viewResource(sender, "0x1::code::PackageRegistry");
    expect(registry.Result).toBeDefined();
    expect(registry.Result.packages).toBeDefined();
    expect(registry.Result.packages.length).toBeGreaterThan(0);

    // verify the package name
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "LargePackage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("0");
  });

  it("should verify data length", () => {
    const res = harness.runViewFunction({
      functionId: `${sender}::large_module::get_data_len`,
    });

    expect(res.Result).toBeDefined();
    expect(Number(res.Result[0])).toBeGreaterThan(100000);
  });

  it("should upgrade message package and verify upgrade number is incremented", () => {
    const packageDir = path.resolve(
      __dirname,
      "../../move_packages/large_package",
    );

    const res = harness.publishPackage({
      sender: sender,
      packageDir,
      namedAddresses: {
        my_addr: sender,
      },
      chunked: true,
    });
    assertTxnSuccess(res);

    const registry = harness.viewResource(sender, "0x1::code::PackageRegistry");
    expect(registry.Result).toBeDefined();
    expect(registry.Result.packages).toBeDefined();
    expect(registry.Result.packages.length).toBeGreaterThan(0);

    // verify the package name
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "LargePackage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("1");
  });
});
