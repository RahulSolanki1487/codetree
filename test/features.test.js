import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { routeOf } from '../src/features.js';
import { scan } from '../src/scan.js';
import { repo } from './helpers.js';

const { model } = await scan(join(repo, 'test', 'fixtures', 'features'));
const orders = model.features.find(f => f.name === 'Orders');
const endpoint = (verb, path) => orders.endpoints.find(e => e.verb === verb && e.path === path);
const callers = e => e.callers.map(c => `${c.class.split('#')[1]}.${c.member}`).sort();

test('a controller is one feature, named without "Controller", with the classes it takes in', () => {
  assert.deepEqual(model.features.map(f => f.name), ['Orders']);
  assert.equal(orders.route, 'api/orders');
  assert.deepEqual(orders.uses.map(u => u.split('#')[1]), ['OrderService'], 'the qualified IOptions<> parameter does not hide the class name');
});

test('its endpoints have the verb and the full route; methods without a verb are not endpoints', () => {
  assert.deepEqual(orders.endpoints.map(e => `${e.verb} ${e.path}`),
    ['GET api/orders/mine', 'GET api/orders/{id:int}', 'POST api/orders', 'POST api/hooks/paid']);
});

test('front-end calls are matched by verb and path; a variable part matches any value, a fixed path wins over a variable one', () => {
  assert.deepEqual(callers(endpoint('GET', 'api/orders/mine')), ['ApiService.myOrders', 'api.load']);
  assert.deepEqual(callers(endpoint('GET', 'api/orders/{id:int}')), ['ApiService.getOrder']);
  assert.deepEqual(callers(endpoint('POST', 'api/orders')), ['ApiService.place']);
  assert.deepEqual(callers(endpoint('POST', 'api/hooks/paid')), ['ApiService.paid']);
});

test('test files and paths no controller answers are not callers', () => {
  const all = orders.endpoints.flatMap(e => e.callers.map(c => c.class));
  assert.ok(!all.some(c => c.includes('spec')));
  assert.ok(!all.some(c => c.includes('other')));
});

test('routeOf: [controller] is filled in, and a path that starts with / stands alone', () => {
  assert.equal(routeOf({ name: 'CartController', route: 'api/[controller]' }, { path: 'add' }), 'api/cart/add');
  assert.equal(routeOf({ name: 'CartController', route: 'api/[controller]' }, { path: '/x' }), 'x');
  assert.equal(routeOf({ name: 'CartController', route: 'api/cart/' }, { path: '' }), 'api/cart');
});
