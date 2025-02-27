# 🍮 Custard - a test runner for cloud samples

This tool has two functions:

- `affected` finds the affected packages given a list of diffs.
- `setup-files` loads and validates the setup files settings for each package.

## Config files

For this tools, we refer to a **package** as an isolated directory, which contains a "package file".
For example, `package.json` in Node.js, `requirements.txt` in Python, `go.mod` in Go, or `pom.xml` in Java.

Each language has different configurations.
We define them in config files in the repository, this way the tooling keeps language agnostic and each repository can have different configurations.

The config file can be a `.json` file, or a `.jsonc` (JSON with comments) file.
For `.jsonc` files, it supports both `// single line comments` and `/* multi-line comments */`.

For example:

```jsonc
{
  // The package file where the tests should be run (required).
  "package-file": "package.json",

  // CI setup file, must be located in the same directory as the package file.
  "ci-setup-filename": "ci-setup.json",

  // CI setup defaults, used when no setup file or field is not sepcified in file.
  "ci-setup-defaults": {
    "node-version": 20,
    "timeout-minutes": 10,
    "env": {}, // Key value pairs of environment variables.
    "secrets": {} // Secret Manager secrets to export as environment variables.
  },

  // CI setup help URL, shown when a setup file validation fails.
  "ci-setup-help-url": "https://example.com/path/to/config-setup-docs.html",

  // Match diffs only on .js and .ts files
  // Defaults to match all files.
  "match": ["*.js", "*.ts"],

  // Ignore diffs on the README, text files, and anything under node_modules/.
  // Defaults to not ignore anything.
  "ignore": ["README.md", "*.txt", "node_modules/"],

  // Skip these packages, these could be handled by a different config.
  // Defaults to not exclude anything.
  "exclude-packages": ["path/to/slow-to-test", "special-config-package"]
}
```

For more information, see [`pkg/utils/config.go`](pkg/utils/config.go).

## Running the unit tests

To the tools tests, we must change to the directory where the tools package is defined.
We can run it in a subshell using parentheses to keep our working directory from changing.

```sh
(cd custard && go test -v ./...)
```

## Building

To build the tools, we must change to the directory where the tools package is defined.
We can run it in a subshell using parentheses to keep our working directory from changing.

```sh
(cd custard && go build -o /tmp/custard ./cmd/...)
```

## Finding affected packages

> This must run at the repository root directory.

First, generate a file with all the diffs.
This file should be one file per line.

You can use `git diff` to test on files that have changed in your branch.
You can also create the file manually if you want to test something without commiting changes to your branch.

```sh
git --no-pager diff --name-only HEAD origin/main | tee /tmp/diffs.txt
```

Then run the `affected` command, with the following positional arguments:

1. The `config.jsonc` file path.
1. The `diffs.txt` file path.
1. The `paths.txt` file path to write the affected packages to.

```sh
/tmp/custard affected \
    path/to/config.jsonc \
    /tmp/diffs.txt \
    /tmp/paths.txt
```

The output paths file contains one path per line.

## Loading the setup files

> This must run at the repository root directory.

Then run the `setup-files` command, with the following positional arguments:

1. The `config.jsonc` file path.
1. The `paths.txt` file with the packages of interest.

```sh
/tmp/custard setup-files \
    path/to/config.jsonc \
    /tmp/paths.txt
```
