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
import {execSync, spawnSync} from 'node:child_process';

type Vars = {[k: string]: string};

type CISetup = {
  // Other fields can be here, but are not required.
  env: Vars;
  secrets: Vars;
};

type Config = {
  'package-file': string[];
  'ci-setup-filename': string;
  'ci-setup-defaults': CISetup;
  'ci-setup-help-url': string;
  match: string[];
  ignore: string[];
  'exclude-packages': string[];
};

function usage(flags: string): string {
  return [`usage: node run.ts ${flags}`].join('\n');
}

function lint(packagePath: string) {
  // The Makefile use .ONESHELL, which requires make 3.82 or higher.
  //    https://stackoverflow.com/a/32153249
  const make = findMake(3, 82);
  const cmd = `${make} lint dir=${packagePath}`;
  console.log(`>> ${cmd}`);
  execSync(cmd, {stdio: 'inherit'});
}

function test(configPath: string, packagePath: string) {
  // The Makefile use .ONESHELL, which requires make 3.82 or higher.
  //    https://stackoverflow.com/a/32153249
  const make = findMake(3, 82);
  setup(configPath, packagePath);
  const cmd = `${make} test dir=${packagePath}`;
  console.log(`>> ${cmd}`);
  execSync(cmd, {stdio: 'inherit'});
}

export function setup(
  configPath: string,
  packagePath: string,
): {config: Config; ciSetup: CISetup} {
  const config: Config = loadJsonc(configPath);
  const ciSetupPath = path.join(packagePath, config['ci-setup-filename']);
  const ciSetupLocal: CISetup = loadJsonc(ciSetupPath);
  const ciSetupDefaults = config['ci-setup-defaults'];
  console.log(`ci-setup defaults: ${JSON.stringify(ciSetupDefaults, null, 2)}`);
  console.log(`ci-setup.json: ${JSON.stringify(ciSetupLocal, null, 2)}`);
  setupEnv(ciSetupLocal.env || {}, ciSetupDefaults.env || {});
  setupSecrets(ciSetupLocal.secrets || {}, ciSetupDefaults.secrets || {});
  return {config, ciSetup: {...ciSetupDefaults, ...ciSetupLocal}};
}

function setupEnv(locals: Vars, defaults: Vars) {
  const automatic = {
    PROJECT_ID: () => defaultProject(),
    RUN_ID: () => uniqueId(),
    SERVICE_ACCOUNT: () => '',
  };
  console.log('export env:');
  const env = [...listVars(automatic, locals, defaults)];
  const vars = Object.fromEntries(env.map(([key, {value}]) => [key, value]));
  for (const [key, {value, source}] of env) {
    const result = substitute(vars, value);
    console.log(`  ${key}: ${JSON.stringify(result)} (${source})`);
    process.env[key] = result;
  }
}

function setupSecrets(locals: Vars, defaults: Vars) {
  const projectId = process.env.PROJECT_ID;
  if (!projectId) {
    throw new Error('PROJECT_ID is not set');
  }
  const automatic = {
    // Set global secret for the Service Account identity token
    // Use in place of 'gcloud auth print-identity-token' or auth.getIdTokenClient
    // usage: curl -H 'Bearer: $ID_TOKEN' https://
    ID_TOKEN: () => getIdToken(projectId),
  };
  console.log('export secrets:');
  const secrets = [...listVars(automatic, locals, defaults, accessSecret)];
  for (const [key, {value: value, source}] of secrets) {
    // ⚠️ DO NOT print the secret value.
    console.log(`  ${key}: "***" (${source})`);
    process.env[key] = value;
  }
}

