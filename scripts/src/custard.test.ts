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
    expect(custard.loadJsonc(filePath)).deep.equals({x: 1, y: 2});
  });
});

describe('loadConfig', () => {
  it('empty config', () => {
    const filePath = path.join('test', 'config', 'empty.json');
    const err = "'package-file' is required in test/config/empty.json";
    expect(() => custard.loadConfig(filePath)).to.throw(err);
  });

  it('default values', () => {
    const filePath = path.join('test', 'config', 'default-values.json');
    expect(custard.loadConfig(filePath)).deep.equals({
      'package-file': ['package.json'],
      match: ['*'],
    });
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
      'other-field': 'with comments',
    });
  });

  it('load ci-setup.json', () => {
    const config: custard.Config = {'package-file': 'package.json'};
    const packagePath = path.join('test', 'ci-setup', 'with-setup-json');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({
      env: {A: 'a', B: 'b'},
      secrets: {C: 'c'},
      'other-field': 'without comments',
    });
  });

  it('load custom ci-setup filename string', () => {
    const config: custard.Config = {
      'package-file': 'package.json',
      'ci-setup-filename': 'my-setup.json',
    };
    const packagePath = path.join('test', 'ci-setup', 'custom-name');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({x: 1, y: 2});
  });

  it('load custom ci-setup filename list', () => {
    const config: custard.Config = {
      'package-file': 'package.json',
      'ci-setup-filename': ['my-setup.jsonc', 'my-setup.json'],
    };
    const packagePath = path.join('test', 'ci-setup', 'custom-name');
    expect(custard.loadCISetup(config, packagePath)).deep.equals({x: 1, y: 2});
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
    const vars = Object.fromEntries(custard.listEnv());
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
    const env = {PROJECT_ID: 'my-project'};
    const vars = Object.fromEntries(custard.listSecrets(env));
    expect(Object.keys(vars)).deep.equals(['ID_TOKEN']);
  });

  it('do not substitute secrets', () => {
    const env = {PROJECT_ID: 'my-project', ID_TOKEN: '$PROJECT_ID'};
    const vars = Object.fromEntries(custard.listSecrets(env));
    expect(vars).deep.equals({ID_TOKEN: '$PROJECT_ID'});
  });
});
