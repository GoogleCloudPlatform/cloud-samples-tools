/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {execSync} from 'node:child_process';

const version = 'v0.4.0'; // x-release-please-version

export type CISetup = {
  // Environment variables to export.
  env?: {[k: string]: string};

  // Secret Manager secrets to export.
  secrets?: {[k: string]: string};

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  // Other fields can be here, but are not required.
  // They can be any type, the ci-setup files are validated
  // against the defaults defined in the config file.
  [k: string]: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

export type Command = {
  // Run before the main command, at the repo root.
  pre?: string | string[];

  // The main command, at the package path.
  run?: string | string[];

  // Run after the main command, at the repo root.
  post?: string | string[];
};

export type Config = {
  // Filename to look for the root of a package.
  'package-file'?: string | string[];

  // CI setup file, must be located in the same directory as the package file.
  'ci-setup-filename'?: string | string[];

  // CI setup defaults, used when no setup file or field is not sepcified in file.
  'ci-setup-defaults'?: CISetup;

  // CI setup help URL, shown when a setup file validation fails.
  'ci-setup-help-url'?: string;

  // Pattern to match filenames or directories.
  match?: string | string[];

  // Pattern to ignore filenames or directories.
  ignore?: string | string[];

  // Commands like `custard run <config-file> <command> [args]...`
  commands?: {[k: string]: Command};

  // Packages to always exclude.
  'exclude-packages'?: string | string[];
};

/**
 * @param flags command line flags
 * @returns usage string
 */
function usage(flags: string): string {
  return `usage: node custard.ts ${flags}`;
}

switch (process.env.CUSTARD_VERBOSE || 'info') {
  case 'debug':
    break;
  case 'info':
    console.debug = () => {};
    break;
  case 'warn':
    console.debug = () => {};
    console.info = () => {};
    console.log = () => {};
    break;
  case 'error':
    console.debug = () => {};
    console.info = () => {};
    console.log = () => {};
    console.warn = () => {};
    break;
  default:
    console.error(
      'Unknown CUSTARD_VERBOSE value:',
      process.env.CUSTARD_VERBOSE,
    );
    console.error('If set, it must be one of: debug, info, warn, error');
    /* eslint-disable n/no-process-exit */
    process.exit(1);
  /* eslint-enable n/no-process-exit */
}

/**
 * Finds the packages that have been affected from diffs.
 *
 * A package is defined by a path containing a package-file as defined
 * in the config file.
 *
 * A diff from a file in a directory without a package-file is
 * considered a global diff.
 * If there are diffs on at leat one global file, this could be a global
 * config file, so this "marks" all packages as affected.
 *
 * @param config config object
 * @param diffs list of files changed
 * @returns list of affected packages
 */
export function affected(config: Config, diffs: string[]): string[] {
  const packages = matchPackages(config, diffs);
  if (packages.includes('.')) {
    console.error(
      '⚠️ One or more global files changed, all packages affected.',
    );
    return [...findPackages(config, '.')];
  }
  return packages;
}

export function matches(fullPath: string, patterns: string[]): boolean {
  const filename = path.basename(fullPath);
  for (const pattern of patterns) {
    // 1) Exact full match
    if (pattern === fullPath) {
      return true;
    }
    // 2) Exact filename match
    if (pattern === filename) {
      return true;
    }
    // 3) Glob pattern match
    //    Node does not support glob patterns as part of the standard library,
    //    so to avoid third-party dependencies we convert them to a regex.
    const glob = pattern
      .split(/(\*\*|\*|\.)/)
      .map(token => ({'**': '.*', '*': '[^/]*', '.': '\\.'})[token] ?? token)
      .join('');
    if (new RegExp(`(^|/)${glob}$`).test(fullPath)) {
      return true;
    }

    // 4) Regular expression match
    if (new RegExp(`(^|/)${pattern}$`).test(fullPath)) {
      return true;
    }
  }
  return false;
}

export function fileMatchesConfig(config: Config, filepath: string): boolean {
  const match = asArray(config.match) || ['*'];
  const ignore = asArray(config.ignore) || [];
  return matches(filepath, match) && !matches(filepath, ignore);
}

export function matchPackages(config: Config, paths: string[]): string[] {
  const packages = new Set<string>();
  for (const filepath of paths) {
    if (!fileMatchesConfig(config, filepath)) {
      // The file doesn't match the config file, so skip it.
      continue;
    }
    const pkg = getPackageDir(config, filepath);
    if (pkg === null) {
      // The package directory does not exist, it might have been removed.
      // We can't run anything on it, so skip it.
      console.error(
        `⚠️ path '${pkg}' does not exist, it might have been removed.`,
      );
      continue;
    }
    if (pkg === '.') {
      // Warn which file was considered a global change for debugging.
      console.error(`⚠️ Global file changed: ${pkg}`);
    }
    packages.add(pkg);
  }

  // Return all the affected packages, removing any excluded ones.
  // Excluded packages must be exact full matches.
  const excluded = asArray(config['exclude-packages']) || [];
  return [...packages].filter(pkg => !excluded.includes(pkg));
}

export function* findPackages(config: Config, root: string): Generator<string> {
  const excluded = asArray(config['exclude-packages']) || [];
  const files = fs.readdirSync(root, {withFileTypes: true});
  for (const file of files) {
    const fullPath = path.join(root, file.name);
    if (file.isDirectory()) {
      if (isPackageDir(config, fullPath) && !excluded.includes(fullPath)) {
        yield fullPath;
      }
      yield* findPackages(config, fullPath);
    }
  }
}

export function getPackageDir(config: Config, filepath: string): string | null {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    return null;
  }
  if (dir === '.' || isPackageDir(config, dir)) {
    return dir;
  }
  return getPackageDir(config, dir);
}

