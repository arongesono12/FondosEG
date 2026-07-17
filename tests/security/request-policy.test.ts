import assert from 'node:assert/strict';
import test from 'node:test';
import { exceedsByteLimit, isAllowedSameOriginMutation } from '../../lib/security/request-policy.ts';

test('same-origin mutations are accepted', () => {
  assert.equal(isAllowedSameOriginMutation({
    requestHost: 'fondoseg.com',
    origin: 'https://fondoseg.com',
    fetchSite: 'same-origin',
  }), true);
});

test('cross-site and malformed origins are rejected', () => {
  assert.equal(isAllowedSameOriginMutation({
    requestHost: 'fondoseg.com',
    origin: 'https://attacker.example',
    fetchSite: 'cross-site',
  }), false);
  assert.equal(isAllowedSameOriginMutation({
    requestHost: 'fondoseg.com',
    origin: 'not a URL',
    fetchSite: null,
  }), false);
});

test('missing origin is only accepted with same-site fetch metadata', () => {
  assert.equal(isAllowedSameOriginMutation({
    requestHost: 'fondoseg.com', origin: null, fetchSite: 'same-site',
  }), true);
  assert.equal(isAllowedSameOriginMutation({
    requestHost: 'fondoseg.com', origin: null, fetchSite: null,
  }), false);
});

test('payload limits count UTF-8 bytes rather than characters', () => {
  assert.equal(exceedsByteLimit('abcd', 4), false);
  assert.equal(exceedsByteLimit('áá', 3), true);
});

