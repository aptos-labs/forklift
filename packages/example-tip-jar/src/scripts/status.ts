/**
 * Get status of a TipJar (name, balance, owner).
 *
 * Usage:
 *   npm run status -- --jar <name|address>
 *
 * Options:
 *   --jar          Jar name (from config) or address (required)
 *   --config       Config file path (default: config.json)
 *   --credentials  Credentials file path (default: ~/.tip-jar/credentials.json)
 */

import { Harness } from "@aptos-labs/forklift";
import { parseArgs, requireArg, formatApt } from "../args";
import { loadConfig, loadCredentials, resolveJarAddress } from "../config";
import { getBalance, getName, getOwner } from "../workflows";

const args = parseArgs();
const jarNameOrAddress = requireArg(args, "jar");
const configPath = args.config as string | undefined;
const credentialsPath = args.credentials as string | undefined;

const config = loadConfig(configPath);
const credentials = loadCredentials(credentialsPath);
const jarAddress = resolveJarAddress(config, jarNameOrAddress);

if (!config.codeAddress) {
  throw new Error("No codeAddress in config. Run deploy first.");
}

// Balance check uses fork mode (read-only)
const harness = Harness.createNetworkFork(
  config.network,
  credentials.apiKey ?? "",
);

try {
  const name = getName(harness, config.codeAddress, jarAddress);
  const balance = getBalance(harness, config.codeAddress, jarAddress);
  const owner = getOwner(harness, config.codeAddress, jarAddress);

  console.log(`TipJar: ${name}`);
  console.log(`  Address: ${jarAddress}`);
  console.log(`  Balance: ${formatApt(balance)}`);
  console.log(`  Owner: ${owner}`);
} finally {
  harness.cleanup();
}
