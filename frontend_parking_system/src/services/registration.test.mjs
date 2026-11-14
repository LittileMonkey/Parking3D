import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function registration() {
  const source = fs.readFileSync(new URL('./registration.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports });
  return exports;
}

test('registration sends the Identity field names and normalized Vietnamese phone', () => {
  const result = registration().createRegistrationRequest({ email: ' User@Example.com ', fullName: ' Test User ', phoneE164: '0912 345 678', password: 'Example-Only-123' });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { emailNormalized: 'USER@EXAMPLE.COM', fullName: 'Test User', phoneE164: '+84912345678', password: 'Example-Only-123' });
  assert.equal('email' in result, false);
  assert.equal('roles' in result, false);
});

test('registration accepts international E164 numbers and never invents a phone number', () => {
  const { createRegistrationRequest } = registration();
  const base = { email: 'user@example.com', fullName: 'Test User', password: 'Example-Only-123' };
  assert.equal(createRegistrationRequest({ ...base, phoneE164: '+1 (202) 555-0123' }).phoneE164, '+12025550123');
  for (const phoneE164 of ['', 'abc', '123', '+00000000']) {
    assert.throws(() => createRegistrationRequest({ ...base, phoneE164 }), /Số điện thoại/);
  }
});
