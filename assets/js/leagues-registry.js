/**
 * Fixture Flow - Central Leagues Club Registry
 * 
 * Maps human-readable club slugs to Google Apps Script Web App Host IDs.
 * Enables clean PWA URLs (e.g. /leagues/player/?c=mount-pleasant).
 */

const CLUBS_REGISTRY = {
  "mount-pleasant": {
    name: "Mount Pleasant Badminton Club",
    shortName: "MP",
    aliases: ["mp", "mpbc", "mountpleasant", "mount_pleasant"],
    hostId: "AKfycbykF0uy5JkbSYIxY-dJVE9bdjcRZJ7pnX6zNdTikEalLF0cweGJ4es4j9R5HcxXRwGB",
    courtflowHostId: "AKfycbw9lPuih5TieELN_fnrT5mbtmAGoj-h18jiZEQdS2u3oVyw_P0uLpw8F69mPOLLMeVWSA"
  },
  "demo": {
    name: "FixtureFlow Demo Sandbox",
    shortName: "Demo",
    aliases: ["sandbox", "public-demo", "trial"],
    hostId: "AKfycbyu8_pzD00dxoGzd-Tc4kTlCuy7TPqaeVQ04paaL3AUQ0Fdjl4l5kOyfd6ysw71lAiM4A",
    courtflowHostId: "AKfycbxQTGKdHlwYXyYEaHFFW_wsLGNSMGAYV4wUHai69AA"
  },
  "dev": {
    name: "Development / Staging",
    shortName: "Dev",
    aliases: ["test", "local"],
    hostId: "AKfycbykF0uy5JkbSYIxY-dJVE9bdjcRZJ7pnX6zNdTikEalLF0cweGJ4es4j9R5HcxXRwGB",
    courtflowHostId: "AKfycbxQTGKdHlwYXyYEaHFFW_wsLGNSMGAYV4wUHai69AA"
  }
};

/**
 * Resolves a URL parameter (slug, alias, or raw hash) to a Leagues club record.
 * 
 * @param {string} input The query parameter value (e.g. "mount-pleasant", "mp", "AKfy...").
 * @returns {{ name: string, shortName: string, hostId: string, slug: string } | null} The resolved club or null if invalid.
 */
function resolveClubHost(input) {
  if (!input || typeof input !== 'string') return null;
  const normalized = input.trim().toLowerCase();

  // 1. Direct slug match
  if (CLUBS_REGISTRY[normalized]) {
    return {
      slug: normalized,
      name: CLUBS_REGISTRY[normalized].name,
      shortName: CLUBS_REGISTRY[normalized].shortName || normalized.toUpperCase(),
      hostId: CLUBS_REGISTRY[normalized].hostId
    };
  }

  // 2. Alias match
  for (const [slug, club] of Object.entries(CLUBS_REGISTRY)) {
    if (club.aliases && club.aliases.includes(normalized)) {
      return {
        slug: slug,
        name: club.name,
        shortName: club.shortName || slug.toUpperCase(),
        hostId: club.hostId
      };
    }
  }

  // 3. Fallback: Raw Google Apps Script deployment hash (e.g. starts with AKfy or is long hash)
  if (input.startsWith('AKfy') || input.length >= 25) {
    return {
      slug: 'custom',
      name: 'Custom Club',
      shortName: 'Club',
      hostId: input.trim()
    };
  }

  return null;
}

/**
 * Resolves a URL parameter (slug, alias, or raw hash) to a CourtFlow club record.
 * 
 * @param {string} input The query parameter value (e.g. "mount-pleasant", "mp", "AKfy...").
 * @returns {{ name: string, shortName: string, hostId: string, slug: string } | null} The resolved club or null if invalid.
 */
function resolveCourtflowHost(input) {
  if (!input || typeof input !== 'string') return null;
  const normalized = input.trim().toLowerCase();

  // 1. Direct slug match
  if (CLUBS_REGISTRY[normalized] && CLUBS_REGISTRY[normalized].courtflowHostId) {
    return {
      slug: normalized,
      name: CLUBS_REGISTRY[normalized].name,
      shortName: CLUBS_REGISTRY[normalized].shortName || normalized.toUpperCase(),
      hostId: CLUBS_REGISTRY[normalized].courtflowHostId
    };
  }

  // 2. Alias match
  for (const [slug, club] of Object.entries(CLUBS_REGISTRY)) {
    if (club.aliases && club.aliases.includes(normalized) && club.courtflowHostId) {
      return {
        slug: slug,
        name: club.name,
        shortName: club.shortName || slug.toUpperCase(),
        hostId: club.courtflowHostId
      };
    }
  }

  // 3. Fallback: Raw Google Apps Script deployment hash
  if (input.startsWith('AKfy') || input.length >= 25) {
    return {
      slug: 'custom',
      name: 'Custom Club',
      shortName: 'Club',
      hostId: input.trim()
    };
  }

  return null;
}
