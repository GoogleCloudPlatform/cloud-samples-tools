# 🍮 Custard - a test runner for cloud samples

This tool has two functions:

- `affected` finds the affected packages given a list of diffs.
- `setup-files` loads and validates the setup files settings for each package.

To learn about how it works, see the [overview](docs/overview.md) page.

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
