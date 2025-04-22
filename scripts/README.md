# 🍮 Custard runner

This is the canonical way to run tests.
The testing infrastructure uses this script to run tests, which loads and validates the `ci-setup.json` file, sets up the environment, and runs the tests in a consistent way.

To run tests without this script, you can take a look at the `ci-setup.json` file to see which environment variables and secrets are needed and export them yourself.
Then you can take a look at the config file to see the commands used for `lint` and `test` and run those manually.

For consistency, we recommend running tests using this script.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/current) version 23 or higher (to run TypeScript files directly).

## Running

You can run the script directly from GitHub.

```sh
export CUSTARD_URL=https://raw.githubusercontent.com/GoogleCloudPlatform/cloud-samples-tools/refs/heads/main/scripts/src/custard.ts

# Lint packages.
curl -sSL $CUSTARD_URL | node - lint [config-file] [packages..]

# Test packages
curl -sSL $CUSTARD_URL | node - test [config-file] [packages..]
```

TODO: add alias

## Contributing

TODO
