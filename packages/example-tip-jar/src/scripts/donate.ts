/**
 * Donate APT to a TipJar.
 *
 * Usage:
 *   npm run donate -- --jar <name|address> --amount <apt> --account <account_name> [--live]
 *
 * Options:
 *   --jar          Jar name (from config) or address (required)
 *   --amount       Amount to donate in APT (required, e.g., "0.5" or "1.5")
 *   --account      Account name from credentials (required)
 *   --config       Config file path (default: config.json)
 *   --credentials  Credentials file path (default: ~/.tip-jar/credentials.json)
 *   --live         Actually donate (default: fork/dry-run mode)
 */

import { Harness } from "@aptos-labs/forklift";
import { parseArgs, requireArg, parseAmount, formatApt } from "../args";
import {
  loadConfig,
  loadCredentials,
  getPrivateKey,
  resolveJarAddress,
} from "../config";
import { donate } from "../workflows";

const args = parseArgs();
const jarNameOrAddress = requireArg(args, "jar");
const amount = parseAmount(requireArg(args, "amount"));
const accountName = requireArg(args, "account");
const configPath = args.config as string | undefined;
const credentialsPath = args.credentials as string | undefined;
const isLive = args.live === true;

const config = loadConfig(configPath);
const credentials = loadCredentials(credentialsPath);
const privateKey = getPrivateKey(credentials, accountName);
const jarAddress = resolveJarAddress(config, jarNameOrAddress);

if (!config.codeAddress) {
  throw new Error("No codeAddress in config. Run deploy first.");
}

console.log("Donating to TipJar...");
console.log(`  Jar: ${jarNameOrAddress} (${jarAddress})`);
console.log(`  Amount: ${formatApt(amount)}`);
console.log(`  Network: ${config.network}`);
console.log(`  Account: ${accountName}`);
console.log(`  Mode: ${isLive ? "LIVE" : "fork (dry-run)"}`);

if (isLive) {
  console.log("\n⚠️  LIVE MODE - This will cost gas!\n");
}

const harness = isLive
  ? Harness.createLive(config.network)
  : Harness.createNetworkFork(config.network, credentials.apiKey ?? "");

try {
  harness.init_cli_profile(accountName, privateKey);

  donate(harness, config.codeAddress, accountName, jarAddress, amount);

  console.log("\n✓ Donated successfully!");
} finally {
  harness.cleanup();
}
