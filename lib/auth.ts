const COOKIE = 'yg_admin';

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function adminToken() {
  const password = process.env.ADMIN_PASSWORD || 'yg-admin';
  return sha256Hex(`yg-site:${password}`);
}

export async function isValidAdminCookie(value: string | undefined) {
  if (!value) return false;
  return value === (await adminToken());
}

export { COOKIE as ADMIN_COOKIE };
