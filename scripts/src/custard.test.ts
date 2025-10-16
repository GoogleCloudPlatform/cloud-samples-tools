/*
 Copyright 2025 Google LLC

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

import * as path from 'node:path';
import {expect} from 'chai';
import * as custard from './custard.ts';

describe('loadJsonc', () => {
  it('file does not exist', () => {
    const filePath = 'does-not-exist.jsonc';
    const err = 'no such file or directory';
    expect(() => custard.loadJsonc(filePath)).to.throw(err);
  });

  it('comments', () => {
    const filePath = path.join('test', 'jsonc', 'comments.jsonc');
    expect(custard.loadJsonc(filePath)).deep.equals({
      x: 1,
      y: 2,
      url: 'https://example.com',
    });
  });
});

describe('loadConfig', () => {
  it('default values', () => {
    const configPath = path.join('test', 'config', 'default-values.json');
    expect(custard.loadConfig(configPath)).deep.equals({
      'package-file': ['package.json'],
      match: ['*'],
    });
  });
});

describe('validateConfig', () => {
  it('undefined fields', () => {
    const config = {
      'package-file': 'pkg.txt',
      'undefined-field': 1,
      commands: {
        test: {undefined: 1},
      },
    };
    expect(custard.validateConfig(config)).to.deep.equal([
      "'undefined-field' is not a valid field",
      "'commands.test.undefined' is not a valid field",
    ]);
  });

  it('type checking', () => {
    const config = {
      'package-file': 1,
      'ci-setup-filename': 1,
      'ci-setup-defaults': {env: {A: 1}, secrets: {B: 1}},
      'ci-setup-help-url': 1,
      match: 1,
      ignore: 1,
      commands: {
        test: {pre: 1, run: 1, post: 1},
      },
      'exclude-packages': 1,
    };
    expect(custard.validateConfig(config)).to.deep.equal([
      "'package-file' must be string or string[], got: 1",
      "'ci-setup-filename' must be string or string[], got: 1",
      '\'ci-setup-defaults.env\' must be {string: string} mappings, got: {"A":1}',
      '\'ci-setup-defaults.secrets\' must be {string: string} mappings, got: {"B":1}',
      "'ci-setup-help-url' must be string, got: 1",
      "'match' must be string or string[], got: 1",
      "'ignore' must be string or string[], got: 1",
      "'exclude-packages' must be string or string[], got: 1",
      "'commands.test.pre' must be string or string[], got: 1",
      "'commands.test.run' must be string or string[], got: 1",
      "'commands.test.post' must be string or string[], got: 1",
    ]);
  });
});

describe('validateCISetup', () => {
  it('undefined fields', () => {
    const config: custard.Config = {
      'package-file': 'pkg.txt',
      'ci-setup-defaults': {
        'defined-field': 1,
      },
    };
    const ciSetup = {
      env: {}, // even if not in the defaults, this is ok
      secrets: {}, // even if not in the defaults, this is ok
      'defined-field': 2, // it's in the defaults, this is ok
      'undefined-field': 1, // not in the defaults, this is an error
      _comment: 'underscore names are comments', // this is ok
    };
    expect(custard.validateCISetup(config, ciSetup)).to.deep.equal([
      "'undefined-field' is not a valid field",
    ]);
  });

  it('type checking', () => {
    const config: custard.Config = {
      'package-file': 'pkg.txt',
      'ci-setup-defaults': {
        var1: 'override',
        var2: 'default',
      },
    };
    const ciSetup = {
      env: {A: 1},
      secrets: {B: 1},
      var1: 1,
      // var2 is undefined, this is ok
    };
    expect(custard.validateCISetup(config, ciSetup)).to.deep.equal([
      '\'env\' must be {string: string} mappings, got: {"A":1}',
      '\'secrets\' must be {string: string} mappings, got: {"B":1}',
      "'var1' must be string, got: 1",
    ]);
  });
});

describe('loadCISetup', () => {
  it('no ci-setup file', () => {
    const config: custard.Config = {'package-file': 'package.json'};
    const packagePath = path.join('test', 'ci-setup', 'without-setup');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({});
  });

  it('load ci-setup.jsonc', () => {
    const config: custard.Config = {'package-file': 'package.json'};
    const packagePath = path.join('test', 'ci-setup', 'with-setup-jsonc');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({
      env: {A: 'a', B: 'b'},
      secrets: {C: 'c'},
    });
  });

  it('load ci-setup.json', () => {
    const config: custard.Config = {'package-file': 'package.json'};
    const packagePath = path.join('test', 'ci-setup', 'with-setup-json');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({
      env: {A: 'a', B: 'b'},
      secrets: {C: 'c'},
    });
  });

  it('load custom ci-setup filename string', () => {
    const config: custard.Config = {
      'package-file': 'package.json',
      'ci-setup-filename': 'my-setup.json',
    };
    const packagePath = path.join('test', 'ci-setup', 'custom-name');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({
      env: {A: 'a', B: 'b'},
      secrets: {C: 'c'},
    });
  });

  it('load custom ci-setup filename list', () => {
    const config: custard.Config = {
      'package-file': 'package.json',
      'ci-setup-filename': ['my-setup.jsonc', 'my-setup.json'],
    };
    const packagePath = path.join('test', 'ci-setup', 'custom-name');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({
      env: {A: 'a', B: 'b'},
      secrets: {C: 'c'},
    });
  });
});

describe('listVars', () => {
  it('empty', () => {
    const env = {};
    const ciSetup = {};
    const defaults = {};
    const automatic = {};
    const vars = [...custard.listVars(env, ciSetup, defaults, automatic)];
    expect(vars).to.deep.equal([]);
  });

  it('4) automatic var', () => {
    const env = {};
    const ciSetup = {};
    const defaults = {};
    const automatic = {VAR: () => 'auto'};
    const vars = [...custard.listVars(env, ciSetup, defaults, automatic)];
    const expected = [['VAR', {value: 'auto', source: 'automatic var'}]];
    expect(vars).to.deep.equal(expected);
  });

  it('3) default value', () => {
    const env = {};
    const ciSetup = {};
    const defaults = {VAR: 'default'};
    const automatic = {VAR: () => 'auto'};
    const vars = [...custard.listVars(env, ciSetup, defaults, automatic)];
    const expected = [['VAR', {value: 'default', source: 'default value'}]];
    expect(vars).to.deep.equal(expected);
  });

  it('2) ci-setup.json', () => {
    const env = {};
    const ciSetup = {VAR: 'ci-setup'};
    const defaults = {VAR: 'default'};
    const automatic = {VAR: () => 'auto'};
    const vars = [...custard.listVars(env, ciSetup, defaults, automatic)];
    const expected = [['VAR', {value: 'ci-setup', source: 'ci-setup.json'}]];
    expect(vars).to.deep.equal(expected);
  });

  it('1) user-defined', () => {
    const env = {VAR: 'user'};
    const ciSetup = {VAR: 'ci-setup'};
    const defaults = {VAR: 'default'};
    const automatic = {VAR: () => 'auto'};
    const vars = [...custard.listVars(env, ciSetup, defaults, automatic)];
    const expected = [['VAR', {value: 'user', source: 'user-defined'}]];
    expect(vars).to.deep.equal(expected);
  });

  it('do not list env vars if not defined otherwise', () => {
    const env = {
      UNDEFINED: 'undefined',
      CI_SETUP: 'ci-setup',
      DEFAULT: 'default',
      AUTO: 'auto',
    };
    const ciSetup = {CI_SETUP: 'should override'};
    const defaults = {DEFAULT: 'should override'};
    const automatic = {AUTO: () => 'should override'};
    const vars = [...custard.listVars(env, ciSetup, defaults, automatic)];
    const expected = [
      ['AUTO', {value: 'auto', source: 'user-defined'}],
      ['DEFAULT', {value: 'default', source: 'user-defined'}],
      ['CI_SETUP', {value: 'ci-setup', source: 'user-defined'}],
    ];
    expect(vars).to.deep.equal(expected);
  });

  it('should only transform ciSetup and defaults', () => {
    const env = {USER: 'user'};
    const ciSetup = {CI_SETUP: 'ci-setup', USER: 'default-user'};
    const defaults = {DEFAULT: 'default'};
    const automatic = {AUTO: () => 'auto'};
    const transform = (x: string) => x.toUpperCase();
    const vars = [
      ...custard.listVars(env, ciSetup, defaults, automatic, transform),
    ];
    const expected = [
      ['AUTO', {value: 'auto', source: 'automatic var'}],
      ['DEFAULT', {value: 'DEFAULT', source: 'default value'}],
      ['CI_SETUP', {value: 'CI-SETUP', source: 'ci-setup.json'}],
      ['USER', {value: 'user', source: 'user-defined'}],
    ];
    expect(vars).to.deep.equal(expected);
  });
});

describe('substitute', () => {
  it('undefined sub', () => {
    const subs = {};
    expect(custard.substitute(subs, '$VAR')).to.equal('$VAR');
  });

  it('defined direct', () => {
    const subs = {VAR: 'value'};
    expect(custard.substitute(subs, '$VAR')).to.equal('value');
  });

  it('defined indirect', () => {
    const subs = {X: '$Y', VAR: '$X', Y: 'value'};
    expect(custard.substitute(subs, '$VAR')).to.equal('value');
  });

  it('$VAR match on word boundary', () => {
    const subs = {VAR: 'b'};
    expect(custard.substitute(subs, 'a-$VAR-c')).to.equal('a-b-c');
  });

  it('$VAR mismatch on non-word boundary', () => {
    const subs = {VAR: 'b'};
    expect(custard.substitute(subs, 'a-$VARs-c')).to.equal('a-$VARs-c');
  });

  it('${VAR} match without spaces', () => {
    const subs = {VAR: 'b'};
    expect(custard.substitute(subs, 'a-${VAR}s-c')).to.equal('a-bs-c');
  });

  it('${VAR} match with spaces', () => {
    const subs = {VAR: 'b'};
    expect(custard.substitute(subs, 'a-${  VAR  }s-c')).to.equal('a-bs-c');
  });
});

describe('uniqueId', () => {
  it('should match length 4', () => {
    const n = 4;
    expect(custard.uniqueId(n).length).to.equal(n);
  });

  it('should match length 6', () => {
    const n = 6;
    expect(custard.uniqueId(n).length).to.equal(n);
  });

  it('should be unique', () => {
    const id1 = custard.uniqueId();
    const id2 = custard.uniqueId();
    expect(id1).to.not.equals(id2);
  });
});

describe('listEnv', () => {
  it('automatic variables', () => {
    const env = {PROJECT_ID: 'my-project'};
    const vars = Object.fromEntries(custard.listEnv(env));
    expect(Object.keys(vars)).deep.equals([
      'PROJECT_ID',
      'RUN_ID',
      'SERVICE_ACCOUNT',
    ]);
  });

  it('substitute env vars', () => {
    const env = {
      PROJECT_ID: 'my-project',
      RUN_ID: 'my-run',
      SERVICE_ACCOUNT: 'my-service-account',
      UNDEFINED: 'should not be exported',
    };
    const ciSetup = {VAR: '$X', X: 'x'};
    const vars = Object.fromEntries(custard.listEnv(env, ciSetup));
    expect(vars).deep.equals({
      PROJECT_ID: 'my-project',
      RUN_ID: 'my-run',
      SERVICE_ACCOUNT: 'my-service-account',
      VAR: 'x',
      X: 'x',
    });
  });
});

describe('listSecrets', () => {
  it('automatic variables', () => {
    const vars = Object.fromEntries(custard.listSecrets());
    expect(vars).deep.equals({ID_TOKEN: ''});
  });

  it('do not substitute secrets', () => {
    const env = {PROJECT_ID: 'my-project', ID_TOKEN: '$PROJECT_ID'};
    const vars = Object.fromEntries(custard.listSecrets(env));
    expect(vars).deep.equals({ID_TOKEN: '$PROJECT_ID'});
  });
});

describe('isPackageDir', () => {
  const config: custard.Config = {'package-file': 'package-file.txt'};
  it('is package', () => {
    expect(custard.isPackageDir(config, 'test/affected/valid-package'));
  });
  it('is not package', () => {
    expect(!custard.isPackageDir(config, 'test/affected/no-package-file'));
  });
  it('path does not exist', () => {
    expect(!custard.isPackageDir(config, 'does-not-exist'));
  });
});

describe('getPackageDir', () => {
  const config: custard.Config = {'package-file': 'package-file.txt'};
  it('path does not exist', () => {
    console.log(' --- getPackageDir path does not exist');
    expect(custard.getPackageDir(config, 'path/does-not-exist')).to.be.null;
  });
  it('global package', () => {
    console.log(' --- getPackageDir global package');
    expect(
      custard.getPackageDir(config, 'test/affected/no-package-file/file.txt'),
    ).equals('.');
  });
  it('local package', () => {
    expect(
      custard.getPackageDir(config, 'test/affected/valid-package/file.txt'),
    ).equals('test/affected/valid-package');
  });
  it('diff in subdirectory', () => {
    expect(
      custard.getPackageDir(
        config,
        'test/affected/valid-package/path/to/file.txt',
      ),
    ).equals('test/affected/valid-package');
  });
  it('local subpackage', () => {
    expect(
      custard.getPackageDir(
        config,
        'test/affected/valid-package/subdir/subpackage/file.txt',
      ),
    ).equals('test/affected/valid-package/subdir/subpackage');
  });
});

describe('matches', () => {
  it('does not match', () =>
    expect(custard.matches('does-not-match.txt', ['match.txt'])).to.be.false);
  it('full match', () =>
    expect(custard.matches('path/to/match', ['path/to/match'])).to.be.true);
  it('filename match', () =>
    expect(custard.matches('path/to/match', ['match'])).to.be.true);
  it('glob star match', () =>
    expect(custard.matches('path/to/match.txt', ['*.txt'])).to.be.true);
  it('glob double star match', () =>
    expect(custard.matches('path/to/match.txt', ['**/*.txt'])).to.be.true);
  it('regex match', () =>
    expect(custard.matches('path/to/match-wildcard.txt', ['match-[^.]*\\.txt']))
      .to.be.true);
});

