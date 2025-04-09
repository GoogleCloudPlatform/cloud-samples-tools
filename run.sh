# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Usage:
#   sh run.sh lint path/to/config.jsonc path/to/package
#   sh run.sh test path/to/config.jsonc path/to/package

# For debugging:
#   sh -x run.sh lint path/to/config.jsonc path/to/package
#   sh -x run.sh test path/to/config.jsonc path/to/package

set -e # Exit immediately if a command exits with a non-zero status.
set -o nounset # Exit immediately if a variable is used but not set.

jq --version

PROJECT_ID=nodejs-docs-samples-tests
command="$1"
config_file="$2"
package_path="$3"

load_jsonc() {
  if [ -f "$1" ]; then
    cat "$1" |
      sed '/\/\*/,/\*\//d' | # remove multi-line comments
      sed 's|//.*$||' # remove single-line comments
  else
    echo "{}"
  fi
}

# Load the config file.
if ! [ -e "$config_file" ]; then
  echo "Config file not found: $config_file" >&2
  exit 1
fi
config=$(load_jsonc $config_file)

case "$command" in
  "lint") (
    set -x # Print commands as they are executed.
    bash -x -c "$(jq -r '."lint-pre"' <<< $config)"
    cd "$package_path"
    bash -x -c "$(jq -r '.lint' <<< $config)"
  );;

  "test") (
    # Load the ci-setup.json and merge it on top of the config defaults.
    ci_setup_filename=$(jq -r '."ci-setup-filename"' <<< $config)
    ci_setup_defaults=$(jq '."ci-setup-defaults"' <<< $config)
    ci_setup_package=$(load_jsonc "$package_path/$ci_setup_filename")
    ci_setup=$(jq '.[0] * .[1]' <<< "[$ci_setup_defaults, $ci_setup_package]")

    # Export environment variables.
    echo "env:"
    for entry in $(jq -c '.env | to_entries[]' <<< $ci_setup); do
      key=$(jq -r '.key' <<< $entry)
      user_value=$(printenv | awk -F'=' "/^$key=/ {print \$2}")
      value=${user_value:-$(jq -r '.value' <<< $entry)}
      echo "  $key=$value"
      export "$key=$value"
    done

    # Export secrets.
    set +x # Make sure we don't print secrets, even if -x is set.
    echo "secrets:"
    for entry in $(jq -c '.secrets | to_entries[]' <<< $ci_setup); do
      key=$(jq -r '.key' <<< $entry)
      secret_path=$(jq -r '.value' <<< $entry)
      user_value=$(printenv | awk -F'=' "/^$key=/ {print \$2}")
      if [[ -n "$user_value" ]]; then
        # Do not print the actual secret value.
        echo "  $key='***' (user defined)"
        export "$key=$user_value"
      else
        # Print the project_id/secret_id path, not the value.
        echo "  $key=$secret_path"
        project_id=$(dirname "$secret_path")
        secret_id=$(basename "$secret_path")
        value=$(gcloud --project="$project_id" secrets versions access "latest" --secret="$secret_id")
        export "$key=$value"
      fi
    done

    set -x # Print commands as they are executed.
    bash -x -c "$(jq -r '."test-pre"' <<< $config)"
    cd "$package_path"
    # bash -x -c "$(jq -r '.test' <<< $config)"
  );;

  *)
    echo "Unknown command: $command"
  ;;
esac
