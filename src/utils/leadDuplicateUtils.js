// utils/leadDuplicateUtils.js

const CONTACT_PLATFORMS = ['whatsapp', 'telegram', 'email', 'phone', 'twitter', 'instagram', 'facebook'];

/**
 * Extracts all { platform, handle } pairs from a contactDetails object.
 * Skips entries with no handle.
 */
export function extractHandles(contactDetails = {}) {
  const handles = [];
  for (const platform of CONTACT_PLATFORMS) {
    const entries = contactDetails[platform] || [];
    for (const entry of entries) {
      if (entry.handle?.trim()) {
        handles.push({ platform, handle: entry.handle.trim().toLowerCase() });
      }
    }
  }
  return handles;
}

/**
 * Builds a MongoDB $or query to find any lead that shares at least one handle.
 * Returns null if no handles to match on.
 */
export function buildDuplicateQuery(contactDetails, businessId) {
  const handles = extractHandles(contactDetails);
  if (!handles.length) return null;

  const orClauses = handles.map(({ platform, handle }) => ({
    [`contactDetails.${platform}`]: {
      $elemMatch: { handle: { $regex: `^${handle}$`, $options: 'i' } }
    }
  }));

  return { business: businessId, $or: orClauses };
}

/**
 * Merges incoming contactDetails into existing without losing data or creating dupes.
 * Deduplication key: platform + handle (case-insensitive).
 */
export function mergeContactDetails(existing = {}, incoming = {}) {
  const merged = {};

  for (const platform of CONTACT_PLATFORMS) {
    const existingEntries = existing[platform] || [];
    const incomingEntries = incoming[platform] || [];

    // Build a map of existing entries keyed by lowercased handle
    const seen = new Map();
    for (const entry of existingEntries) {
      const key = entry.handle?.trim().toLowerCase() || `__nohandle_${Math.random()}`;
      seen.set(key, { ...entry });
    }

    // Merge incoming — update metadata/label/isPrimary if handle exists, else add new
    for (const entry of incomingEntries) {
      const key = entry.handle?.trim().toLowerCase();
      if (key && seen.has(key)) {
        // Update non-destructively: only overwrite if incoming has a value
        const existing = seen.get(key);
        seen.set(key, {
          ...existing,
          label: entry.label || existing.label,
          isPrimary: entry.isPrimary ?? existing.isPrimary,
          metadata: { ...existing.metadata, ...entry.metadata },
        });
      } else {
        const fallbackKey = key || `__nohandle_${Math.random()}`;
        seen.set(fallbackKey, { ...entry });
      }
    }

    merged[platform] = Array.from(seen.values());
  }

  return merged;
}

/**
 * Figures out which handles caused the match (for error reporting).
 */
export function findMatchedHandles(contactDetails, existingLead) {
  const incomingHandles = extractHandles(contactDetails);
  const existingHandles = extractHandles(existingLead.contactDetails?.toObject?.() || existingLead.contactDetails || {});

  const existingSet = new Set(existingHandles.map(h => `${h.platform}:${h.handle}`));
  return incomingHandles
    .filter(h => existingSet.has(`${h.platform}:${h.handle}`))
    .map(h => `${h.platform}:${h.handle}`);
}