describe('fileMatchesConfig', () => {
  const config: custard.Config = {match: ['*.md'], ignore: ['README.md']};
  it('does not match', () => {
    expect(custard.fileMatchesConfig(config, 'file.txt')).to.be.false;
  });
  it('matches', () => {
    expect(custard.fileMatchesConfig(config, 'file.md')).to.be.true;
  });
  it('matches but ignored', () => {
    expect(custard.fileMatchesConfig(config, 'README.md')).to.be.false;
  });
  it('matches all by default', () => {
    expect(custard.fileMatchesConfig({}, 'file.md')).to.be.true;
  });
});

describe('matchPackages', () => {
  const config: custard.Config = {
    'package-file': 'package-file.txt',
    match: ['*.txt'],
    'exclude-packages': ['test/affected/excluded'],
  };
  it('does not match', () => {
    const diffs = ['test/affected/valid-package/file.md'];
    expect(custard.matchPackages(config, diffs)).to.deep.equals([]);
  });
  it('does not exist', () => {
    const diffs = ['path/does/not/exist/file.txt'];
    expect(custard.matchPackages(config, diffs)).to.deep.equals([]);
  });
  it('matches', () => {
    const diffs = ['test/affected/valid-package/file.txt'];
    expect(custard.matchPackages(config, diffs)).to.deep.equals([
      'test/affected/valid-package',
    ]);
  });
  it('matches unique', () => {
    const diffs = [
      'test/affected/valid-package/file1.txt',
      'test/affected/valid-package/file2.txt',
      'test/affected/valid-package/path/to/file3.txt',
    ];
    expect(custard.matchPackages(config, diffs)).to.deep.equals([
      'test/affected/valid-package',
    ]);
  });
  it('matches global change', () => {
    const diffs = ['test/affected/no-package-file/file.txt'];
    expect(custard.matchPackages(config, diffs)).to.deep.equals(['.']);
  });
  it('matches but excluded', () => {
    const diffs = ['test/affected/excluded/file.txt'];
    expect(custard.matchPackages(config, diffs)).to.deep.equals([]);
  });
});

