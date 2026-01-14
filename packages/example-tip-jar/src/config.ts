/**
 * Config and credentials management
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface Config {
  network: string; // "devnet" | "testnet" | "mainnet" | custom URL
  codeAddress?: string;
  jars?: Record<string, string>;
}

export interface Credentials {
  accounts: Record<string, string>; // name -> private key
  apiKey?: string;
}

const DEFAULT_CONFIG_PATH = "config.json";
const DEFAULT_CREDENTIALS_PATH = path.join(
  os.homedir(),
  ".tip-jar",
  "credentials.json",
);

/**
 * Load config from file.
 */
export function loadConfig(configPath?: string): Config {
  const filePath = path.resolve(configPath ?? DEFAULT_CONFIG_PATH);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Config file not found: ${filePath}\nCreate one with: npm run init`,
    );
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Config;
}

/**
 * Save config to file.
 */
export function saveConfig(config: Config, configPath?: string): void {
  const filePath = path.resolve(configPath ?? DEFAULT_CONFIG_PATH);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Load credentials from file.
 */
export function loadCredentials(credentialsPath?: string): Credentials {
  const filePath = path.resolve(credentialsPath ?? DEFAULT_CREDENTIALS_PATH);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Credentials file not found: ${filePath}\n` +
        `Create ${DEFAULT_CREDENTIALS_PATH} with your accounts and API key.\n` +
        "See credentials.template.json for the format.",
    );
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Credentials;
}

/**
 * Get private key for an account.
 */
export function getPrivateKey(
  credentials: Credentials,
  accountName: string,
): string {
  const key = credentials.accounts[accountName];
  if (!key) {
    const available = Object.keys(credentials.accounts).join(", ");
    throw new Error(
      `Account "${accountName}" not found in credentials.\n` +
        `Available accounts: ${available}`,
    );
  }
  return key;
}

/**
 * Get jar address by name or return as-is if it looks like an address.
 */
export function resolveJarAddress(
  config: Config,
  jarNameOrAddress: string,
): string {
  // If it looks like an address, return as-is
  if (jarNameOrAddress.startsWith("0x")) {
    return jarNameOrAddress;
  }

  // Look up in config
  const address = config.jars?.[jarNameOrAddress];
  if (!address) {
    const available =
      config.jars && Object.keys(config.jars).length > 0
        ? `Available jars: ${Object.keys(config.jars).join(", ")}`
        : "No jars configured. Create one with: npm run create";
    throw new Error(
      `Jar "${jarNameOrAddress}" not found in config.\n${available}`,
    );
  }
  return address;
}

/**
 * Add a jar to config.
 */
export function addJarToConfig(
  config: Config,
  name: string,
  address: string,
  configPath?: string,
): void {
  if (!config.jars) {
    config.jars = {};
  }
  config.jars[name] = address;
  saveConfig(config, configPath);
}
