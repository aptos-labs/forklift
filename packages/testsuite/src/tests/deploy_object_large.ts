import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";

// FIXME: Need new version of Aptos CLI. Reenable once that gets released.
describe.skip("code object (large)", () => {
  const harness = Harness.createLocal();
  const sender = "alice";
  let objectAddress: string;

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

  it("should publish message package and verify registry", () => {
    const packageDir = path.resolve(
      __dirname,
      "../../move_packages/large_package",
    );

    const res = harness.deployCodeObject({
      sender: sender,
      packageDir,
      packageAddressName: "my_addr",
      chunked: true,
    });
    assertTxnSuccess(res);
    objectAddress = res.Result.deployed_object_address;
    expect(objectAddress).toBeDefined();

    const registry = harness.viewResource(
      objectAddress,
      "0x1::code::PackageRegistry",
    );
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "LargePackage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("0");
  });

  it("should upgrade code object and verify upgrade number is incremented", () => {
    const res = harness.upgradeCodeObject({
      sender: sender,
      packageDir: path.resolve(__dirname, "../../move_packages/large_package"),
      packageAddressName: "my_addr",
      objectAddress: objectAddress,
      chunked: true,
    });
    assertTxnSuccess(res);

    const registry = harness.viewResource(
      objectAddress,
      "0x1::code::PackageRegistry",
    );
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "LargePackage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("1");
  });
});
