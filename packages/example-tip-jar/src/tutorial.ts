/**
 * TipJar Tutorial - Develop → Deploy → Interact Workflow
 *
 * This tutorial demonstrates the lifecycle of an Aptos Move smart contract
 * using Forklift's simulation environment:
 *
 * 1. SETUP: Create accounts and fund them
 * 2. DEPLOY: Publish the contract as a code object
 * 3. INTERACT: Create tip jar objects, donate, withdraw, transfer ownership
 *
 * Key feature demonstrated: Getting object addresses from events using `includeEvents`
 *
 * Run with: npm test
 */

import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";

describe("TipJar Tutorial: Develop → Deploy → Interact", () => {
  // Create a local simulation harness
  const harness = Harness.createLocal();

  // We'll use three accounts: jar owner, donor, and new owner for transfer
  const ownerProfile = "jar_owner";
  const donorProfile = "generous_donor";
  const newOwnerProfile = "new_owner";

  let ownerAddress: string;
  let donorAddress: string;
  let newOwnerAddress: string;
  let codeObjectAddress: string;

  // We'll create two tip jars - addresses are obtained from events
  let coffeeJarAddress: string;
  let projectJarAddress: string;

  // Path to our Move package
  const tipJarPath = path.resolve(__dirname, "../move/tip_jar");

  /**
   * Helper function to extract TipJar address from transaction events
   */
  function getTipJarAddressFromEvents(events: any[]): string {
    const createEvent = events.find((e: any) =>
      e.type.endsWith("::tip_jar::TipJarCreated"),
    );
    if (!createEvent) {
      throw new Error("TipJarCreated event not found in transaction");
    }
    const addr = createEvent.data.tip_jar_address;
    // Ensure address has 0x prefix
    return addr.startsWith("0x") ? addr : `0x${addr}`;
  }

  afterAll(() => {
    harness.cleanup();
  });

  // ============================================================
  // PHASE 1: SETUP - Initialize accounts and fund them
  // ============================================================

  describe("Phase 1: Setup", () => {
    it("initialize CLI profiles", () => {
      // Initialize profiles - this creates keypairs for our test accounts
      harness.init_cli_profile(ownerProfile);
      harness.init_cli_profile(donorProfile);
      harness.init_cli_profile(newOwnerProfile);

      // Get the addresses
      ownerAddress = harness.getAccountAddress(ownerProfile);
      donorAddress = harness.getAccountAddress(donorProfile);
      newOwnerAddress = harness.getAccountAddress(newOwnerProfile);

      expect(ownerAddress).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(donorAddress).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(newOwnerAddress).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it("fund accounts with APT", () => {
      // Fund accounts with 10 APT each (in octas: 1 APT = 100_000_000 octas)
      const fundAmount = 1_000_000_000; // 10 APT

      harness.fundAccount(ownerProfile, fundAmount);
      harness.fundAccount(donorProfile, fundAmount);
      harness.fundAccount(newOwnerProfile, fundAmount);

      // Verify balances
      const ownerBalance = harness.getAPTBalanceFungibleStore(ownerProfile);
      const donorBalance = harness.getAPTBalanceFungibleStore(donorProfile);

      expect(ownerBalance).toBe(BigInt(fundAmount));
      expect(donorBalance).toBe(BigInt(fundAmount));
    });
  });

  // ============================================================
  // PHASE 2: DEPLOY - Deploy TipJar as a code object
  // ============================================================

  describe("Phase 2: Deploy TipJar", () => {
    it("deploy the TipJar contract as a code object", () => {
      const deployResult = harness.deployCodeObject({
        sender: ownerProfile,
        packageDir: tipJarPath,
        packageAddressName: "tip_jar",
      });

      assertTxnSuccess(deployResult);
      codeObjectAddress = deployResult.Result.deployed_object_address;

      expect(codeObjectAddress).toBeDefined();
      expect(codeObjectAddress).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it("verify the deployment via PackageRegistry", () => {
      const registry = harness.viewResource(
        codeObjectAddress,
        "0x1::code::PackageRegistry",
      );

      expect(registry.Result).toBeDefined();

      const tipJarPackage = registry.Result.packages.find(
        (pkg: any) => pkg.name === "TipJar",
      );

      expect(tipJarPackage).toBeDefined();
    });
  });

  // ============================================================
  // PHASE 3: INTERACT - Use TipJar functionality
  // ============================================================

  describe("Phase 3: Interact with TipJar", () => {
    it("create a TipJar named 'Coffee Fund' and get address from events", () => {
      const jarName = "Coffee Fund";

      // Create the TipJar with includeEvents to get the object address
      const createResult = harness.runMoveFunction({
        sender: ownerProfile,
        functionId: `${codeObjectAddress}::tip_jar::create`,
        args: [`string:${jarName}`],
        includeEvents: true, // <-- This fetches events from the transaction
      });

      assertTxnSuccess(createResult);

      // Extract the object address from the TipJarCreated event
      coffeeJarAddress = getTipJarAddressFromEvents(createResult.Result.events);

      expect(coffeeJarAddress).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it("create a second TipJar named 'Project Donations'", () => {
      const jarName = "Project Donations";

      // Create another TipJar - same owner can have multiple
      const createResult = harness.runMoveFunction({
        sender: ownerProfile,
        functionId: `${codeObjectAddress}::tip_jar::create`,
        args: [`string:${jarName}`],
        includeEvents: true,
      });

      assertTxnSuccess(createResult);

      // Extract object address from event
      projectJarAddress = getTipJarAddressFromEvents(
        createResult.Result.events,
      );

      // Verify both jars have different addresses (unnamed objects are non-deterministic)
      expect(coffeeJarAddress).not.toBe(projectJarAddress);
    });

    it("verify jar names", () => {
      const coffeeName = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_name`,
        args: [`address:${coffeeJarAddress}`],
      });
      expect(coffeeName.Result[0]).toBe("Coffee Fund");

      const projectName = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_name`,
        args: [`address:${projectJarAddress}`],
      });
      expect(projectName.Result[0]).toBe("Project Donations");
    });

    it("verify owner of both TipJar objects", () => {
      const owner1 = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_owner`,
        args: [`address:${coffeeJarAddress}`],
      });
      const owner2 = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_owner`,
        args: [`address:${projectJarAddress}`],
      });

      expect(owner1.Result[0]).toBe(ownerAddress);
      expect(owner2.Result[0]).toBe(ownerAddress);
    });

    it("accept donations to Coffee Fund", () => {
      const donationAmount = 50_000_000; // 0.5 APT

      const donateResult = harness.runMoveFunction({
        sender: donorProfile,
        functionId: `${codeObjectAddress}::tip_jar::donate`,
        args: [`address:${coffeeJarAddress}`, `u64:${donationAmount}`],
      });

      assertTxnSuccess(donateResult);
    });

    it("accept donations to Project Donations", () => {
      const donationAmount = 200_000_000; // 2 APT

      const donateResult = harness.runMoveFunction({
        sender: donorProfile,
        functionId: `${codeObjectAddress}::tip_jar::donate`,
        args: [`address:${projectJarAddress}`, `u64:${donationAmount}`],
      });

      assertTxnSuccess(donateResult);
    });

    it("verify different balances in each jar", () => {
      const coffeeBalance = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_balance`,
        args: [`address:${coffeeJarAddress}`],
      });
      const projectBalance = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_balance`,
        args: [`address:${projectJarAddress}`],
      });

      expect(coffeeBalance.Result[0]).toBe("50000000"); // 0.5 APT
      expect(projectBalance.Result[0]).toBe("200000000"); // 2 APT
    });

    it("allow owner to withdraw from Coffee Fund", () => {
      const withdrawResult = harness.runMoveFunction({
        sender: ownerProfile,
        functionId: `${codeObjectAddress}::tip_jar::withdraw`,
        args: [`address:${coffeeJarAddress}`],
      });

      assertTxnSuccess(withdrawResult);

      const balance = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_balance`,
        args: [`address:${coffeeJarAddress}`],
      });

      expect(balance.Result[0]).toBe("0");
    });

    it("transfer Project Donations jar to new owner", () => {
      const transferResult = harness.runMoveFunction({
        sender: ownerProfile,
        functionId: `${codeObjectAddress}::tip_jar::transfer`,
        args: [`address:${projectJarAddress}`, `address:${newOwnerAddress}`],
      });

      assertTxnSuccess(transferResult);

      const owner = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_owner`,
        args: [`address:${projectJarAddress}`],
      });

      expect(owner.Result[0]).toBe(newOwnerAddress);
    });

    it("allow new owner to withdraw from Project Donations", () => {
      const withdrawResult = harness.runMoveFunction({
        sender: newOwnerProfile,
        functionId: `${codeObjectAddress}::tip_jar::withdraw`,
        args: [`address:${projectJarAddress}`],
      });

      assertTxnSuccess(withdrawResult);

      const balance = harness.runViewFunction({
        functionId: `${codeObjectAddress}::tip_jar::get_balance`,
        args: [`address:${projectJarAddress}`],
      });

      expect(balance.Result[0]).toBe("0");
    });
  });
});
