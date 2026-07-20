/**
 * driveResolver.ts
 * Sovereign Media Engine - Google Drive Bypass
 * 
 * Takes a standard Google Drive sharing link or file ID and constructs a direct stream URL 
 * compatible with HTML5 <video> tags. 
 * WARNING: Requires the file to be "Anyone with the link can view".
 * For massive 4K files, it is recommended to use the backend /api/cinema/stream endpoint 
 * for proper HTTP Range Requests buffering, but this handles direct frontend-level resolution.
 */

export function extractDriveId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  
  // If it's already just a 33-char ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(urlOrId) && !urlOrId.includes('/')) {
    return urlOrId;
  }
  
  // Try to match standard URL patterns
  const match = urlOrId.match(/(?:d\/|id=)([a-zA-Z0-9_-]{20,})/);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

export function getDirectDriveStreamUrl(urlOrId: string): string | null {
  const fileId = extractDriveId(urlOrId);
  if (!fileId) return null;
  
  // Use the standard Google Drive API export endpoint which supports basic HTTP Range for smaller videos
  // NOTE: For files > 100MB, Google Drive will show a virus scan warning if not using an API Key.
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function generateSovereignDriveUrl(urlOrId: string): string | null {
   const fileId = extractDriveId(urlOrId);
   if (!fileId) return null;
   // Route through backend if we have a range-header optimized proxy (FastAPI)
   // For now, we point to the FastAPI endpoint which handles the Range headers directly from the source.
   return `https://api.vigilantitsolution.com/api/cinema/stream?drive_id=${fileId}`;
}
