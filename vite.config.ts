import {defineConfig} from "vite";
import {cloudflare} from "@cloudflare/vite-plugin";

// Cloudflare Vite plugin v2 beta reads cloudflare.config.ts. The Worker
// provides the online API, while GitHub Pages continues to serve static UI.
export default defineConfig({
 plugins:[cloudflare()],
 server:{host:'127.0.0.1',port:8787,strictPort:true}
});
