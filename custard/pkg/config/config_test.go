/*
 Copyright 2024 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

package config_test

import (
	c "custard/pkg/config"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	tests := []struct {
		filename string
		config   *c.Config
		fails    bool
	}{
		{
			filename: "empty.json",
			fails:    true,
		},
		{
			filename: "default-values.json",
			config: &c.Config{
				PackageFile: []string{"package.json"},
				Match:       []string{"*"},
			},
		},
		{
			filename: "comments.jsonc",
			config: &c.Config{
				PackageFile: []string{"package.json"},
				Match:       []string{"*"},
			},
		},
	}

	for _, test := range tests {
		path := filepath.Join("testdata", "config", test.filename)
		got, err := c.LoadConfig(path)
		if test.fails && err == nil {
			t.Fatal("expected failure\n", got)
		}
		if !test.fails && err != nil {
			t.Fatal("error loading config\n", err)
		}
		if !reflect.DeepEqual(test.config, got) {
			t.Fatal("expected equal\n", test.config, "\n", got)
		}
	}
}

func TestSaveLoadConfig(t *testing.T) {
	file, err := os.CreateTemp("", "config-*.json")
	if err != nil {
		t.Fatal("error creating temp file\n", err)
	}
	defer os.Remove(file.Name())

	config := c.Config{
		PackageFile:     []string{"package.json"},
		Ignore:          []string{"node_modules/", "*.md"},
		Match:           []string{"*.js"},
		ExcludePackages: []string{"excluded"},
	}
	err = config.Save(file)
	if err != nil {
		t.Fatal("error saving config\n", err)
	}

	err = file.Close()
	if err != nil {
		t.Fatal("error closing file\n", err)
	}

	loadedConfig, err := c.LoadConfig(file.Name())
	if err != nil {
		t.Fatal("error loading config\n", err)
	}

	if !reflect.DeepEqual(&config, loadedConfig) {
		t.Fatal("expected equal\n", &config, "\n", loadedConfig)
	}
}

func TestMatch(t *testing.T) {
	tests := []struct {
		patterns []string
		path     string
		expected bool
	}{
		{
			patterns: []string{},
			path:     "path/to/file.js",
			expected: false,
		},
		{
			patterns: []string{"*.js"},
			path:     "path/to/file.js",
			expected: true,
		},
		{
			patterns: []string{"path/to/"},
			path:     "path/to/file.js",
			expected: true,
		},
	}

	for _, test := range tests {
		got := c.Match(test.patterns, test.path)
		if got != test.expected {
			t.Fatal("expected equal\n", test.expected, "\n", got)
		}
	}
}

func TestIsPackage(t *testing.T) {
	config := c.Config{PackageFile: []string{"package.json"}}
	tests := []struct {
		path     string
		expected bool
	}{
		{
			path:     filepath.Join("testdata", "path-does-not-exist"),
			expected: false,
		},
		{
			path:     filepath.Join("testdata", "my-package"),
			expected: true,
		},
	}

	for _, test := range tests {
		got := config.IsPackageDir(test.path)
		if test.expected != got {
			t.Fatal("expected equal\n", test.expected, "\n", got)
		}
	}
}

func TestFindPackage(t *testing.T) {
	config := c.Config{PackageFile: []string{"package.json"}}
	tests := []struct {
		path     string
		expected string
	}{
		{
			path:     filepath.Join("testdata", "my-file.txt"),
			expected: ".",
		},
		{
			path:     filepath.Join("testdata", "my-package", "my-file.txt"),
			expected: filepath.Join("testdata", "my-package"),
		},
		{
			path:     filepath.Join("testdata", "my-package", "subpackage", "my-file.txt"),
			expected: filepath.Join("testdata", "my-package", "subpackage"),
		},
	}

	for _, test := range tests {
		got, err := config.FindPackage(test.path)
		if err != nil {
			t.Fatal("error finding package\n", err)
		}
		if test.expected != got {
			t.Fatal("expected equal\n", test.expected, "\n", got)
		}
	}
}

func TestChanged(t *testing.T) {
	config := c.Config{
		PackageFile:     []string{"package.json"},
		Match:           []string{"*"},
		Ignore:          []string{"ignored.txt"},
		ExcludePackages: []string{filepath.Join("testdata", "excluded")},
	}

	tests := []struct {
		name     string
		diffs    []string
		expected []string
	}{
		{
			name:     "Global change, everything is affected",
			diffs:    []string{filepath.Join("testdata", "file.txt")},
			expected: []string{"."},
		},
		{
			name:     "Ignored file, nothing is affected",
			diffs:    []string{filepath.Join("testdata", "ignored.txt")},
			expected: []string{},
		},
		{
			name:     "Single affected package",
			diffs:    []string{filepath.Join("testdata", "my-package", "file.txt")},
			expected: []string{filepath.Join("testdata", "my-package")},
		},
		{
			name:     "Single affected nested package",
			diffs:    []string{filepath.Join("testdata", "my-package", "subpackage", "file.txt")},
			expected: []string{filepath.Join("testdata", "my-package", "subpackage")},
		},
		{
			name:     "Excluded package, nothing is affected",
			diffs:    []string{filepath.Join("testdata", "excluded", "file.txt")},
			expected: []string{},
		},
		{ // If the file doesn't exist, it was removed.
			name:     "Removed file, affects the package",
			diffs:    []string{filepath.Join("testdata", "my-package", "removed.txt")},
			expected: []string{filepath.Join("testdata", "my-package")},
		},
		{ // If the package directory doesn't exist, it was removed.
			name:     "Removed package, nothing is affected",
			diffs:    []string{filepath.Join("testdata", "removed", "file.txt")},
			expected: []string{},
		},
	}

	for _, test := range tests {
		got := config.Changed(os.Stderr, test.diffs)
		if !reflect.DeepEqual(test.expected, got) {
			t.Fatal(test.name, "\nexpected equal\n", test.expected, "\n", got)
		}
	}
}

func TestFindSetupFiles(t *testing.T) {
	config := c.Config{
		PackageFile:     []string{"package.json"},
		CISetupFileName: "ci-setup.json",
		CISetupDefaults: c.CISetup{
			"my-number": 3.14,
			"my-string": "hello",
			"my-array":  []any{"a", "b", "c"},
		},
	}

	emptyPath := filepath.Join("testdata", "setup", "empty")
	defaultsPath := filepath.Join("testdata", "setup", "defaults")
	overridePath := filepath.Join("testdata", "setup", "override")
	paths := []string{emptyPath, defaultsPath, overridePath}
	expected := &map[string]c.CISetup{
		emptyPath: {
			"my-number": 3.14,
			"my-string": "hello",
			"my-array":  []any{"a", "b", "c"},
		},
		defaultsPath: {
			"my-number": 3.14,
			"my-string": "hello",
			"my-array":  []any{"a", "b", "c"},
		},
		overridePath: {
			"my-number": 3.14,
			"my-string": "custom-value",
			"my-array":  []any{"A", "B", "C"},
		},
	}

	got, errors := config.FindSetupFiles(paths)
	if len(errors) > 0 {
		t.Fatal("error finding setup files\n", errors)
	}
	if !reflect.DeepEqual(expected, got) {
		t.Fatal("expected equal\n", expected, "\n", got)
	}
}
func TestFindSetupFilesWithValidation(t *testing.T) {
	config := c.Config{
		PackageFile:     []string{"package.json"},
		CISetupFileName: "ci-setup.json",
		CISetupDefaults: c.CISetup{"my-string": "hello"},
	}

	dir := filepath.Join("testdata", "setup", "override")
	expected := []string{
		fmt.Sprintf("%v: Unexpected field 'my-array': valid fields are [my-string]", filepath.Join(dir, config.CISetupFileName)),
	}
	_, got := config.FindSetupFiles([]string{dir})

	if !reflect.DeepEqual(expected, got) {
		t.Fatal("expected equal\n", expected, "\n", got)
	}
}

func TestValidateCISetup(t *testing.T) {
	tests := []struct {
		name     string
		config   c.Config
		ciSetup  c.CISetup
		expected []string
	}{
		{
			name: "Valid setup",
			config: c.Config{
				CISetupDefaults: c.CISetup{"field1": "x", "field2": "y"},
			},
			ciSetup:  c.CISetup{"field1": "hello"},
			expected: []string{},
		},
		{
			name: "Comment fields",
			config: c.Config{
				CISetupDefaults: c.CISetup{"field1": "x", "field2": "y"},
			},
			ciSetup:  c.CISetup{"_comment1": "a", "_comment2": "b"},
			expected: []string{},
		},
		{
			name: "Undefined field",
			config: c.Config{
				CISetupDefaults: c.CISetup{"field1": "x", "field2": "y"},
			},
			ciSetup: c.CISetup{"undefined": ":)"},
			expected: []string{
				"Unexpected field 'undefined': valid fields are [field1 field2]",
			},
		},
		{
			name: "Type mismatch",
			config: c.Config{
				CISetupDefaults: c.CISetup{"field1": "x", "field2": "y"},
				CISetupHelpURL:  "https://example.com",
			},
			ciSetup: c.CISetup{"field1": 42},
			expected: []string{
				"Unexpected type on 'field1': expected 'string', but got 'int'",
			},
		},
		{
			name: "Multiple errors",
			config: c.Config{
				CISetupDefaults: c.CISetup{"field1": "x", "field2": "y"},
				CISetupHelpURL:  "https://example.com",
			},
			ciSetup: c.CISetup{"undefined": "hello", "field1": 42, "field2": []string{}},
			expected: []string{
				"Unexpected type on 'field1': expected 'string', but got 'int'",
				"Unexpected type on 'field2': expected 'string', but got '[]string'",
				"Unexpected field 'undefined': valid fields are [field1 field2]",
			},
		},
	}

	for _, test := range tests {
		got := test.config.ValidateCISetup(test.ciSetup)
		if !reflect.DeepEqual(test.expected, got) {
			t.Fatalf("%v -- expected equal\n%v\n%v", test.name, test.expected, got)
		}
	}
}
