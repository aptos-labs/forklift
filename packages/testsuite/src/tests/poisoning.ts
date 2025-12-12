import { TestHarness } from "forklift";

describe("poisoning", () => {
  let harness = new TestHarness();
  harness.cleanup();

  const EXPECTED_ERROR = /poisoned/;

  it("should throw when accessing working directory after cleanup", () => {
    expect(() => harness.getWorkingDir()).toThrow(EXPECTED_ERROR);
  });

  it("should throw when accessing session path after cleanup", () => {
    expect(() => harness.getSessionPath()).toThrow(EXPECTED_ERROR);
  });

  it("should throw when initializing cli profile after cleanup", () => {
    expect(() => harness.init_cli_profile("test")).toThrow(EXPECTED_ERROR);
  });

  it("should throw when funding account after cleanup", () => {
    expect(() => harness.fundAccount("default", 100)).toThrow(EXPECTED_ERROR);
  });

  it("should throw when running move function after cleanup", () => {
    expect(() =>
      harness.runMoveFunction({
        profile: "default",
        functionId: "0x1::coin::transfer",
      }),
    ).toThrow(EXPECTED_ERROR);
  });

  it("should throw when running move script after cleanup", () => {
    expect(() =>
      harness.runMoveScript({
        profile: "default",
        packageDir: ".",
        scriptName: "test",
      }),
    ).toThrow(EXPECTED_ERROR);
  });

  it("should throw when publishing package after cleanup", () => {
    expect(() =>
      harness.publishPackage({
        profile: "default",
        packageDir: ".",
      }),
    ).toThrow(EXPECTED_ERROR);
  });

  it("should throw when running view function after cleanup", () => {
    expect(() =>
      harness.runViewFunction({
        functionId: "0x1::coin::balance",
      }),
    ).toThrow(EXPECTED_ERROR);
  });

  it("should throw when viewing resource group after cleanup", () => {
    expect(() =>
      harness.viewResourceGroup("0x1", "0x1::object::ObjectGroup"),
    ).toThrow(EXPECTED_ERROR);
  });

  it("should throw when viewing resource after cleanup", () => {
    expect(() =>
      harness.viewResource(
        "0x1",
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
      ),
    ).toThrow(EXPECTED_ERROR);
  });

  it("should throw when getting APT balance after cleanup", () => {
    expect(() => harness.getAPTBalanceFungibleStore("0x1")).toThrow(
      EXPECTED_ERROR,
    );
  });

  it("should throw when getting current time after cleanup", () => {
    expect(() => harness.getCurrentTimeMicros()).toThrow(EXPECTED_ERROR);
  });

  it("should throw when getting gas schedule after cleanup", () => {
    expect(() => harness.getGasSchedule()).toThrow(EXPECTED_ERROR);
  });

  it("should throw when getting account address after cleanup", () => {
    expect(() => harness.getAccountAddress("default")).toThrow(EXPECTED_ERROR);
  });
});
