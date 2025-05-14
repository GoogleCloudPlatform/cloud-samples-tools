# 🍮 Custard runner

This is the canonical way to run tests.
The testing infrastructure uses this script to run tests, which loads and validates the `ci-setup.json` file, sets up the environment, and runs the tests in a consistent way.

To run tests without this script, you can take a look at the `ci-setup.json` file to see which environment variables and secrets are needed and export them yourself.
Then you can take a look at the config file to see the commands used for `lint` and `test` and run those manually.

For consistency, we recommend running tests using this script.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/current) version 23 or higher (to run TypeScript files directly).

> **Note**: Node 23 issues a warning about "Type Stripping" being experimental.
> This does not cause any issues and everything works as expected.
>
> To disable the warning: `export NODE_OPTIONS="--no-warnings=75058"`

## Config file

To support commands, we have to define them in the config file.
Having these commands defined in the config file allows consistency between the CI infrastructure and local testing.

For example, to define `lint` and `test` commands:

```jsonc
// config.jsonc
{
  // ...
  "commands": {
    "lint": {
      // Runs at the root directory, before any packages.
      "pre": "echo 'pre-lint'",
      // Runs for each package at the package's directory.
      // Does not load up the ci-setup.json file.
      "run": "sh lint.sh",
      // Runs at the root directory, after all packages.
      "post": "echo 'post-lint'",
    },
    "test": {
      // Runs at the root directory, before any packages.
      "pre": "echo 'pre-test'",
      // Runs for each package at the package's directory.
      // Loads the ci-setup.json file, and exports variables
      // and secrets before running this step.
      "run": [
        // You can also run multiple commands.
        "sh install-dependencies.sh",
        "sh test.sh",
      ],
      // Runs at the root directory, after all packages.
      "post": "echo 'post-test'",
    },
  },
  // ...
}
```

All `pre`, `run`, and `post` steps are also optional, they can be a single command, or a list of commands.
If a command or step is not defined, it's skipped.

The `pre` and `post` steps run on the current working directory where the script was launched, usually the repo's root directory.
Failures on these steps will crash the script and exit with a non-zero exit code.

The `run` step is run for every package, under the package's directory.
All packages are run always, even if they fail.
If any `run` fails, the errors are reported and the script exits with a non-zero exit code.

You can define any command, not only `lint` and `test`.
All commands first load the `ci-setup.json`, validate it, and export environment variables and secrets before running the `run` step.

## Running

Create an alias for this script, you can add this to your `.zshrc` or `.bashrc`.

```sh
alias custard="curl -sSL https://raw.githubusercontent.com/GoogleCloudPlatform/cloud-samples-tools/refs/heads/main/scripts/src/custard.ts | node - $@"
```

Here's how to run a command:

```sh
custard run <config-file> <command> [args...]
```

For example, to run some of the test packages in the `scripts/` directory:

```sh
# This should pass.
custard run test/cmd/config.json test test/cmd/pkg-pass

# This fails and exits with a non-zero exit code.
custard run test/cmd/config.json test test/cmd/pkg-fail
```

## Contributing

TODO
