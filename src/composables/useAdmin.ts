// TerraWatch — Phase 9.8: reactive isAdmin getter.
//
// Thin wrapper around the auth store's isAdmin state so views and route
// guards can read it without importing the full store. The actual
// fetching of `user_profiles.role` lives on the auth store (auth.ts).

import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useAdmin() {
  const auth = useAuthStore()
  return {
    isAdmin: computed(() => auth.isAdmin),
    adminLoaded: computed(() => auth.adminLoaded),
  }
}
