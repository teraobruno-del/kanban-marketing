// "Supabase de mentirinha" para testes locais no navegador (e2e).
// Imita só o necessário: login (Auth) e arquivos (Storage). Não roda em produção.
import http from "node:http";
import { randomUUID } from "node:crypto";

const users = new Map(); // id -> { id, email, password, banned }
const buckets = new Set();
const objects = new Map(); // "bucket/path" -> { bytes: Buffer, contentType }
const uploadTokens = new Map(); // token -> "bucket/path"

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (u) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: {}, identities: [], created_at: new Date().toISOString() });
const session = (u) => ({ access_token: jwt(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-" + u.id, user: userJson(u) });
const fromToken = (req) => {
  const t = (req.headers.authorization ?? "").replace("Bearer ", "");
  try { return users.get(JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).sub); } catch { return undefined; }
};

/** Extrai o arquivo de um corpo multipart (FormData enviado pelo navegador). */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  if (!m) return { bytes: buf, contentType: contentType || "application/octet-stream" };
  const boundary = Buffer.from(`--${m[1] ?? m[2]}`);
  let pos = 0;
  while ((pos = buf.indexOf(boundary, pos)) !== -1) {
    const start = pos + boundary.length + 2; // \r\n
    const next = buf.indexOf(boundary, start);
    if (next === -1) break;
    const part = buf.subarray(start, next - 2);
    const sep = part.indexOf("\r\n\r\n");
    const headers = part.subarray(0, sep).toString();
    if (/filename=/i.test(headers)) {
      const ct = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1] ?? "application/octet-stream";
      return { bytes: part.subarray(sep + 4), contentType: ct };
    }
    pos = next;
  }
  return { bytes: Buffer.alloc(0), contentType: "application/octet-stream" };
}

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json", ...cors }); res.end(JSON.stringify(obj)); };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const json = () => { try { return raw.length ? JSON.parse(raw.toString()) : {}; } catch { return {}; } };

  // ── Auth ──
  if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
    const d = json();
    const u = [...users.values()].find((x) => x.email === d.email && x.password === d.password && !x.banned);
    return u ? send(200, session(u)) : send(400, { error: "invalid_grant", code: "invalid_credentials", msg: "Invalid login credentials" });
  }
  if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
    const u = users.get(String(json().refresh_token).slice(2));
    return u ? send(200, session(u)) : send(400, { error: "invalid_grant" });
  }
  if (p === "/auth/v1/user" && req.method === "GET") { const u = fromToken(req); return u && !u.banned ? send(200, userJson(u)) : send(401, { msg: "invalid" }); }
  if (p === "/auth/v1/user" && req.method === "PUT") { const u = fromToken(req); if (!u) return send(401, {}); const d = json(); if (d.password) u.password = d.password; return send(200, userJson(u)); }
  if (p === "/auth/v1/recover" && req.method === "POST") { console.log("recover:", json().email); return send(200, {}); }
  if (p === "/auth/v1/logout") { res.writeHead(204, cors); return res.end(); }
  if (p === "/auth/v1/admin/users" && req.method === "POST") {
    const d = json();
    if ([...users.values()].some((x) => x.email === d.email)) return send(422, { msg: "A user with this email address has already been registered", code: "email_exists" });
    const u = { id: randomUUID(), email: d.email, password: d.password };
    users.set(u.id, u);
    return send(200, userJson(u));
  }
  if (p === "/auth/v1/admin/users" && req.method === "GET") return send(200, { users: [...users.values()].map(userJson), aud: "authenticated" });
  let m = p.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
  if (m) {
    const u = users.get(m[1]);
    if (!u) return send(404, { msg: "not found" });
    if (req.method === "DELETE") { users.delete(u.id); return send(200, {}); }
    if (req.method === "PUT") { const d = json(); if (d.password) u.password = d.password; if (d.email) u.email = d.email; if (d.ban_duration) u.banned = d.ban_duration !== "none"; return send(200, userJson(u)); }
  }

  // ── Storage ──
  if ((m = p.match(/^\/storage\/v1\/bucket\/([^/]+)$/)) && req.method === "GET") {
    return buckets.has(m[1]) ? send(200, { id: m[1], name: m[1], public: false }) : send(400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
  }
  if (p === "/storage/v1/bucket" && req.method === "POST") { const d = json(); buckets.add(d.id ?? d.name); return send(200, { name: d.id ?? d.name }); }
  if ((m = p.match(/^\/storage\/v1\/object\/upload\/sign\/([^/]+)\/(.+)$/))) {
    const key = `${m[1]}/${m[2]}`;
    if (req.method === "POST") {
      const token = randomUUID();
      uploadTokens.set(token, key);
      return send(200, { url: `/object/upload/sign/${m[1]}/${encodeURI(m[2])}?token=${token}` });
    }
    if (req.method === "PUT") {
      if (uploadTokens.get(url.searchParams.get("token")) !== key) return send(400, { message: "invalid token" });
      objects.set(key, parseMultipart(raw, req.headers["content-type"]));
      return send(200, { Key: key });
    }
  }
  if ((m = p.match(/^\/storage\/v1\/object\/info\/([^/]+)\/(.+)$/))) {
    const o = objects.get(`${m[1]}/${m[2]}`);
    return o ? send(200, { name: m[2], size: o.bytes.length, content_type: o.contentType }) : send(400, { statusCode: "404", message: "Object not found" });
  }
  if ((m = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)$/)) && req.method === "POST") {
    const d = json();
    return send(200, (d.paths ?? []).map((path) => ({ path, error: null, signedURL: `/object/sign/${m[1]}/${encodeURI(path)}?token=dl` })));
  }
  if ((m = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/))) {
    if (req.method === "POST") return send(200, { signedURL: `/object/sign/${m[1]}/${encodeURI(m[2])}?token=dl` });
    const o = objects.get(`${m[1]}/${m[2]}`);
    if (!o) return send(404, { message: "not found" });
    res.writeHead(200, { "content-type": o.contentType, ...cors });
    return res.end(o.bytes);
  }
  if ((m = p.match(/^\/storage\/v1\/object\/([^/]+)$/)) && req.method === "DELETE") {
    const removed = [];
    for (const path of json().prefixes ?? []) if (objects.delete(`${m[1]}/${path}`)) removed.push({ name: path });
    return send(200, removed);
  }
  send(404, { msg: `fake: não implementado ${req.method} ${p}` });
}).listen(54321, () => console.log("Supabase de mentirinha em http://localhost:54321"));
