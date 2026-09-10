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
    hostId: "AKfycbwytXb33k1qFxppC6VF_HJhHfg9TrQ4vUNSWFFrzlN-_-OMfaA1lSfjC5YUt-8viMvo",
    courtflowHostId: "AKfycbx_LtOWLocI6-J_apimSsoVrHSS3Mc419OnGnYlnz5e6nf4gCYacOMbxcrpILCDdjRyfg"
  },
  "demo": {
    name: "FixtureFlow Demo Sandbox",
    shortName: "Demo",
    aliases: ["sandbox", "public-demo", "trial"],
    hostId: "AKfycbxdmhLfWcTUa104_q2d_-zmRUrk2Dm8hdNnFND6wlfXFpaRFn3zo95lUJsP56wag9vR5Q",
    courtflowHostId: "AKfycbxJ2UiRljaXyPOKHXMJKuZGMtWs7G1dI4LKnEFsWT0qlXVdQb4M-1cWN4tWDVANjAYi"
  },
  "dev": {
    name: "Development / Staging",
    shortName: "Dev",
    aliases: ["test", "local"],
    hostId: "AKfycbyBNsvDMn81v0WQoYO1Hm0xt6t6wUDH-iBvnwH0RgEVzi_magEqZxtO_Nk4aZUiQ6ys6Q",
    courtflowHostId: "AKfycbyYadCqcW4iMp5QZcsTu74lhJJz8zL_ba65SKxMWZ7ycpaDsWBYYCbm2ocqH_gsCXl1"
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

  // 3. Fallback: Raw Google Apps Script deployment hash (strictly validated format)
  const trimmed = input.trim();
  if (/^AKfy[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return {
      slug: 'custom',
      name: 'Custom Club',
      shortName: 'Club',
      hostId: trimmed
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

  // 3. Fallback: Raw Google Apps Script deployment hash (strictly validated format)
  const trimmedCf = input.trim();
  if (/^AKfy[a-zA-Z0-9_-]{20,}$/.test(trimmedCf)) {
    return {
      slug: 'custom',
      name: 'Custom Club',
      shortName: 'Club',
      hostId: trimmedCf
    };
  }

  return null;
}
