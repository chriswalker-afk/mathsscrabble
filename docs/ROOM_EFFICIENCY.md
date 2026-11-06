# Room service traffic and Cloudflare usage

The static site stays on GitHub Pages. **Sector Run, The Drift and Local Match do not call Cloudflare at all**. Only Online Rooms uses the `equanova-rooms` Worker at `rooms.mrwalkermaths.com`.

## Traffic policy

- Use one hibernating WebSocket per connected online player. The Durable Object broadcasts only room *revision numbers* when a room changes, never private tiles or keys.
- Only fetch an authenticated `/state` snapshot when a new revision is announced, a player explicitly reconnects, or the tab becomes visible again. There is **no periodic HTTP polling while the WebSocket is healthy**.
- If disconnected, use a single 30-second **visible-tab-only** polling fallback. Socket retries back off from 2.5 seconds to a maximum of 60 seconds, avoiding repeated attempts from background tabs.
- A reconnection sends the current room revision immediately; it does not need an unconditional second HTTP snapshot if that revision is already known.
- Coalesce repeated revision notifications and requests while an action or snapshot is in flight. No score changes or tile moves are uploaded before a player commits a turn.
- Let Durable Objects hibernate when idle. The server uses alarms only for room expiration and authoritative turn deadlines; it does not keep room objects awake with heartbeats.
- Keep local and online racks private. Do **not** cache authenticated room snapshots or tokens publicly. HTTP responses use `Cache-Control: no-store`.
- Room data has a limited lifetime rather than storing permanent classroom histories. The browser contains no long-term server session.

## Request comparison

The old seven-second poll would make roughly **514 HTTP snapshot requests per connected player per hour**, including while the WebSocket was healthy. The new 30-second fallback would make at most **120 snapshot requests per visible player per hour** during disconnection. During a healthy WebSocket connection, there are **no automatic periodic snapshots**; requests occur only for room actions and changes. WebSocket opening/connecting and mutations still count as server activity.

The benefit is substantial in normal classroom use, but **nothing can guarantee unlimited free Cloudflare usage**. Cloudflare documents a Workers Free daily allocation of 100,000 Worker requests (resetting at midnight UTC); Durable Objects also have independent usage restrictions and pricing. The limit applies across the account, not as a separate allocation for this game.

References: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Object hibernating WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## Monitoring and safeguards

1. In Cloudflare, open **Workers & Pages → equanova-rooms → Metrics**. Monitor daily requests, error rates, CPU time and Durable Object usage (including storage and active duration).
2. Monitor unusual spikes in `POST /api/rooms` and `POST /api/rooms/:code/join`. Before inviting broad public traffic, consider Cloudflare WAF/rate limiting or Turnstile for those **room creation/join** endpoints. The origin allow-list is a browser restriction, not bot protection.
3. After each server deployment, check [room API health](https://rooms.mrwalkermaths.com/api/health) and run the two-device smoke tests in [ONLINE_MULTIPLAYER.md](ONLINE_MULTIPLAYER.md).
4. If capacity approaches a daily limit, inspect actual traffic before changing polling intervals or Cloudflare plans. Offline/local modes remain playable independently of the room service.

## Rack and board invariants

All modes draw **five number-kind and three operator-kind tiles** from separate logical supply pools. The generic `✦` wildcard is allocated to the number pool; `#` is number-kind and `◇` operator-kind. The physical inventory stays at 151 tiles. When either pool is exhausted, do not fabricate or substitute tiles from the other pool. Once each turn, the player may exchange exactly one physical rack tile for free from its own pool; further or multiple exchanges cost a turn. The 13×13 board's premium squares are eight-way symmetric around the centre in every mode.
