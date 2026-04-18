export const en = {
  app: {
    tagline: "Know the ground you're on.",
  },
  nav: {
    home: 'Home',
    explore: 'Explore',
    travel: 'Travel',
    alerts: 'Alerts',
    more: 'More',
  },
  safety: {
    title: 'Safety near you',
    locating: 'Finding your location…',
    locationDenied: 'Location access denied. Set a location manually in Settings.',
    band: { safe: 'Clear', caution: 'Stay aware', danger: 'Take care' } as const,
    cta: 'See details',
    reasonsHeader: "Here's why",
  },
  explore: {
    title: 'What is happening nearby',
    openFull: 'Open full map',
  },
  guidance: {
    title: 'What to do',
    planTrip: 'Plan a trip',
    planTripBody: 'Check seismic, weather, KP, and tides before you go.',
    shelter: 'Shelter info',
    shelterBody: 'Find safe places near you in an emergency.',
    subscribe: 'Subscribe to alerts',
    subscribeBody: "Get a push when conditions change where you are.",
  },
  travel: {
    title: 'Travel advisory',
    destinationLabel: 'Destination',
    destinationPlaceholder: 'City, region, or landmark',
    startLabel: 'Start date',
    endLabel: 'End date',
    styleLabel: 'Trip type',
    styles: { urban: 'City', beach: 'Coastal', mountain: 'Mountain', general: 'General' } as const,
    submit: 'Check conditions',
    verdict: {
      go: 'Good to go',
      caution: 'Proceed with caution',
      reconsider: 'Reconsider',
    },
    timeline: 'Risk by day',
    share: 'Share advisory',
    empty: 'Enter a destination and dates above.',
    geocodeFailed: "We couldn't find that place. Try a broader name.",
  },
  fundraiser: {
    title: 'Support DataSnake',
    body: "We're building a proprietary ground and underwater sensor network. Help us put the next nodes in the ground.",
    cta: 'Learn more',
  },
  common: {
    loading: 'Loading…',
    error: "Something went wrong. We'll keep trying.",
    retry: 'Try again',
    km: 'km',
    hours: 'h',
  },
}

export type I18n = typeof en
