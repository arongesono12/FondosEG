import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessDashboardModule,
  getDashboardModuleHref,
  parseDashboardModule,
} from '../../components/dashboard/dashboard-modules.ts';

test('dashboard modules resolve to their own page routes', () => {
  assert.equal(parseDashboardModule('transfers'), 'transfers');
  assert.equal(parseDashboardModule('staff'), 'staff');
  assert.equal(parseDashboardModule('unknown'), null);
  assert.equal(parseDashboardModule(null), null);

  assert.equal(getDashboardModuleHref('balance'), '/balance');
  assert.equal(getDashboardModuleHref('transfers'), '/transfers');
  assert.equal(getDashboardModuleHref('agents'), '/agents');
  assert.equal(getDashboardModuleHref('stats'), '/stats');
  assert.equal(getDashboardModuleHref('history'), '/history');
  assert.equal(getDashboardModuleHref('staff'), '/staff');
});

test('module permissions mirror the role-aware dashboard navbar', () => {
  assert.equal(canAccessDashboardModule('transfers', 'cliente'), true);
  assert.equal(canAccessDashboardModule('balance', 'gestor'), true);
  assert.equal(canAccessDashboardModule('agents', 'cliente'), false);
  assert.equal(canAccessDashboardModule('stats', 'admin'), true);
  assert.equal(canAccessDashboardModule('staff', 'admin'), false);
  assert.equal(canAccessDashboardModule('staff', 'superadmin'), true);
  assert.equal(canAccessDashboardModule('history', null), false);
});