export function isPackageDir(config: Config, dir: string): boolean {
  for (const pkgFile of asArray(config['package-file']) ?? []) {
    if (fs.existsSync(path.join(dir, pkgFile))) {
      return true;
    }
  }
  return false;
}

/**
 * Run a command defined in the config file.
 *
 * Defines the environment variables and secrets, runs the command,
 * and then cleans up the environment to its previous state.
 *
 * @param config config object
 * @param cmd command to run
 * @param paths paths to the packages
 * @param env environment variables
 */
export function run(
  config: Config,
  cmd: Command,
  paths: string[],
  env = process.env,
) {
  if (cmd.pre) {
    const steps = asArray(cmd.pre) || [];
    for (const step of steps) {
      console.warn(`\n➜ [root]$ ${step}`);
      const start = Date.now();
      execSync(step, {stdio: 'inherit'});
      const end = Date.now();
      console.info(`Done in ${Math.round((end - start) / 1000)}s`);
    }
  }
  const failures = [];
  if (cmd.run) {
    for (const path of paths) {
      console.warn('\n➜ Configuring ci-setup');
      const start = Date.now();
      const defined = setup(config, path, env);
      const end = Date.now();
      console.info(`Done in ${Math.round((end - start) / 1000)}s`);
      try {
        // For each path, stop on the first command failure.
        const steps = asArray(cmd.run) || [];
        for (const step of steps) {
          console.warn(`\n➜ ${path}$ ${step}`);
          const start = Date.now();
          execSync(step, {stdio: 'inherit', cwd: path});
          const end = Date.now();
          console.info(`Done in ${Math.round((end - start) / 1000)}s`);
        }
      } catch (e) {
        // Run all paths always, catch the exception and report errors.
        console.error(`${e}`);
        failures.push(path);
      } finally {
        // Clean up the environment variables that were defined.
        // This keeps the environment clean for subsequent runs.
        for (const envVar of defined) {
          delete env[envVar];
        }
      }
    }
  }
  if (cmd.post) {
    const steps = asArray(cmd.post) || [];
    for (const step of steps) {
      console.warn(`\n➜ [root]$ ${step}`);
      const start = Date.now();
      execSync(step, {stdio: 'inherit'});
      const end = Date.now();
      console.info(`Done in ${Math.round((end - start) / 1000)}s`);
    }
  }

  if (paths.length > 1) {
    console.info(`\n=== Summary (${paths.length} packages) ===`);
    console.info(`  Passed: ${paths.length - failures.length}`);
    console.info(`  Failed: ${failures.length}`);
  }
  if (failures.length > 0) {
    throw new Error(`Failed:\n${failures.map(path => `- ${path}`).join('\n')}`);
  }
}

/**
 * Defines the environment variables and secrets.
 *
 * @param config config object
 * @param packagetPath path to the package
 * @param env environment variables
 * @returns environment variables that were defined
 */
