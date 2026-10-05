/**
 * Room type photographs live in one Supabase Storage bucket; the room type
 * document keeps the object path and every page shows the public URL.
 *
 * The service-role key is read on the server only. Before a photograph is
 * accepted its type and size are checked here, not only in the browser.
 */
export class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

export function publicPhotoUrl(config, objectPath) {
  // A seeded room type may hold a whole address (the prototype's own
  // photographs); a photograph uploaded by staff holds the bucket path.
  if (/^https?:\/\//i.test(String(objectPath))) return objectPath;
  if (!config.photos.supabaseUrl) return objectPath;
  return `${config.photos.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${config.photos.bucket}/${objectPath}`;
}

export function checkPhoto({ contentType, byteLength }, config) {
  if (!config.photos.formats.includes(contentType)) {
    return 'Photographs must be JPEG, PNG or WebP.';
  }
  if (byteLength > config.photos.maxBytes) {
    return 'Each photograph must be no larger than 5 MB.';
  }
  return null;
}

/**
 * Upload one photograph and answer with the path stored on the room type.
 * A missing bucket configuration is a clear error, never a silent success.
 */
export async function uploadPhoto({ roomTypeId, filename, contentType, bytes }, config) {
  const { supabaseUrl, serviceRoleKey, bucket } = config.photos;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new StorageError('Room photographs are not connected yet: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server.');
  }
  const safeName = String(filename ?? 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  const objectPath = `${roomTypeId}/${Date.now()}-${safeName}`;
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!response.ok) {
    throw new StorageError(`The photograph could not be stored (${response.status}).`);
  }
  return objectPath;
}

export async function removePhoto(objectPath, config) {
  const { supabaseUrl, serviceRoleKey, bucket } = config.photos;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new StorageError('Room photographs are not connected yet: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server.');
  }
  await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceRoleKey}` },
  });
}
