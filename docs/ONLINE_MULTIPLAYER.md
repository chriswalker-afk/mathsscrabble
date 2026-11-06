# Pass E2 — Online Signal Clash

Online Rooms is the fourth EQUA//NOVA mode. From the existing ◈ MODE menu, open online.html. One player creates a room; one to three other pilots join with a six-character code or invitation link, each on their own device. The host sets a limit of two, three or four players and an optional 60-, 90- or 120-second timer (or Off). The host may begin once at least two pilots have joined.

## Rules and security

All turns are processed by a Cloudflare Worker and one SQLite-backed Durable Object per room. The browser cannot choose whose turn it is, award itself points, forge a tile, inspect another player's rack or change the timer. The server uses the same BIDMAS parser, premium squares, wildcards, finite bag, free equals and final rack penalties as Local Match.

- Room codes are six random readable characters, omitting ambiguous symbols such as 0, 1, I and O.
- Each pilot gets a private, random 32-byte access key at creation or joining. Its SHA-256 digest, rather than the key, is stored on the server.
- Each authenticated snapshot includes the shared board, room settings, public scores, aggregate remaining bag inventory and ONLY the requesting player's own rack. Other players' rack contents are never included.
- Host-controlled start, unique action IDs, revision checks and server validation prevent stale/double moves and incorrect score claims.
- Correct equations use the existing tile-by-tile score animation only AFTER the authoritative server awards points; wrong equations can be corrected without losing a turn.
- Automatic Durable Object alarms enforce timed turns even while no browsers are connected. A timeout cancels pending local placement and passes the turn.
- A match ends when a rack empties with the bag empty, or after two complete cycles without scoring. Remaining tile points are deducted; highest net score wins. Equal highest net scores tie.
- Room revisions are broadcast over hibernating WebSockets without secrets, tiles or personalised data. Clients fetch their own protected snapshot after each notification. Polling is a fallback.
- Room lifetime is six hours while waiting in the lobby, 24 hours of inactivity during play and six hours after finishing.
- Private access keys are stored in the player's browser storage for reload/reconnection. The invitation link includes only the room code, never the access key.

This is anonymous classroom play rather than account-backed identity. Anyone with a valid code may join an unfilled lobby, so avoid personally identifying nicknames. Do not copy private access keys. The Worker enforces known website origins, 8 KB JSON request limits, exact API routes and no-store responses. For broad public release, enable Cloudflare WAF/rate limiting or Turnstile for room creation and joining; this application does not claim that abuse protection is already provisioned.

## Deployment — required before the public website can create real rooms

GitHub Pages is a static website. The Cloudflare room Worker is a SEPARATE deployment and a PR does not publish it. The repository includes cloudflare.config.ts for the new Cloudflare CLI (cf), and exports the GameRoom SQLite Durable Object. There is deliberately no Wrangler configuration.

1. Install the Cloudflare CLI and sign in to the Cloudflare account responsible for mrwalkermaths.com:

   ~~~sh
   npm install --global cf
   cf auth login
   ~~~

2. From the merged repository root, validate the Worker build and deploy:

   ~~~sh
   cf deploy --dry-run
   cf deploy
   ~~~

3. In Cloudflare Workers & Pages, open the deployed equanova-rooms Worker. Add the custom domain rooms.mrwalkermaths.com in your mrwalkermaths.com zone and attach it directly to this Worker. It must serve /api/rooms and /api/health over HTTPS.
4. Visit https://rooms.mrwalkermaths.com/api/health and confirm the JSON response contains an ok value of true.
5. The existing frontend file src/online-config.js calls https://rooms.mrwalkermaths.com. If your deployed domain is different, update this file. server/worker.js has an exact browser origin allow-list: GitHub Pages, mathsscrabble.mrwalkermaths.com and scrabble.mrwalkermaths.com, plus local development; add any new frontend origin there.
6. Publish the static GitHub Pages branch containing online.html and its associated files, then perform the two-device checks below.

For local manual work: serve the static repo using python3 -m http.server 4173 and run cf dev for the Worker API on localhost port 8787. The frontend automatically uses http://127.0.0.1:8787 when opened via localhost. No Cloudflare API token, credential or player secret should be committed to GitHub.

## Testing

The Node suite exercises 2–4 player lobbies, authentication, private snapshots, malformed and forged moves, exact BIDMAS validation, idempotency, stale revisions, free and paid swaps, timer alarms, room expiry and final scores.

The Chromium test opens two isolated browser sessions against a simulated authoritative room API. It covers creation, joining, host starting, private racks, rejected equations, scoring animations, reconnecting after a refresh, passing, finishing and mobile controls. Existing Sector Run, Drift, bag-animation and Local Match tests remain enabled.

The automated browser test uses a simulated backend. It does not prove that a real Cloudflare Worker is deployed or configured correctly. A live post-deployment smoke test remains necessary.

### Live two-device checklist

1. Confirm the Worker health URL is reachable from another network.
2. Create a two-player room with a 60-second timer. Share the invitation URL and join from another browser/device.
3. Confirm that the two racks are different and private, and both clients see the same board and public scores.
4. Try a mathematically incorrect but well-formed equation; confirm no points or turns are consumed. Submit a correct BIDMAS equation and check that both boards update.
5. Refresh each device and verify that its rack and pilot identity are recovered without revealing an opponent's tiles.
6. Let a timer expire while the pages are closed; reopen them and verify the turn was advanced by the server alarm.
7. Exercise passing, free and paid exchanges, zero bag refill and final leftover-tile deductions.
8. Check phone/tablet accessibility and verify that the main commands remain visible without horizontal scrolling.

## Future work

The Origin whole-number tile set is still the only implemented mathematics pack. Polarity, Fraction Field and Quantum need separate mathematical tile/token design and rigorous parsing. Fully reusable Critter Lab avatar customization is also outside E2; online pilots currently have lightweight coloured markers. These are subsequent gameplay/visual passes, not prerequisites for online room correctness.