export function setup(
  config: Config,
  packagetPath: string,
  env = process.env,
): string[] {
  const defaults = config['ci-setup-defaults'] || {};
  const ciSetup = loadCISetup(config, packagetPath);
  console.debug(`ci-setup defaults: ${JSON.stringify(defaults, null, 2)}`);
  console.debug(`ci-setup.json: ${JSON.stringify(ciSetup, null, 2)}`);

  const definedBefore = new Set(Object.keys(env));
  const vars = listEnv(env, ciSetup.env || {}, defaults.env || {});
  for (const [key, value] of vars) {
    env[key] = value;
  }

  // Export aliases required by tests.
  env.GOOGLE_SAMPLES_PROJECT = env.PROJECT_ID;

  const secrets = listSecrets(
    env,
    ciSetup.secrets || {},
    defaults.secrets || {},
  );
  for (const [key, value] of secrets) {
    env[key] = value;
  }
  return [...Object.keys(env)].filter(x => !definedBefore.has(x));
}

/**
 * List environment variables based on the config file and ci-setup file.
 *
 * @param env environment variables
 * @param ciSetup ci-setup variables
 * @param defaults variables default values from the config file
 * @returns generator of the environment variables
 */
export function* listEnv(
  env: NodeJS.ProcessEnv = {},
  ciSetup: {[k: string]: string} = {},
  defaults: {[k: string]: string} = {},
): Generator<[string, string]> {
  const automatic = {
    PROJECT_ID: () => defaultProject(),
    RUN_ID: () => uniqueId(),
    SERVICE_ACCOUNT: () => '',
  };
  console.info('Environment variables:');
  const vars = [...listVars(env, ciSetup, defaults, automatic)];
  const subs = Object.fromEntries(vars.map(([key, {value}]) => [key, value]));
  for (const [key, {value, source}] of vars) {
    const result = substitute(subs, value);
    console.info(`  ${key}: ${JSON.stringify(result)} (${source})`);
    yield [key, result];
  }
}

/**
 * List secret variables based on the config file and ci-setup file.
 *
 * @param env environment variables
 * @param ciSetup ci-setup secrets
 * @param defaults secrets default values from the config file
 * @returns generator of the secrets
 */
export function* listSecrets(
  env: NodeJS.ProcessEnv = {},
  ciSetup: {[k: string]: string} = {},
  defaults: {[k: string]: string} = {},
): Generator<[string, string]> {
  const automatic = {
    // Set global secret for the Service Account identity token
    // Use in place of 'gcloud auth print-identity-token' or auth.getIdTokenClient
    // usage: curl -H 'Bearer: $ID_TOKEN' https://
    ID_TOKEN: () => getIdToken(env.PROJECT_ID),
  };
  console.info('Secrets:');
  const vars = listVars(env, ciSetup, defaults, automatic, accessSecret);
  for (const [key, {value: value, source}] of vars) {
    // ⚠️ DO NOT print the secret value.
    console.info(`  ${key}: "***" (${source})`);
    yield [key, value];
  }
}

/**
 * List variables based on the config file and ci-setup file.
 *
 * @param env environment variables
 * @param ciSetup ci-setup variables
 * @param defaults variables default values from the config file
 * @param automatic automatic variables
 * @param transform optional function to apply to the variable values
 * @returns generator of the variables
 */
export function* listVars(
  env: NodeJS.ProcessEnv = {},
  ciSetup: {[k: string]: string} = {},
  defaults: {[k: string]: string} = {},
  automatic: {[k: string]: () => string} = {},
  transform: (value: string) => string = x => x,
): Generator<[string, {value: string; source: string}]> {
  for (const key in {...automatic, ...defaults, ...ciSetup}) {
    if (key in env) {
      // 1) User defined via an environment variable.
      const value = env[key] || '';
      yield [key, {value, source: 'user-defined'}];
    } else if (key in ciSetup) {
      // 2) From the local ci-setup.json file.
      const value = transform(ciSetup[key]);
      yield [key, {value, source: 'ci-setup.json'}];
    } else if (key in defaults) {
      // 3) Defaults from the config file.
      const value = transform(defaults[key]);
      yield [key, {value, source: 'default value'}];
    } else if (key in automatic) {
      // 4) Automatic variables.
      const value = automatic[key]();
      yield [key, {value, source: 'automatic var'}];
    } else {
      // Unreachable.
      throw new Error(`Undefined variable: ${key}`);
    }
  }
}

