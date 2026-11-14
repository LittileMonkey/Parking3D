import test from 'node:test';
import assert from 'node:assert/strict';
import { findPaymentReturn, rememberPaymentReturn } from './paymentReturnContext.ts';

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const url = ref => `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=${ref}`;

test('matches each VNPay attempt to its own booking across concurrent payments', () => {
  const store = storage();
  rememberPaymentReturn(url('attempt-A'), 'booking-A', 'payment-A', store, 1000);
  rememberPaymentReturn(url('attempt-B'), 'booking-B', 'payment-B', store, 1100);
  assert.equal(findPaymentReturn('attempt-A', store, 1200).bookingId, 'booking-A');
  assert.equal(findPaymentReturn('attempt-B', store, 1200).bookingId, 'booking-B');
  assert.equal(findPaymentReturn('unknown', store, 1200), null);
});
test('expires context without treating another or an old booking as the return target', () => {
  const store = storage();
  rememberPaymentReturn(url('attempt'), 'booking', 'payment', store, 0);
  assert.equal(findPaymentReturn('attempt', store, 2 * 60 * 60000), null);
});
test('rejects missing transaction references, insecure URLs and tolerates corrupt storage', () => {
  const store = storage();
  assert.throws(() => rememberPaymentReturn('https://sandbox.vnpayment.vn/', 'b', 'p', store));
  assert.throws(() => rememberPaymentReturn('http://sandbox.vnpayment.vn/?vnp_TxnRef=a', 'b', 'p', store));
  assert.equal(findPaymentReturn('a', {getItem:()=>'{invalid'}, 0), null);
});
test('bounds retained redirects and stores only identifiers and expiry', () => {
  const store = storage();
  for (let i=0;i<20;i++) rememberPaymentReturn(url(`attempt-${i}`), `booking-${i}`, `payment-${i}`, store, i);
  assert.equal(findPaymentReturn('attempt-0', store, 30), null);
  assert.deepEqual(Object.keys(findPaymentReturn('attempt-19', store, 30)).sort(), ['bookingId','expiresAt','paymentId','txnRef']);
});
