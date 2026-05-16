const test = require('node:test');
const assert = require('node:assert/strict');
const { floorToTier } = require('../gear-calc.js');

test('floorToTier: exact tier values pass through', () => {
  assert.equal(floorToTier(1), 1);
  assert.equal(floorToTier(5), 5);
  assert.equal(floorToTier(30), 30);
  assert.equal(floorToTier(45), 45);
});

test('floorToTier: values between tiers floor down', () => {
  assert.equal(floorToTier(34), 30);
  assert.equal(floorToTier(4), 1);
  assert.equal(floorToTier(44), 40);
});

test('floorToTier: values above 45 return 45', () => {
  assert.equal(floorToTier(50), 45);
});

test('floorToTier: values below 1 return null', () => {
  assert.equal(floorToTier(0), null);
});
