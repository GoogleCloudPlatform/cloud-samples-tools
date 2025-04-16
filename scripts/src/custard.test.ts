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

import {expect} from 'chai';
import * as custard from './custard.ts';

const projectId = 'my-test-project';
const serviceAccount = `my-sa@${projectId}.iam.gserviceaccount.com`;

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

describe('uniqueId', () => {
  it('should match length 4', () => {
    const n = 4;
    expect(custard.uniqueId(n).length).to.equal(n);
  });

  it('should match length 6', () => {
    const n = 6;
    expect(custard.uniqueId(n).length).to.equal(n);
  });
});
