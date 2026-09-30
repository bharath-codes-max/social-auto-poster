// Minimal client for Buffer's GraphQL API (https://developers.buffer.com).
export class Enum { constructor(v) { this.v = v; } }
export const en = v => new Enum(v);

// JS value → GraphQL input literal (enums unquoted, strings JSON-escaped).
export function gql(v) {
  if (v instanceof Enum) return v.v;
  if (Array.isArray(v)) return `[${v.map(gql).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${k}: ${gql(x)}`).join(', ')} }`;
  return JSON.stringify(v);
}

export async function buffer(query) {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new Error('BUFFER_API_KEY is not set (put it in .env)');
  const r = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ query }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.errors) throw new Error(`Buffer API ${r.status}: ${JSON.stringify(body.errors || body).slice(0, 500)}`);
  return body.data;
}

export const createPostMutation = input => `mutation { createPost(input: ${gql(input)}) {
  ... on PostActionSuccess { post { id text } }
  ... on MutationError { message }
} }`;