function* listVars(
  automatic: {[k: string]: () => string},
  locals: Vars,
  defaults: Vars,
  access: (value: string) => string = x => x,
): Generator<[string, {value: string; source: string}]> {
  for (const key in {...automatic, ...defaults, ...locals}) {
    if (key in process.env) {
      // 1) User defined via an environment variable.
      const value = process.env[key] || '';
      yield [key, {value, source: 'user-defined'}];
    } else if (key in locals) {
      // 2) From the local ci-setup.json file.
      const value = access(locals[key]);
      yield [key, {value, source: 'from ci-setup.json'}];
    } else if (key in defaults) {
      // 3) Defaults from the config file.
      const value = access(defaults[key]);
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

function loadJsonc(filePath: string) {
  const jsoncData = fs.readFileSync(filePath, 'utf8');
  const jsonData = jsoncData
    .replaceAll(/\s*\/\*.*?\*\//gs, '') // remove multi-line comments
    .replaceAll(/\/\/.*/g, ''); // remove single-line comments
  return JSON.parse(jsonData);
}

function substitute(vars: Vars, value: string) {
  for (const key in vars) {
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
      value = value.replaceAll(re, substitute(vars, vars[key]));
    }
  }
  return value;
}

function mapRun(cmd: string, paths: string[], outputsAlways: boolean = false) {
  if (paths.length === 0) {
    console.log('Nothing to do.');
  }
  let failed = [];
  for (const path of paths) {
    let stdout = '';
    let stderr = '';
    try {
      const p = spawnSync('bash', ['-c', cmd], {cwd: path});
      console.log(`✅ [${path}]: ${cmd}`);
      stdout = p.stdout && p.stdout.toString('utf8');
      stderr = p.stderr && p.stderr.toString('utf8');
    } catch (e) {
      failed.push(path);
      console.log(`❌ [${path}]: ${cmd} (exit code ${e.status})`);
      console.error(e.message);
      stdout = e.stdout && e.stdout.toString('utf8');
      stderr = e.stderr && e.stderr.toString('utf8');
    }
    if (outputsAlways || failed.includes(path)) {
      console.log('---- stdout ----');
      console.log(stdout || '');
      console.log('---- stderr ----');
      console.log(stderr || '');
    }
  }
  console.log('=== Summary ===');
  console.log(`  Passed: ${paths.length - failed.length}`);
  console.log(`  Failed: ${failed.length}`);
  if (failed.length > 0) {
    throw new Error(`Failed '${cmd}' on: ${failed.join(', ')}`);
  }
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

function getIdToken(projectId: string): string {
  const cmd = `gcloud --project=${projectId} auth print-identity-token`;
  return execSync(cmd).toString().trim();
}

function findMake(major: number, minor: number): string {
  if (checkVersion('make --version', major, minor)) {
    console.log(`Using ${execSync('which make').toString().trim()}`);
    return 'make';
  } else if (checkVersion('gmake --version', major, minor)) {
    console.log(`Using ${execSync('which gmake').toString().trim()}`);
    return 'gmake';
  }
  throw new Error(
    `Error: make or gmake version ${major}.${minor} or higher is required.`,
  );
}

function checkVersion(cmd: string, major: number, minor: number): boolean {
  try {
    const output = execSync(cmd).toString();
    process.stdout.write(`${cmd} ${output.split('\n')[0]} -- `);
    // console.log(`${cmd} ${output.split("\n")[0]}`);
    const match = /(\d+)\.(\d+)/.exec(output);
    if (match) {
      const cmdMajor = parseInt(match[1]);
      const cmdMinor = parseInt(match[2]);
      if (cmdMajor > major || (cmdMajor === major && cmdMinor >= minor)) {
        console.log(
          `${cmdMajor}.${cmdMinor} is compatible with ${major}.${minor}`,
        );
        return true;
      }
    }
  } catch (e) {
    console.log(e);
  }
  console.log(`not compatible with ${major}.${minor}`);
  return false;
}

const command = process.argv[2];
switch (command) {
  case 'lint': {
    const usageLint = usage('lint [package-path...]');
    const packagePath = process.argv[3];
    if (!packagePath) {
      console.error('Please provide the package path to lint.');
      throw new Error(usageLint);
    }
    lint(packagePath);
    break;
  }

  case 'test': {
    const usageTest = usage('test <config-path> <package-path>');
    const configPath = process.argv[3];
    if (!configPath) {
      console.error('Please provide the config file path.');
      throw new Error(usageTest);
    }
    const packagePath = process.argv[4];
    if (!packagePath) {
      console.error('Please provide the package path to lint.');
      throw new Error(usageTest);
    }
    test(configPath, packagePath);
    break;
  }

  default: {
    // Only throw an error if running the script directly.
    // Otherwise, this file is being imported (for example, on tests).
    if (process.argv[1].endsWith('custard.ts')) {
      throw new Error(usage('[lint | test] [options]'));
    }
  }
}
