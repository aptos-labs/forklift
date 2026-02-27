import { MIN_CLI_VERSION, compareVersions } from "@aptos-labs/forklift";

describe("CLI version validation", () => {
  it("should export MIN_CLI_VERSION as a valid semver string", () => {
    expect(MIN_CLI_VERSION).toBeDefined();
    expect(typeof MIN_CLI_VERSION).toBe("string");
    expect(MIN_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("compareVersions", () => {
  it("should return 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("0.0.0", "0.0.0")).toBe(0);
  });

  it("should compare major versions", () => {
    expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
  });

  it("should compare minor versions", () => {
    expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
    expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
  });

  it("should compare patch versions", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
    expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
  });

  it("should prioritize major over minor and patch", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.9.9", "2.0.0")).toBe(-1);
  });

  it("should prioritize minor over patch", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("1.1.9", "1.2.0")).toBe(-1);
  });
});