/**
 * Loads and validates a config file.
 *
 * @param filePath path to the config file
 * @returns config object
 */
export function loadConfig(filePath: string): Config {
  const config: Config = loadJsonc(filePath);

  // Default values.
  if (!config.match) {
    config.match = ['*'];
  }

  // Validation.
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error(
      `❌ validation errors in config file: ${filePath}\n` +
        errors.map(e => `- ${e}`).join('\n'),
    );
  }

  return config;
}

/**
 * Loads and validates a CI setup file.
 *
 * @param config config object
 * @param packagePath path to the package
 * @returns ci-setup object
 */
export function loadCISetup(config: Config, packagePath: string): CISetup {
  const defaultNames = ['ci-setup.jsonc', 'ci-setup.json'];
  const filenames = asArray(config['ci-setup-filename']) || defaultNames;
  for (const filename of filenames) {
    const ciSetupPath = path.join(packagePath, filename);
    if (fs.existsSync(ciSetupPath)) {
      const ciSetup: CISetup = loadJsonc(ciSetupPath);
      const errors = validateCISetup(config, ciSetup);
      if (errors.length > 0) {
        throw new Error(
          `❌ validation errors in CI setup file: ${ciSetupPath}\n` +
            errors.map(e => `- ${e}`).join('\n') +
            (config['ci-setup-help-url']
              ? `\nSee ${config['ci-setup-help-url']}`
              : '') +
            '\n',
        );
      }
      return ciSetup;
    }
  }
  console.debug(`No CI setup found for '${packagePath}'`);
  return {};
}

/**
 * Loads a JSON with Comments (JSONC) file.
 *
 * @param filePath path to the JSONC file
 * @returns JSON object
 */
