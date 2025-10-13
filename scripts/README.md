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

For information on how to run tests, see the [Contributing](#contributing) section.

## Finding affected packages

On CI, we usually use `git diff` to find the files that changed.
To keep Custard flexible for different use cases, it won't automatically get the diffs from git, but instead we pass a file with the diffs.
This allows for other use cases, like running a specific set of tests, rather than the ones changed.

For example, here is how you could use `git diff` to get your changes compared to the main branch.

```sh
# This will both print the files, as well as write them to a /tmp/diffs.txt file.
git --no-pager diff --name-only HEAD origin/main | tee /tmp/diffs.txt
```

> **NOTE**: The diffs passed to Custard must be relative to the directory from which we're running the script.
> Note that `git diff` will generate files relative to the repository root directory, so you would have to run Custard from that directory.

Alternatively, we could manually create the file with the files we're interested in.

```sh
# Assuming you're running from the custard directory, not the root directory.
echo "test/affected/valid-package/my-file.txt" > /tmp/diffs.txt
```

We also need to provide a config file that describes how to resolve packages.

For example, we can use the [`test/affected/config.jsonc`](test/affected/config.jsonc) file.
The relevant config file entries for "affected" are:

- `package-file`: The name of the file defining a package (e.g. `package.json`, `requirements.txt`, `go.mod`, etc.)
- `match`: File pattern(s) to match against the diffs, defaults to everything (`*`).
- `ignore`: File pattern(s) to ignore (e.g. `README.md` should not trigger tests).
- `exclude-packages`: List of packages to exclude/skip.

```sh
node src/custard.ts affected \
    test/affected/config.jsonc \
    /tmp/diffs.txt
```

This prints one package per line in stdout.
Warnings and errors are written to stderr.

## Config file commands

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
