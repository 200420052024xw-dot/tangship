import { test } from 'node:test';
import assert = require('node:assert/strict');
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdminDataService } from './admin-data.service';

const removeDatabase = (path: string) => {
  for (const suffix of ['', '-shm', '-wal']) if (existsSync(`${path}${suffix}`)) rmSync(`${path}${suffix}`);
};

test('SQLite admin repository supports login, sessions and atomic review', async () => {
  const path = resolve(process.cwd(), `data/admin-test-${process.pid}.sqlite`);
  removeDatabase(path);
  process.env.ADMIN_DATA_BACKEND = 'sqlite';
  process.env.ADMIN_SQLITE_DB_PATH = path;
  process.env.NODE_ENV = 'test';
  const service = new AdminDataService({} as any);
  try {
    service.onModuleInit();
    const admin = await service.authenticate('wjf', '123');
    const session = await service.createAdminSession(admin.id);
    assert.equal((await service.adminFromSession(session.token))?.username, 'wjf');
    assert.equal(service.runtime().capabilities.assetUpload, false);
    assert.equal(service.dashboard().pendingReview, 2);

    const sourceVehicle = service.listVehicles('single').find(vehicle => vehicle.id === 'z5-2026');
    assert.ok(sourceVehicle);
    service.saveVehicle(admin.id, sourceVehicle.id, {
      ...sourceVehicle,
      fullName: 'Z5 同步验证车型',
      specs: { ...sourceVehicle.specs, cargoVolume: '3.0m³', cargoDimensionsMm: { length: 2600, width: 1400, height: 1400 }, speedKmh: '20-30', chargeTime: '2 小时' },
      applicableScenes: ['城市配送', '园区运输'],
      pricingDescription: { description: '最终价格由后台统一核价确认', startFrom: 68 },
      syncModes: ['monthly', 'rental'],
    });
    const monthlyCopy = service.listVehicles('monthly').find(vehicle => vehicle.id === 'z5-2026-monthly');
    const rentalCopy = service.listVehicles('rental').find(vehicle => vehicle.id === 'z5-2026-rental');
    const monthlyPricing = monthlyCopy?.pricingDescription as { startFrom?: number } | undefined;
    const rentalSpecs = rentalCopy?.specs as { cargoDimensionsMm?: { length?: number } } | undefined;
    assert.equal(monthlyCopy?.fullName, 'Z5 同步验证车型');
    assert.equal(rentalSpecs?.cargoDimensionsMm?.length, 2600);
    assert.equal(monthlyPricing?.startFrom, 68);
    assert.deepEqual(monthlyCopy?.supportedModes, ['monthly']);
    assert.deepEqual(rentalCopy?.supportedModes, ['rental']);
    assert.ok(monthlyCopy);
    service.saveVehicle(admin.id, monthlyCopy.id, { ...monthlyCopy, fullName: 'Z5 包月反向同步验证', syncModes: ['single'] });
    assert.equal(service.listVehicles('single').find(vehicle => vehicle.id === 'z5-2026')?.fullName, 'Z5 包月反向同步验证');
    assert.throws(() => service.deleteVehicleImage(admin.id, 'z5-2026', 'missing-image'));

    const reviewsBefore = service.reviews({ page: 1, pageSize: 20 }).total;
    const order = service.listOrders({ status: 'pending_review', page: 1, pageSize: 10 }).items[0];
    const capacityBefore = service.listVehicles().find(vehicle => vehicle.id === order.vehicle_id);
    const result = service.reviewOrder(admin.id, order.id, { decision: 'approve', baseFeeCents: 2500, distanceFeeCents: 400, vehicleFeeCents: 500, serviceFeeCents: 0, discountCents: 0, distanceMeters: 4000, vehicleCount: 2, expiresAt: new Date(Date.now() + 3600000).toISOString() });
    assert.equal(result.status, 'pending_payment');
    assert.equal(result.reserved_vehicle_count, 2);
    const capacityAfterReview = service.listVehicles().find(vehicle => vehicle.id === order.vehicle_id);
    assert.equal(capacityAfterReview?.reservedCount, (capacityBefore?.reservedCount || 0) + 2);
    assert.equal(capacityAfterReview?.availableCount, Math.max(0, (capacityBefore?.availableCount || 0) - 2));
    assert.throws(() => service.reviewOrder(admin.id, order.id, { decision: 'reject', rejectionReason: 'duplicate' }));
    assert.equal(service.reviews({ page: 1, pageSize: 20 }).total, reviewsBefore + 1);

    const paidOrder = service.listOrders({ status: 'paid', page: 1, pageSize: 10 }).items[0];
    assert.ok(paidOrder);
    assert.throws(() => service.transitionOrder(admin.id, paidOrder.id, { status: 'dispatching', note: '缺少车辆数' }));
    const dispatched = service.transitionOrder(admin.id, paidOrder.id, { status: 'dispatching', note: '车辆 A01 已出发取件', vehicleCount: 2, vehiclePlate: '沪A·TEST' });
    assert.equal(dispatched.status, 'dispatching');
    assert.equal(dispatched.dispatch_vehicle_count, 2);
    assert.equal(dispatched.vehicle_plate, '沪A·TEST');
    assert.equal(service.transitionOrder(admin.id, paidOrder.id, { status: 'delivering', note: '取件完成，自动配送中' }).status, 'delivering');
    assert.throws(() => service.transitionOrder(admin.id, paidOrder.id, { status: 'completed' }));
    const completed = service.transitionOrder(admin.id, paidOrder.id, { status: 'completed', note: '已送达收件人' });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.reserved_vehicle_count, 0);

    const notifications = service.listNotifications(admin.id, { page: 1, pageSize: 100 });
    assert.ok(notifications.unreadCount > 0);
    service.markNotificationRead(admin.id, notifications.items[0].id);
    service.markAllNotificationsRead(admin.id);
    assert.equal(service.listNotifications(admin.id, { page: 1, pageSize: 100 }).unreadCount, 0);

    service.createBinding(admin.id, 'local-user-001', 'operator');
    const firstBinding = service.listWechatUsers({ page: 1, pageSize: 20 }).items.find(item => item.id === 'local-user-001');
    assert.ok(firstBinding);
    service.revokeBinding(firstBinding.bindingId);
    assert.throws(() => service.createBinding(admin.id, 'local-user-001', 'finance'));
    service.createBinding(admin.id, 'local-user-001', 'super_admin');
    const rebound = service.listWechatUsers({ page: 1, pageSize: 20 }).items.find(item => item.id === 'local-user-001');
    assert.ok(rebound);
    assert.equal(rebound.role, 'super_admin');

    await service.revokeAdminSession(session.token);
    assert.equal(await service.adminFromSession(session.token), null);
  } finally {
    service.onModuleDestroy();
    removeDatabase(path);
    delete process.env.ADMIN_SQLITE_DB_PATH;
  }
});

test('production rejects SQLite admin backend', () => {
  process.env.ADMIN_DATA_BACKEND = 'sqlite';
  process.env.NODE_ENV = 'production';
  assert.throws(() => new AdminDataService({} as any), /forbidden in production/);
  process.env.NODE_ENV = 'test';
});