export function loadJsonc(filePath: string) {
  const jsoncData = fs.readFileSync(filePath, 'utf8');
  const jsonData = jsoncData
    .replaceAll(/\s*\/\*.*?\*\//gs, '') // remove multi-line comments
    .replaceAll(/(^\s*|[,{}[\]"\d]\s*)\/\/.*/gm, '$1'); // remove single-line comments
  return JSON.parse(jsonData);
}

/**
 * Applies variable interpolation to the given variables.
 *
 * @param subs variable substitutions
 * @param value original value
 * @returns value after substitutions
 */
export function substitute(subs: {[k: string]: string}, value: string): string {
  for (const key in subs) {
    const re = new RegExp(`\\$(${key}\\b|\\{\\s*${key}\\s*\\})`, 'g');
    // JavaScript doesn't allow lazy substitutions, so we check if
    // the substitution needs to be done first.
    if (value.match(re)) {
      // Substitute recursively to handle nested substitutions.
      // Since JS doesn't do lazy evaluation, this is technically
      // O(n^2) worst case, but in reality we should only have a
      // handful of variables with a couple of levels of recursion.
      // Doing graph traversals or topological sort should not be
      // needed, unless we get into a pathological case.
      value = value.replaceAll(re, substitute(subs, subs[key]));
    }
  }
  return value;
}

/**
 * Generates a random alphanumeric ID.
 *
 * @param length length of the ID
 * @returns random alhpanumeric string
 */
export function uniqueId(length = 6) {
  const min = 2 ** 32;
  const max = 2 ** 64;
  return Math.floor(Math.random() * max + min)
    .toString(36)
    .slice(0, length);
}

/**
 * Gets the default project ID from gcloud.
 *
 * @returns default project ID
 */
function defaultProject(): string {
  const cmd = 'gcloud config get-value project';
  return execSync(cmd).toString().trim();
}

/**
 * Accesses a secret from Secret Manager.
 *
 * @param secretPath secret in the format project-id/secret-id
 * @returns secret value
 */
function accessSecret(secretPath: string): string {
  const [projectId, ...secretIdParts] = secretPath.split('/');
  const secretId = secretIdParts.join('/');
  const cmd = `gcloud --project=${projectId} secrets versions access "latest" --secret=${secretId}`;
  return execSync(cmd).toString();
}

/**
 * Gets the identity token from gcloud.
 *
 * @param projectId Google Cloud project ID
 * @returns identity token
 */
function getIdToken(projectId?: string): string {
  if (projectId) {
    const cmd = `gcloud --project=${projectId} auth print-identity-token`;
    return execSync(cmd).toString().trim();
  }
  return '';
}

/**
 * Normalizes (string | string[]) into string[]
 *
 * @param x string or string[] or undefined
 * @returns string[] or undefined
 */
function asArray(x: string | string[] | undefined): string[] | undefined {
  // If undefined, return undefined.
  if (!x) {
    return undefined;
  }
  // If it's a single string, return a single-element array.
  return Array.isArray(x) ? x : [x];
}

// For validation, the data comes from JSON files, so they can be anything.
// There are no type guarantees, so many of these functions take
// parameters of type `any` and validate the type at runtime.
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Validates the config file.
 *
 * @param config config object
 * @returns a list of validation errors
 */
export function validateConfig(config: any): string[] {
  // Undefined fields.
  let errors = [];
  const validFields = [
    'package-file',
    'ci-setup-filename',
    'ci-setup-defaults',
    'ci-setup-help-url',
    'match',
    'ignore',
    'commands',
    'exclude-packages',
  ];
  for (const key in config) {
    if (!validFields.includes(key)) {
      errors.push(`'${key}' is not a valid field`);
    }
  }

  if (config.commands) {
    for (const name in config.commands) {
      for (const key in config.commands[name]) {
        if (!['pre', 'run', 'post'].includes(key)) {
          errors.push(`'commands.${name}.${key}' is not a valid field`);
        }
      }
    }
  }

  // Type checking.
  errors = errors.concat(
    checkStringOrStrings(config, 'package-file'),
    checkStringOrStrings(config, 'ci-setup-filename'),
    checkMappings(config['ci-setup-defaults'], 'ci-setup-defaults.env'),
    checkMappings(config['ci-setup-defaults'], 'ci-setup-defaults.secrets'),
    checkString(config, 'ci-setup-help-url'),
    checkStringOrStrings(config, 'match'),
    checkStringOrStrings(config, 'ignore'),
    checkStringOrStrings(config, 'exclude-packages'),
  );
  for (const name in config.commands) {
    errors = errors.concat(
      checkStringOrStrings(config.commands[name], `commands.${name}.pre`),
      checkStringOrStrings(config.commands[name], `commands.${name}.run`),
      checkStringOrStrings(config.commands[name], `commands.${name}.post`),
    );
  }
  return errors;
}

/**
 * Validates the CI setup file.
 *
 * @param config config object
 * @param ciSetup ci-setup object
 * @returns a list of validation errors
 */
export function validateCISetup(config: Config, ciSetup: any): string[] {
  // Undefined fields.
  let errors = [];
  const validFields = [
    'env',
    'secrets',
    ...Object.keys(config['ci-setup-defaults'] || {}),
  ];
  for (const key in ciSetup) {
    // Fields starting with underscore (_) are considered comments.
    // They should not be considered as errors.
    if (!key.startsWith('_') && !validFields.includes(key)) {
      errors.push(`'${key}' is not a valid field`);
    }
  }

  // Type checking.
  errors = errors.concat(
    checkMappings(ciSetup, 'env'),
    checkMappings(ciSetup, 'secrets'),
  );
  if (config['ci-setup-defaults']) {
    for (const key in config['ci-setup-defaults'] || {}) {
      const ciSetupValue = ciSetup[key];
      if (ciSetupValue === undefined) {
        continue;
      }
      const defaultValue = config['ci-setup-defaults'][key];
      if (typeof ciSetupValue !== typeof defaultValue) {
        errors.push(
          `'${key}' must be ${typeof defaultValue}, got: ${JSON.stringify(
            ciSetupValue,
          )}`,
        );
      }
    }
  }

  // TODO: check for undefined variable substitutions
  return errors;
}

/**
 * Generic helper to check the type of a field.
 *
 * @param kvs object with fields
 * @param key field to check
 * @param isType type checker function
 * @param err error message
 * @returns a list of validation errors
 */
function check(
  kvs: any,
  key: string,
  isType: (x: any) => boolean,
  err: string,
): string[] {
  // Fields are not required by default.
  // Required fields must be checked explicitly.
  const k = key.split('.').pop() || key;
  if (kvs && kvs[k] && !isType(kvs[k])) {
    return [`'${key}' must be ${err}, got: ${JSON.stringify(kvs[k])}`];
  }
  return [];
}

/**
 * Checks the type of a string field.
 *
 * @param kvs object with fields
 * @param key field to check
 * @returns a list of validation errors
 */
function checkString(kvs: any, key: string): string[] {
  return check(kvs, key, isString, 'string');
}

/**
 * Checks the type of a string or string[] field.
 *
 * @param kvs object with fields
 * @param key field to check
 * @returns a list of validation errors
 */
function checkStringOrStrings(kvs: any, key: string): string[] {
  return check(kvs, key, isStringOrStrings, 'string or string[]');
}

/**
 * Checks the type of a {string: string} mapping field.
 *
 * @param kvs object with fields
 * @param key field to check
 * @returns a list of validation errors
 */
function checkMappings(kvs: any, key: string): string[] {
  return check(kvs, key, isMapStringString, '{string: string} mappings');
}

/**
 * Checks if a value is a string.
 *
 * @param x value to check
 * @returns true if the value is a string
 */
function isString(x: any): boolean {
  return typeof x === 'string';
}

/**
 * Checks if a value is an array of a certain type.
 *
 * @param xs array to check
 * @param isType type checker function
 * @returns true if the value is an array of the given type
 */
function isArray(xs: any, isType: (x: any) => boolean): boolean {
  if (!Array.isArray(xs)) {
    return false;
  }
  for (const x of xs) {
    if (!isType(x)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a value is a string or an array of strings.
 *
 * @param x value to check
 * @returns true if the value is a string or an array of strings
 */
function isStringOrStrings(x: any): boolean {
  return isString(x) || isArray(x, isString);
}

/**
 * Checks if a value is a {string: string} mapping.
 *
 * @param kvs value to check
 * @returns true if the value is a {string: string} mapping
 */
function isMapStringString(kvs: any): boolean {
  if (typeof kvs !== 'object') {
    return false;
  }
  for (const key in kvs) {
    if (typeof key !== 'string' || typeof kvs[key] !== 'string') {
      return false;
    }
  }
  return true;
}
/* eslint-enable  @typescript-eslint/no-explicit-any */

/**
 * Main function to run the script.
 *
 * @param argv command line arguments
 */
function main(argv: string[]) {
  const mainUsage = usage('[affected | run | version | help] [options]');
  switch (argv[2]) {
    case 'affected': {
      const usageRun = usage('affected <config-path> <diffs-file>');
      const configPath = argv[3];
      if (!configPath) {
        console.error('Please provide the config file path.');
        throw new Error(usageRun);
      }
      const config = loadConfig(configPath);
      const diffsFile = argv[4];
      if (!diffsFile) {
        console.error('Please provide the diffs file path.');
        throw new Error(usageRun);
      }
      const diffs = fs.readFileSync(diffsFile, 'utf8').trim().split('\n');
      const packages = affected(config, diffs);
      for (const pkg of packages) {
        console.log(pkg);
      }
      break;
    }

    case 'run': {
      const usageRun = usage('run <config-path> <command> [package-path...]');
      const configPath = argv[3];
      if (!configPath) {
        console.error('Please provide the config file path.');
        throw new Error(usageRun);
      }
      const config = loadConfig(configPath);
      const command = argv[4];
      if (!command) {
        console.error('Please provide the command to run.');
        throw new Error(usageRun);
      }
      if (!config.commands) {
        throw new Error(`No 'commands' defined in ${configPath}.`);
      }
      const cmd = config.commands[command];
      if (!cmd) {
        throw new Error(`No command '${command}' defined in ${configPath}.`);
      }
      const paths = argv.slice(5);
      if (paths.length === 0) {
        console.error('Please provide one or more package paths.');
        throw new Error(usageRun);
      }
      run(config, cmd, paths);
      break;
    }

    case 'version': {
      console.log(version);
      break;
    }

    case 'help': {
      console.log(mainUsage);
      break;
    }

    case undefined: {
      // If no command was passed, just show the usage without an error.
      console.log(mainUsage);
      break;
    }

    default: {
      // Only throw an error if running the script directly.
      // Otherwise, this file is being imported (for example, on tests).
      if (argv[1] && argv[1].match(/custard\.(ts|js)$|^-$/)) {
        throw new Error(mainUsage);
      }
    }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable n/no-process-exit */
try {
  main(process.argv);
} catch (e: any) {
  console.error(e.message);
  process.exit(1);
}
/* eslint-enable n/no-process-exit */
/* eslint-enable @typescript-eslint/no-explicit-any */
