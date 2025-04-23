# 🍮 Custard runner

This is the canonical way to run tests.
The testing infrastructure uses this script to run tests, which loads and validates the `ci-setup.json` file, sets up the environment, and runs the tests in a consistent way.

To run tests without this script, you can take a look at the `ci-setup.json` file to see which environment variables and secrets are needed and export them yourself.
Then you can take a look at the config file to see the commands used for `lint` and `test` and run those manually.

For consistency, we recommend running tests using this script.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/current) version 23 or higher (to run TypeScript files directly).

## Config file

To support lint and test commands, we have to define them in the config file.
Having these commands defined in the config file allows consistency between the CI infrastructure and local testing.

For example:

```jsonc
// config.jsonc
{
  "package-file": "...",
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
    "run": "sh test.sh",
    // Runs at the root directory, after all packages.
    "post": "echo 'post-test'",
  },
}
```

Both `lint` and `test` commands are optional.
All `pre`, `run`, and `post` steps are also optional.
If a command or step is not defined, it's skipped.

The `pre` and `post` steps run on the current working directory where the script was launched, usually the repo's root directory.
Failures on these steps will crash the script and exit with a non-zero exit code.

The `run` step is run for every package, under the package's directory.
All packages are run always, even if they fail.
If any `run` fails, the errors are reported and the script exits with a non-zero exit code.

The `lint` command will not use the `ci-setup.json` file.
The `test` command loads the `ci-setup.json`, validates it, exports environment variables, and fetches secrets before running the `run` step.

## Running

Create an alias for this script, you can add this to your `.zshrc` or `.bashrc`.

```sh
alias custard="curl -sSL https://raw.githubusercontent.com/GoogleCloudPlatform/cloud-samples-tools/refs/heads/main/scripts/src/custard.ts | node - $@"
```

To lint a package, you must pass the path to a config file and then one or more packages.

For example, to lint the test packages:

```sh
# This should pass.
custard lint test/cmd/config.json test/cmd/pkg-pass

# This fails and exits with a non-zero exit code.
custard lint test/cmd/config.json test/cmd/pkg-fail
```

To test a package, you must pass the path to a config file and then one or more packages.

For example, to test the test packages:

```sh
# This should pass.
custard test test/cmd/config.json test/cmd/pkg-pass

# This fails and exits with a non-zero exit code.
custard test test/cmd/config.json test/cmd/pkg-fail
```

## Contributing

TODO