describe('findPackages', () => {
  const config: custard.Config = {
    'package-file': 'package-file.txt',
    'exclude-packages': ['test/affected/excluded'],
  };
  it('finds recursively', () => {
    expect([...custard.findPackages(config, 'test/affected')]).to.deep.equals([
      'test/affected/valid-package',
      'test/affected/valid-package/subdir/subpackage',
    ]);
  });
});

describe('affected', () => {
  const config: custard.Config = {
    'package-file': 'package-file.txt',
    'exclude-packages': ['test/affected/excluded'],
  };
  it('affected one', () => {
    const diffs = ['test/affected/valid-package/file.txt'];
    expect(custard.affected(config, diffs)).to.deep.equals([
      'test/affected/valid-package',
    ]);
  });
  it('affected all', () => {
    const diffs = ['test/affected/no-package-file/file.txt'];
    expect(custard.affected(config, diffs)).to.deep.equals([
      'test/affected/valid-package',
      'test/affected/valid-package/subdir/subpackage',
    ]);
  });
});

describe('run', () => {
  const cmd: custard.Command = {
    pre: 'echo "pre-test"',
    run: 'sh test.sh',
    post: 'echo "post-test"',
  };

  it('empty', () => {
    const config: custard.Config = {};
    const paths: string[] = [];
    const env = {};
    console.log(`\n--- run.empty ${config} ${paths} ${env}`);
    expect(() => custard.run(config, cmd, paths, env)).to.not.throw();
  });

  it('one', () => {
    const config: custard.Config = {};
    const paths = ['test/run/pkg-pass'];
    const env = {PROJECT_ID: 'project-id', ID_TOKEN: 'id-token'};
    console.log(`\n--- run.one ${config} ${paths} ${env}`);
    expect(() => custard.run(config, cmd, paths, env)).to.not.throw();
  });

  it('fail 1', () => {
    const config: custard.Config = {};
    const paths = ['test/run/pkg-fail', 'test/run/pkg-pass'];
    const env = {PROJECT_ID: 'project-id', ID_TOKEN: 'id-token'};
    console.log(`\n--- run.two ${config} ${paths} ${env}`);
    expect(() => custard.run(config, cmd, paths, env)).to.throw();
  });

  it('fail 2', () => {
    const config: custard.Config = {};
    const paths = ['test/run/pkg-pass', 'test/run/pkg-fail'];
    const env = {PROJECT_ID: 'project-id', ID_TOKEN: 'id-token'};
    console.log(`\n--- run.two ${config} ${paths} ${env}`);
    expect(() => custard.run(config, cmd, paths, env)).to.throw();
  });
});
