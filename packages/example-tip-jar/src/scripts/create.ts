/**
 * Create a new TipJar.
 *
 * Usage:
 *   npm run create -- --jar <name> --account <account_name> [--live]
 *
 * Options:
 *   --jar          Name for the new tip jar (required)
 *   --account      Account name from credentials (required)
 *   --config       Config file path (default: config.json)
 *   --credentials  Credentials file path (default: ~/.tip-jar/credentials.json)
 *   --live         Actually create (default: fork/dry-run mode)
 */

import { Harness } from "@aptos-labs/forklift";
import { parseArgs, requireArg } from "../args";
import {
  loadConfig,
  loadCredentials,
  getPrivateKey,
  addJarToConfig,
} from "../config";
import { createJar } from "../workflows";

const args = parseArgs();
const jarName = requireArg(args, "jar");
const accountName = requireArg(args, "account");
const configPath = args.config as string | undefined;
const credentialsPath = args.credentials as string | undefined;
const isLive = args.live === true;

const config = loadConfig(configPath);
const credentials = loadCredentials(credentialsPath);
const privateKey = getPrivateKey(credentials, accountName);

if (!config.codeAddress) {
  throw new Error("No codeAddress in config. Run deploy first.");
}

console.log("Creating TipJar...");
console.log(`  Name: ${jarName}`);
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

  const jarAddress = createJar(
    harness,
    config.codeAddress,
    accountName,
    jarName,
  );

  console.log("\n✓ Created successfully!");
  console.log(`  Jar address: ${jarAddress}`);

  // Add to config
  if (isLive) {
    const jarKey = jarName.toLowerCase().replace(/\s+/g, "-");
    addJarToConfig(config, jarKey, jarAddress, configPath);
    console.log(`\n✓ Added "${jarKey}" to config.json`);
  } else {
    console.log(
      "\n(Dry-run mode - config not updated. Use --live to create for real.)",
    );
  }
} finally {
  harness.cleanup();
}
