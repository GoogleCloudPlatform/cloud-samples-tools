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

export type CISetup = {
  // Environment variables to export.
  env?: {[k: string]: string};

  // Secret Manager secrets to export.
  secrets?: {[k: string]: string};

  // Other fields can be here, but are not required.
};

export type Command = {
  // Run before the main command, at the repo root.
  pre?: string;

  // The main command, at the package path.
  run?: string;

  // Run after the main command, at the repo root.
  post?: string;
};

export type Config = {
  // Filename to look for the root of a package.
  'package-file': string | string[];

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

  // Commands for each stage.
  lint?: Command;
  test?: Command;

  // Packages to always exclude.
  'exclude-packages'?: string[];
};

function usage(flags: string): string {
  return `usage: node custard.ts ${flags}`;
}

function run(cmd: Command, paths: string[], setup = (_path: string) => {}) {
  if (cmd.pre) {
    console.log(`>> [root]$ ${cmd.pre}`);
    execSync(cmd.pre, {stdio: 'inherit'});
  }
  const failures = [];
  if (cmd.run) {
    for (const path of paths) {
      console.log(`>> ${path}$ ${cmd.run}`);
      setup(path);
      try {
        execSync(cmd.run, {stdio: 'inherit', cwd: path});
      } catch (e) {
        console.error(`${e}`);
        failures.push(path);
      }
    }
  }
  if (cmd.post) {
    console.log(`>> [root]$ ${cmd.post}`);
    execSync(cmd.post, {stdio: 'inherit'});
  }

  if (paths.length > 1) {
    console.log(`=== Summary (${paths.length} packages) ===`);
    console.log(`  Passed: ${paths.length - failures.length}`);
    console.log(`  Failed: ${failures.length}`);
  }
  if (failures.length > 0) {
    throw new Error(`Failed:\n${failures.map(path => `- ${path}`).join('\n')}`);
  }
}

export function lint(configPath: string, packagePaths: string[]) {
  const config = loadConfig(configPath);
  if (!config.lint) {
    throw new Error(`No 'lint' command defined in ${configPath}.`);
  }
  run(config.lint, packagePaths);
}

export function test(
  configPath: string,
  packagePaths: string[],
  env = process.env,
) {
  const config = loadConfig(configPath);
  if (!config.test) {
    throw new Error(`No 'test' command defined in ${configPath}.`);
  }
  run(config.test, packagePaths, path => setup(config, path, env));
}

export function setup(config: Config, packagePath: string, env = process.env) {
  const defaults = config['ci-setup-defaults'] || {};
  const ciSetup = loadCISetup(config, packagePath);
  console.log(`ci-setup defaults: ${JSON.stringify(defaults, null, 2)}`);
  console.log(`ci-setup.json: ${JSON.stringify(ciSetup, null, 2)}`);

  const vars = listEnv(env, ciSetup.env || {}, defaults.env || {});
  for (const [key, value] of vars) {
    process.env[key] = value;
  }
  const secrets = listSecrets(
    env,
    ciSetup.secrets || {},
    defaults.secrets || {},
  );
  for (const [key, value] of secrets) {
    process.env[key] = value;
  }
}

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
  console.log('env:');
  const vars = [...listVars(env, ciSetup, defaults, automatic)];
  const subs = Object.fromEntries(vars.map(([key, {value}]) => [key, value]));
  for (const [key, {value, source}] of vars) {
    const result = substitute(subs, value);
    console.log(`  ${key}: ${JSON.stringify(result)} (${source})`);
    yield [key, result];
  }
}

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
  console.log('export secrets:');
  const vars = listVars(env, ciSetup, defaults, automatic, accessSecret);
  for (const [key, {value: value, source}] of vars) {
    // ⚠️ DO NOT print the secret value.
    console.log(`  ${key}: "***" (${source})`);
    yield [key, value];
  }
}

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

export function loadConfig(filePath: string): Config {
  const config: Config = loadJsonc(filePath);

  // Validation.
  if (!config['package-file']) {
    throw new Error(`'package-file' is required in ${filePath}`);
  }

  // Default values.
  if (!config.match) {
    config.match = ['*'];
  }
  return config;
}

export function loadCISetup(config: Config, packagePath: string): CISetup {
  const defaultNames = ['ci-setup.jsonc', 'ci-setup.json'];
  const filenames = asArray(config['ci-setup-filename']) || defaultNames;
  for (const filename of filenames) {
    const ciSetupPath = path.join(packagePath, filename);
    if (fs.existsSync(ciSetupPath)) {
      console.log(`Loading CI setup: ${ciSetupPath}`);
      return loadJsonc(ciSetupPath);
    }
  }
  console.log(`No CI setup found for '${packagePath}'`);
  return {};
}

export function loadJsonc(filePath: string) {
  const jsoncData = fs.readFileSync(filePath, 'utf8');
  const jsonData = jsoncData
    .replaceAll(/\s*\/\*.*?\*\//gs, '') // remove multi-line comments
    .replaceAll(/\/\/.*/g, ''); // remove single-line comments
  return JSON.parse(jsonData);
}

export function substitute(subs: {[k: string]: string}, value: string) {
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

export function uniqueId(length = 6) {
  const min = 2 ** 32;
  const max = 2 ** 64;
  return Math.floor(Math.random() * max + min)
    .toString(36)
    .slice(0, length);
}

function defaultProject(): string {
  const cmd = 'gcloud config get-value project';
  return execSync(cmd).toString().trim();
}

function accessSecret(secretPath: string): string {
  const [projectId, ...secretIdParts] = secretPath.split('/');
  const secretId = secretIdParts.join('/');
  const cmd = `gcloud --project=${projectId} secrets versions access "latest" --secret=${secretId}`;
  return execSync(cmd).toString();
}

function getIdToken(projectId?: string): string {
  if (projectId) {
    const cmd = `gcloud --project=${projectId} auth print-identity-token`;
    return execSync(cmd).toString().trim();
  }
  return '';
}

function asArray(x: string | string[] | undefined): string[] | undefined {
  if (!x) {
    return undefined;
  }
  return Array.isArray(x) ? x : [x];
}

switch (process.argv[2]) {
  case 'lint': {
    const usageLint = usage('lint <config-path> [package-path...]');
    const configPath = process.argv[3];
    if (!configPath) {
      console.error('Please provide the config file path.');
      throw new Error(usageLint);
    }
    const packagePaths = process.argv.slice(4);
    if (packagePaths.length === 0) {
      console.error('Please provide the paths to lint.');
      throw new Error(usageLint);
    }
    lint(configPath, packagePaths);
    break;
  }

  case 'test': {
    const usageTest = usage('test <config-path> <package-path>');
    const configPath = process.argv[3];
    if (!configPath) {
      console.error('Please provide the config file path.');
      throw new Error(usageTest);
    }
    const packagePaths = process.argv.slice(4);
    if (packagePaths.length === 0) {
      console.error('Please provide the paths to test.');
      throw new Error(usageTest);
    }
    test(configPath, packagePaths);
    break;
  }

  default: {
    // Only throw an error if running the script directly.
    // Otherwise, this file is being imported (for example, on tests).
    if (process.argv[1] && process.argv[1].match(/custard\.(ts|js)$|^-$/)) {
      throw new Error(usage('[lint | test] [options]'));
    }
  }
}
