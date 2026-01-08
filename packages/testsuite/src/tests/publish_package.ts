import { Harness } from "forklift";
import * as path from "path";

describe("publish package", () => {
  const harness = Harness.createLocal();
  const alice = "alice";

  afterAll(() => {
    harness.cleanup();
  });

  it("should publish message package and verify registry", () => {
    harness.init_cli_profile(alice);
    harness.fundAccount(alice, 100000000);

    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    harness.publishPackage({
      sender: alice,
      packageDir,
      namedAddresses: {
        simple_message: alice,
      },
    });

    const registry = harness.viewResource(alice, "0x1::code::PackageRegistry");
    expect(registry.Result).toBeDefined();
    expect(registry.Result.packages).toBeDefined();
    expect(registry.Result.packages.length).toBeGreaterThan(0);

    // verify the package name
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("0");
  });

  it("should upgrade message package and verify upgrade number is incremented", () => {
    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    harness.publishPackage({
      sender: alice,
      packageDir,
      namedAddresses: {
        simple_message: alice,
      },
    });

    const registry = harness.viewResource(alice, "0x1::code::PackageRegistry");
    expect(registry.Result).toBeDefined();
    expect(registry.Result.packages).toBeDefined();
    expect(registry.Result.packages.length).toBeGreaterThan(0);

    // verify the package name
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("1");
  });

  it("should fail when publishing with invalid package directory", () => {
    const invalidPackageDir = path.resolve(__dirname, "non_existent_dir");

    expect(() => {
      harness.publishPackage({
        sender: alice,
        packageDir: invalidPackageDir,
        namedAddresses: {
          simple_message: alice,
        },
      });
    }).toThrow();
  });

  it("should fail when publishing without required named address", () => {
    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    expect(() => {
      harness.publishPackage({
        sender: alice,
        packageDir,
      });
    }).toThrow();
  });

  it("should publish with included artifacts set to none", () => {
    const artifactProfile = "artifact_tester";
    harness.init_cli_profile(artifactProfile);
    harness.fundAccount(artifactProfile, 100000000);

    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    harness.publishPackage({
      sender: artifactProfile,
      packageDir,
      namedAddresses: {
        simple_message: harness.getAccountAddress(artifactProfile),
      },
      includedArtifacts: "none",
    });

    const registry = harness.viewResource(
      artifactProfile,
      "0x1::code::PackageRegistry",
    );
    // verify the package exists
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
  });
});
