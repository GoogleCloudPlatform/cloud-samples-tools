# 🍮 Custard runner

This is the canonical way to run tests.
The testing infrastructure uses this script to run tests, which loads and validates the `ci-setup.json` file, sets up the environment, and runs the tests in a consistent way.

To run tests without this script, you can take a look at the `ci-setup.json` file to see which environment variables and secrets are needed and export them yourself.
Then you can take a look at the config file to see the commands used for `lint` and `test` and run those manually.

For consistency, we recommend running tests using this script.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/current) version 23 or higher (to run TypeScript files directly).

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
