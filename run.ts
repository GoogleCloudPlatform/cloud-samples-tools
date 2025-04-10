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

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

type Vars = { [k: string]: string };

type CISetup = {
  env: Vars;
  secrets: Vars;
};

type Config = {
  "package-file": string[];
  "ci-setup-filename": string;
  "ci-setup-defaults": CISetup;
  "ci-setup-help-url": string;
  match: string[];
  ignore: string[];
  "exclude-packages": string[];
};

// The Makefile use .ONESHELL, which requires make 3.82 or higher.
//    https://stackoverflow.com/a/32153249
let make = "";
function checkVersion(cmd: string, major: number, minor: number): boolean {
  try {
    const output = execSync(cmd).toString();
    process.stdout.write(`${cmd} ${output.split("\n")[0]} -- `);
    // console.log(`${cmd} ${output.split("\n")[0]}`);
    const match = /(\d+)\.(\d+)/.exec(output);
    if (match) {
      const cmdMajor = parseInt(match[1]);
      const cmdMinor = parseInt(match[2]);
      if (cmdMajor > major || (cmdMajor === major && cmdMinor >= minor)) {
        console.log(
          `${cmdMajor}.${cmdMinor} is compatible with ${major}.${minor}`
        );
        return true;
      }
    }
  } catch (_) {}
  console.log(`not compatible with ${major}.${minor}`);
  return false;
}
if (checkVersion("make --version", 3, 82)) {
  make = "make";
  console.log(`Using ${execSync("which make").toString().trim()}`);
} else if (checkVersion("gmake --version", 3, 82)) {
  make = "gmake";
  console.log(`Using ${execSync("which gmake").toString().trim()}`);
}

if (!make) {
  console.error("Error: make or gmake version 3.82 or higher is required.");
  process.exit(1);
}

