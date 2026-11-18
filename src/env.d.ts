/// <reference types="vite/client" />

// Injected by vite.config.ts `define` from package.json — lets the sidebar
// footer show which build is live, useful for confirming a deploy landed.
declare const __APP_VERSION__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}
