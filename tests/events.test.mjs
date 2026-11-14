import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDraft, orderedDrafts } from '../src/events.js';

test('calendar drafts preserve Berlin wall time and cannot introduce extra ICS properties through text', () => {
  const event = { id: 'test', title: 'Kino, Küche; Abend\nBEGIN:VEVENT', date: '2026-12-08', time: '19:30', duration: '90', house: '55', description: 'Line one\nLine two; bring tea, cake\\coffee.' };
  const text = calendarDraft(event, new Date('2026-11-14T12:00:00Z')).replace(/\r\n /g, '');
  assert.match(text, /DTSTART;TZID=Europe\/Berlin:20261208T193000/);
  assert.match(text, /DTSTAMP:20261114T120000Z/);
  assert.match(text, /SUMMARY:Kino\\, Küche\\; Abend\\nBEGIN:VEVENT/);
  assert.equal(text.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  assert.match(text, /DESCRIPTION:LOCAL DRAFT — not published or confirmed\.\\nLine one\\nLine two\\; bring tea\\, cake\\\\coffee\./);
  assert.match(text, /STATUS:TENTATIVE\r\nCLASS:PRIVATE/);
  assert.doesNotMatch(text, /ATTENDEE|METHOD:REQUEST/);
});

test('long multilingual descriptions fold within 75 octets and unfold losslessly', () => {
  const description = 'Grüße 🌿 你好 '.repeat(80);
  const text = calendarDraft({ id: 'utf8', title: 'Meeting', date: '2026-10-25', time: '18:00', duration: '60', house: '51a', description });
  assert.ok(text.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75));
  assert.ok(text.replace(/\r\n /g, '').includes(description));
});

test('timeline sorting crosses dates and years without mutating local drafts', () => {
  const events = [
    { id: 'c', date: '2027-01-01', time: '08:00' },
    { id: 'b', date: '2026-12-31', time: '20:00' },
    { id: 'a', date: '2026-12-31', time: '09:00' },
  ];
  assert.deepEqual(orderedDrafts(events).map(event => event.id), ['a', 'b', 'c']);
  assert.deepEqual(events.map(event => event.id), ['c', 'b', 'a']);
});
