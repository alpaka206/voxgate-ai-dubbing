const BLOB_ACCESS = "public" as const;
const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
const allowedUploadContentTypes = ["audio/*", "video/*"];

function sanitizePathSegment(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  const trimmed = normalized.replace(/^_+|_+$/g, "");

  if (!trimmed) {
    return "upload";
  }

  return trimmed.slice(0, 120);
}

function getUserFolder(email: string) {
  return sanitizePathSegment(email.toLowerCase());
}

function createBlobPath(prefix: string, email: string, fileName: string) {
  const timestamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const safeFileName = sanitizePathSegment(fileName);

  return `${prefix}/${getUserFolder(email)}/${timestamp}-${suffix}-${safeFileName}`;
}

export function getBlobAccess() {
  return BLOB_ACCESS;
}

export function getAllowedUploadContentTypes() {
  return allowedUploadContentTypes;
}

export function shouldUseMultipartUpload(sizeBytes: number) {
  return sizeBytes >= MULTIPART_UPLOAD_THRESHOLD_BYTES;
}

export function buildUploadBlobPath(email: string, fileName: string) {
  return createBlobPath("uploads", email, fileName);
}

export function buildOutputBlobPath(email: string, fileName: string) {
  return createBlobPath("outputs", email, fileName);
}

export function isAllowedUploadPath(pathname: string, email: string) {
  return pathname.startsWith(`uploads/${getUserFolder(email)}/`);
}

export function getFileNameFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.at(-1) ?? "upload";
}
