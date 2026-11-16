# Public-release privacy boundary

The live GitHub Pages application publishes building geometry and community information. It has no resident accounts, service credentials, invite secrets, resident contact list or occupancy dataset.

## Implemented

- No analytics, advertising, map-tile requests, location permissions, camera or microphone access.
- No cookies or browser storage created by application code.
- Correction forms and event planning forms stay in memory, then download a user-controlled file.
- External source links use `noopener` and open only after a visitor selects them.
- No individual source-map room records or resident-to-room associations are published. Aggregate counts are research observations. The separate House 55 sketch study contains temporary geometry labels and explicit estimates, with no physical room numbers or occupancy claims.
- Private-looking actions explain the missing secure service. Client-side UI hiding is never described as authentication.

GitHub and the visitor's network providers can still receive ordinary hosting request data. Outbound source links follow their destination's policies. Calendar and correction downloads contain the text entered by their creator; sharing a downloaded file shares that text.

## Before a resident pilot

Implement and test the architecture's server-side permissions. In particular:

1. Expired or revoked members must fail direct API reads and writes even with an old valid authentication token.
2. Role grants must be scoped to named buildings or clubs, and expire independently.
3. Invite secrets must never enter public JSON, static HTML, source maps, frontend environment variables or public calendar feeds.
4. Profiles must default to hidden. Physical room associations must be separately authorized.
5. Block/report/abuse handling and a responsible moderation team must exist before direct communications are enabled.
6. Former-resident WhatsApp removal requires group-admin action; revoking Rommelweb access cannot retract already copied links or remove consumer WhatsApp memberships.

This checklist documents a release boundary. It does not represent a completed security assessment of an unimplemented backend.
