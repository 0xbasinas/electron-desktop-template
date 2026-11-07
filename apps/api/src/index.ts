import { createApp } from './app'

export type { AppType } from './app'
export type { Bindings } from './env'

// The Worker. Static files of the web app are served by Cloudflare without running this code (see wrangler.jsonc).
export default createApp()
