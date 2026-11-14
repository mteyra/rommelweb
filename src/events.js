const escapeICS = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r/g, '');

/** Export a local planning draft. This never publishes an event or sends invites. */
export function calendarDraft(event, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
  const date = event.date.replaceAll('-', '') + 'T' + event.time.replace(':', '') + '00';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rommelweb//Local Draft//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT', `UID:${event.id}@rommelweb.local`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Berlin:${date}`, `DURATION:PT${event.duration}M`,
    `SUMMARY:${escapeICS(event.title)}`, `LOCATION:Erwin-Rommel-Straße ${escapeICS(event.house)}\\, Erlangen`,
    `DESCRIPTION:${escapeICS('LOCAL DRAFT — not published or confirmed.\n' + event.description)}`,
    'STATUS:TENTATIVE', 'CLASS:PRIVATE', 'END:VEVENT', 'END:VCALENDAR',
  ];
  const encoder = new TextEncoder();
  return lines.map(line => {
    let out = '', chunk = '', bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > 75) { out += chunk + '\r\n '; chunk = ''; bytes = 1; }
      chunk += char;
      bytes += size;
    }
    return out + chunk;
  }).join('\r\n') + '\r\n';
}

/** Local date/time strings are all interpreted in Europe/Berlin. */
export function orderedDrafts(events) {
  return [...events].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.id.localeCompare(b.id));
}
