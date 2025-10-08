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

## Running

Custard does not depend on any third party dependencies at runtime, so you can run it directly without installing anything.

To run the custard script:

```sh
# To check the version:
node src/custard.ts version

# To see the command usage:
node src/custard.ts help
```

## Contributing

To lint the project and run tests you'll need to set up your developer environment.

```sh
# Install the dev dependencies.
npm ci
```

To run the linter:

```sh
npm run lint
```

To run tests:

```sh
# Run all tests.
npm test

# Run a single test suite, for example the "affected" tests.
npm test -- -g "affected"
```
