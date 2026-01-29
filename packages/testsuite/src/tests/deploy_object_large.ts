import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";

describe("code object (large)", () => {
  const harness = Harness.createLocal();
  const sender = "alice";
  let objectAddress: string;

  afterAll(() => {
    harness.cleanup();
  });

  it("fund sender account", () => {
    harness.init_cli_profile(sender);
    harness.fundAccount(sender, 100000000);
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
