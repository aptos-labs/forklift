/**
 * TipJar Integration Tests
 *
 * Tests the TipJar contract using the workflow functions.
 */

import { Harness } from "@aptos-labs/forklift";
import {
  deployPackage,
  upgradePackage,
  createJar,
  donate,
  withdraw,
  transfer,
  getBalance,
  getName,
  getOwner,
  normalizeAddress,
} from "../workflows";

describe("TipJar", () => {
  const harness = Harness.createLocal();

  // Test profiles
  const owner = "owner";
  const donor1 = "donor1";
  const donor2 = "donor2";
  const newOwner = "new_owner";

  // Addresses populated during tests
  let ownerAddress: string;
  let donor1Address: string;
  let donor2Address: string;
  let newOwnerAddress: string;
  let codeAddress: string;
  let jarAddress: string;

  beforeAll(() => {
    // Initialize profiles
    harness.init_cli_profile(owner);
    harness.init_cli_profile(donor1);
    harness.init_cli_profile(donor2);
    harness.init_cli_profile(newOwner);

    ownerAddress = harness.getAccountAddress(owner);
    donor1Address = harness.getAccountAddress(donor1);
    donor2Address = harness.getAccountAddress(donor2);
    newOwnerAddress = harness.getAccountAddress(newOwner);

    // Fund accounts
    harness.fundAccount(owner, 1_000_000_000);
    harness.fundAccount(donor1, 1_000_000_000);
    harness.fundAccount(donor2, 1_000_000_000);
    harness.fundAccount(newOwner, 1_000_000_000);
  });

  afterAll(() => {
    harness.cleanup();
  });

  describe("deployment", () => {
    it("deploy contract", () => {
      codeAddress = deployPackage(harness, owner);
      expect(codeAddress).toMatch(/^0x[a-fA-F0-9]+$/);
    });
  });

  describe("create jar", () => {
    it("create a tip jar", () => {
      jarAddress = createJar(harness, codeAddress, owner, "BBQ Fund");
      expect(jarAddress).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it("jar has correct name", () => {
      expect(getName(harness, codeAddress, jarAddress)).toBe("BBQ Fund");
    });

    it("jar has correct owner", () => {
      expect(getOwner(harness, codeAddress, jarAddress)).toBe(
        normalizeAddress(ownerAddress),
      );
    });

    it("jar starts with zero balance", () => {
      expect(getBalance(harness, codeAddress, jarAddress)).toBe(0n);
    });
  });

  describe("donations", () => {
    it("accept donations from multiple donors", () => {
      // Donor 1 donates 0.5 APT
      donate(harness, codeAddress, donor1, jarAddress, 50_000_000);
      expect(getBalance(harness, codeAddress, jarAddress)).toBe(50_000_000n);

      // Donor 2 donates 1 APT
      donate(harness, codeAddress, donor2, jarAddress, 100_000_000);
      expect(getBalance(harness, codeAddress, jarAddress)).toBe(150_000_000n);
    });
  });

  describe("withdrawal", () => {
    it("owner can withdraw and receives funds", () => {
      const jarBalanceBefore = getBalance(harness, codeAddress, jarAddress);
      const ownerBalanceBefore = harness.getAPTBalanceFungibleStore(owner);

      withdraw(harness, codeAddress, owner, jarAddress);

      const jarBalanceAfter = getBalance(harness, codeAddress, jarAddress);
      const ownerBalanceAfter = harness.getAPTBalanceFungibleStore(owner);

      // Jar should be empty
      expect(jarBalanceAfter).toBe(0n);

      // Owner should have received the funds (minus gas)
      const received = ownerBalanceAfter - ownerBalanceBefore;
      // Allow for gas costs (received should be close to jarBalanceBefore)
      expect(received).toBeGreaterThan(jarBalanceBefore - 1_000_000n); // within 0.01 APT of expected
      expect(received).toBeLessThanOrEqual(jarBalanceBefore);
    });
  });

  describe("transfer ownership", () => {
    it("donate some funds to the jar", () => {
      donate(harness, codeAddress, donor1, jarAddress, 100_000_000);
      expect(getBalance(harness, codeAddress, jarAddress)).toBe(100_000_000n);
    });

    it("transfer to new owner", () => {
      transfer(harness, codeAddress, owner, jarAddress, newOwnerAddress);
      expect(getOwner(harness, codeAddress, jarAddress)).toBe(
        normalizeAddress(newOwnerAddress),
      );
    });

    it("new owner can withdraw and receives funds", () => {
      const jarBalanceBefore = getBalance(harness, codeAddress, jarAddress);
      const newOwnerBalanceBefore =
        harness.getAPTBalanceFungibleStore(newOwner);

      withdraw(harness, codeAddress, newOwner, jarAddress);

      const jarBalanceAfter = getBalance(harness, codeAddress, jarAddress);
      const newOwnerBalanceAfter = harness.getAPTBalanceFungibleStore(newOwner);

      // Jar should be empty
      expect(jarBalanceAfter).toBe(0n);

      // New owner should have received the funds (minus gas)
      const received = newOwnerBalanceAfter - newOwnerBalanceBefore;
      expect(received).toBeGreaterThan(jarBalanceBefore - 1_000_000n);
      expect(received).toBeLessThanOrEqual(jarBalanceBefore);
    });
  });

  describe("upgrade", () => {
    it("upgrade contract code", () => {
      // Upgrade the contract (same code, just testing the upgrade mechanism)
      upgradePackage(harness, owner, codeAddress);
    });

    it("contract still works after upgrade", () => {
      // Create a new jar after upgrade
      const newJarAddress = createJar(
        harness,
        codeAddress,
        owner,
        "Post-Upgrade Jar",
      );
      expect(newJarAddress).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(getName(harness, codeAddress, newJarAddress)).toBe(
        "Post-Upgrade Jar",
      );

      // Donate and withdraw work
      donate(harness, codeAddress, donor1, newJarAddress, 10_000_000);
      expect(getBalance(harness, codeAddress, newJarAddress)).toBe(10_000_000n);

      withdraw(harness, codeAddress, owner, newJarAddress);
      expect(getBalance(harness, codeAddress, newJarAddress)).toBe(0n);
    });

    it("existing jars still work after upgrade", () => {
      // The original jar should still work
      donate(harness, codeAddress, donor2, jarAddress, 25_000_000);
      expect(getBalance(harness, codeAddress, jarAddress)).toBe(25_000_000n);
    });
  });
});
