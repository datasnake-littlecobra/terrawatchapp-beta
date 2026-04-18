import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.datasnake.terrawatch',
  appName: 'TerraWatch',
  webDir: 'dist',
  backgroundColor: '#0B1220',
  android: { allowMixedContent: false },
  ios: { contentInset: 'always' },
}

export default config