function lint(packagePath: string) {
  const cmd = `${make} lint dir=${packagePath}`;
  console.log(`>> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function test(configPath: string, packagePath: string) {
  setup(configPath, packagePath);
  const cmd = `${make} test dir=${packagePath}`;
  console.log(`>> ${cmd}`);
  console.log("TODO: UNCOMMENT THE TEST COMMAND");
  process.exit(1);
  // execSync(cmd, { stdio: "inherit" });
}

function setup(
  configPath: string,
  packagePath: string
): { config: Config; ciSetup: CISetup } {
  const config: Config = loadJsonc(configPath);
  const ciSetupPath = path.join(packagePath, config["ci-setup-filename"]);
  const ciSetupLocal: CISetup = loadJsonc(ciSetupPath);
  const ciSetupDefaults = config["ci-setup-defaults"];
  console.log(`ci-setup defaults: ${JSON.stringify(ciSetupDefaults, null, 2)}`);
  console.log(`ci-setup.json: ${JSON.stringify(ciSetupLocal, null, 2)}`);
  setupEnv(ciSetupLocal.env || {}, ciSetupDefaults.env || {});
  setupSecrets(ciSetupLocal.secrets || {}, ciSetupDefaults.secrets || {});
  return { config, ciSetup: { ...ciSetupDefaults, ...ciSetupLocal } };
}

function setupEnv(locals: Vars, defaults: Vars) {
  const automatic = {
    PROJECT_ID: () => defaultProject(),
    RUN_ID: () => uniqueId(),
    SERVICE_ACCOUNT: () => "",
  };
  console.log("export env:");
  const env = [...listVars(automatic, locals, defaults)];
  const vars = Object.fromEntries(env.map(([key, { value }]) => [key, value]));
  for (const [key, { value, source }] of env) {
    const result = substitute(vars, value);
    console.log(`  ${key}: ${JSON.stringify(result)} (${source})`);
    process.env[key] = result;
  }
}

function setupSecrets(locals: Vars, defaults: Vars) {
  const automatic = {
    // Set global secret for the Service Account identity token
    // Use in place of 'gcloud auth print-identity-token' or auth.getIdTokenClient
    // usage: curl -H 'Bearer: $ID_TOKEN' https://
    ID_TOKEN: () => getIdToken(process.env.PROJECT_ID),
  };
  console.log("export secrets:");
  const secrets = [...listVars(automatic, locals, defaults, accessSecret)];
  for (const [key, { value: value, source }] of secrets) {
    // ⚠️ DO NOT print the secret value.
    console.log(`  ${key}: "***" (${source})`);
    process.env[key] = value;
  }
}

function* listVars(
  automatic: { [k: string]: () => string },
  locals: Vars,
  defaults: Vars,
  access: (value: string) => string = (x) => x
): Generator<[string, { value: string; source: string }]> {
  for (const key in { ...automatic, ...defaults, ...locals }) {
    if (key in process.env) {
      // 1) User defined via an environment variable.
      const value = process.env[key];
      yield [key, { value, source: "user-defined" }];
    } else if (key in locals) {
      // 2) From the local ci-setup.json file.
      const value = access(locals[key]);
      yield [key, { value, source: "from ci-setup.json" }];
    } else if (key in defaults) {
      // 3) Defaults from the config file.
      const value = access(defaults[key]);
      yield [key, { value, source: "default value" }];
    } else if (key in automatic) {
      // 4) Automatic variables.
      const value = automatic[key]();
      yield [key, { value, source: "automatic var" }];
    } else {
      // Unreachable.
      throw new Error(`Undefined variable: ${key}`);
    }
  }
}

function loadJsonc(filePath: string) {
  const jsoncData = fs.readFileSync(filePath, "utf8");
  const jsonData = jsoncData
    .replaceAll(/\s*\/\*.*?\*\//gs, "") // remove multi-line comments
    .replaceAll(/\/\/.*/g, ""); // remove single-line comments
  return JSON.parse(jsonData);
}

function substitute(vars: Vars, value: string) {
  for (const key in vars) {
    let re = new RegExp(`\\$(${key}\\b|\\{\\s*${key}\\s*\\})`, "g");
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

function uniqueId(length = 6) {
  const min = 2 ** 32;
  const max = 2 ** 64;
  return Math.floor(Math.random() * max + min)
    .toString(36)
    .slice(0, length);
}

function defaultProject(): string {
  const cmd = "gcloud config get-value project";
  return execSync(cmd).toString().trim();
}

function accessSecret(secretPath: string): string {
  const [projectId, ...secretIdParts] = secretPath.split("/");
  const secretId = secretIdParts.join("/");
  const cmd = `gcloud --project=${projectId} secrets versions access "latest" --secret=${secretId}`;
  return execSync(cmd).toString();
}

function getIdToken(projectId: string): string {
  const cmd = `gcloud --project=${projectId} auth print-identity-token`;
  return execSync(cmd).toString().trim();
}

function usage(flags: string): string {
  return [`usage: node run.ts ${flags}`].join("\n");
}

const command = process.argv[2];
switch (command) {
  case "lint": {
    const usageLint = usage("lint <package-path>");
    const packagePath = process.argv[3];
    if (!packagePath) {
      console.error("Please provide the package path to lint.");
      console.error(usageLint);
      process.exit(1);
    }
    lint(packagePath);
    break;
  }

  case "test": {
    const usageTest = usage("test <config-path> <package-path>");
    const configPath = process.argv[3];
    if (!configPath) {
      console.error("Please provide the config file path.");
      console.error(usageTest);
      process.exit(1);
    }
    const packagePath = process.argv[4];
    if (!packagePath) {
      console.error("Please provide the package path to lint.");
      console.error(usageTest);
      process.exit(1);
    }
    test(configPath, packagePath);
    break;
  }

  default: {
    console.error(`Unknown command: ${command}`);
    console.error(usage("[lint | test] [options]"));
    process.exit(1);
  }
}
