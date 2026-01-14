/**
 * CLI argument utilities
 */

import minimist from "minimist";

/**
 * Parse command line arguments.
 */
export function parseArgs(): minimist.ParsedArgs {
  return minimist(process.argv.slice(2));
}

/**
 * Get a required argument or throw error.
 */
export function requireArg(args: minimist.ParsedArgs, name: string): string {
  const value = args[name];
  if (!value) {
    throw new Error(`Missing required argument: --${name}`);
  }
  return String(value);
}

/**
 * Format octas as APT for display.
 */
export function formatApt(octas: bigint | number): string {
  const apt = Number(octas) / 100_000_000;
  return `${apt} APT`;
}

/**
 * Parse APT string to octas.
 * Accepts: "1" (APT), "1.5" (APT), "100000000" (octas if > 1000)
 */
export function parseAmount(value: string): number {
  const num = parseFloat(value);
  // If it looks like octas (large number), use as-is
  if (num >= 1000) {
    return Math.floor(num);
  }
  // Otherwise treat as APT and convert to octas
  return Math.floor(num * 100_000_000);
}
