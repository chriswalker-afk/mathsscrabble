import {defineConfig, exports} from "cf/config";
import * as entrypoint from "./server/worker.js" with { type: "cf-worker" };

// Only the API is deployed. GitHub Pages continues to host the static UI.
// SQLite-backed Durable Objects coordinate each room.
// Use cf dev for local development and cf deploy to publish.
export default defineConfig({
 worker:{
  name:"equanova-rooms",
  entrypoint,
  compatibilityDate:"2026-11-01",
  exports:{GameRoom:exports.durableObject({storage:"sqlite"})}
 }
});
