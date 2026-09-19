import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessDashboardModule,
  getDashboardModuleFromPath,
  getDashboardModuleHref,
  getDashboardNavigationHref,
  parseDashboardModule,
} from '../../components/dashboard/dashboard-modules.ts';

test('dashboard module values and legacy paths resolve to panel URLs', () => {
  assert.equal(parseDashboardModule('transfers'), 'transfers');
  assert.equal(parseDashboardModule('staff'), 'staff');
  assert.equal(parseDashboardModule('unknown'), null);
  assert.equal(parseDashboardModule(null), null);

  assert.equal(getDashboardModuleFromPath('/history'), 'history');
  assert.equal(getDashboardModuleFromPath('/dashboard'), null);
  assert.equal(getDashboardModuleHref('balance'), '/dashboard?module=balance');
  assert.equal(getDashboardNavigationHref('/stats'), '/dashboard?module=stats');
  assert.equal(getDashboardNavigationHref('/dashboard'), '/dashboard');
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
