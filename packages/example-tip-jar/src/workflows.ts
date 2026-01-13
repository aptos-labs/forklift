/**
 * TipJar Workflows
 *
 * Reusable workflow functions for interacting with the TipJar contract.
 * These can be used in tests, scripts, or any other context.
 */

import { Harness } from "@aptos-labs/forklift";
import * as path from "path";

// Path to the Move package
export const TIP_JAR_PACKAGE_DIR = path.resolve(__dirname, "../move/tip_jar");

/**
 * Normalize an address to have consistent format (lowercase, with 0x prefix).
 * Removes leading zeros after 0x for comparison consistency.
 */
export function normalizeAddress(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  // Remove leading zeros but keep at least one character
  const trimmed = hex.replace(/^0+/, "") || "0";
  return `0x${trimmed}`;
}

/**
 * Assert a transaction was successful.
 */
function assertSuccess(res: any): void {
  if (!res.Result?.success) {
    throw new Error(`Transaction failed:\n${JSON.stringify(res, null, 2)}`);
  }
}

/**
 * Deploy the TipJar package as a code object.
 * Returns the code object address.
 */
export function deployPackage(harness: Harness, sender: string): string {
  const result = harness.deployCodeObject({
    sender,
    packageDir: TIP_JAR_PACKAGE_DIR,
    packageAddressName: "tip_jar",
  });
  assertSuccess(result);
  return result.Result.deployed_object_address;
}

/**
 * Upgrade the TipJar package.
 */
export function upgradePackage(
  harness: Harness,
  sender: string,
  codeAddress: string,
): void {
  const result = harness.upgradeCodeObject({
    sender,
    packageDir: TIP_JAR_PACKAGE_DIR,
    packageAddressName: "tip_jar",
    objectAddress: codeAddress,
  });
  assertSuccess(result);
}

/**
 * Create a new TipJar.
 * Returns the tip jar object address (extracted from events).
 */
export function createJar(
  harness: Harness,
  codeAddress: string,
  sender: string,
  name: string,
): string {
  const result = harness.runMoveFunction({
    sender,
    functionId: `${codeAddress}::tip_jar::create`,
    args: [`string:${name}`],
    includeEvents: true,
  });
  assertSuccess(result);

  // Extract jar address from TipJarCreated event
  const event = result.Result.events.find((e: any) =>
    e.type.endsWith("::tip_jar::TipJarCreated"),
  );
  if (!event) {
    throw new Error("TipJarCreated event not found");
  }
  const addr = event.data.tip_jar_address;
  return addr.startsWith("0x") ? addr : `0x${addr}`;
}

/**
 * Donate APT to a tip jar.
 * Amount is in octas (1 APT = 100_000_000 octas).
 */
export function donate(
  harness: Harness,
  codeAddress: string,
  sender: string,
  jarAddress: string,
  amount: number,
): void {
  const result = harness.runMoveFunction({
    sender,
    functionId: `${codeAddress}::tip_jar::donate`,
    args: [`address:${jarAddress}`, `u64:${amount}`],
  });
  assertSuccess(result);
}

/**
 * Withdraw all funds from a tip jar (owner only).
 */
export function withdraw(
  harness: Harness,
  codeAddress: string,
  owner: string,
  jarAddress: string,
): void {
  const result = harness.runMoveFunction({
    sender: owner,
    functionId: `${codeAddress}::tip_jar::withdraw`,
    args: [`address:${jarAddress}`],
  });
  assertSuccess(result);
}

/**
 * Transfer ownership of a tip jar to a new owner.
 */
export function transfer(
  harness: Harness,
  codeAddress: string,
  owner: string,
  jarAddress: string,
  newOwner: string,
): void {
  const result = harness.runMoveFunction({
    sender: owner,
    functionId: `${codeAddress}::tip_jar::transfer`,
    args: [`address:${jarAddress}`, `address:${newOwner}`],
  });
  assertSuccess(result);
}

/**
 * Get the balance of a tip jar (in octas).
 */
export function getBalance(
  harness: Harness,
  codeAddress: string,
  jarAddress: string,
): bigint {
  const result = harness.runViewFunction({
    functionId: `${codeAddress}::tip_jar::get_balance`,
    args: [`address:${jarAddress}`],
  });
  return BigInt(result.Result[0]);
}

/**
 * Get the name of a tip jar.
 */
export function getName(
  harness: Harness,
  codeAddress: string,
  jarAddress: string,
): string {
  const result = harness.runViewFunction({
    functionId: `${codeAddress}::tip_jar::get_name`,
    args: [`address:${jarAddress}`],
  });
  return result.Result[0];
}

/**
 * Get the owner address of a tip jar.
 */
export function getOwner(
  harness: Harness,
  codeAddress: string,
  jarAddress: string,
): string {
  const result = harness.runViewFunction({
    functionId: `${codeAddress}::tip_jar::get_owner`,
    args: [`address:${jarAddress}`],
  });
  return normalizeAddress(result.Result[0]);
}
