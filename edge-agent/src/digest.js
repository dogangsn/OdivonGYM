'use strict';

/**
 * Minimal HTTP Digest (RFC 7616, MD5 / MD5-sess, qop=auth) istemcisi.
 * Cihazın challenge'ı hatırlanır; her istekte nonce sayacı artar. Sunucu
 * nonce'u reddederse (stale / 401) bir kez yeni challenge ile tekrar denenir.
 */

const crypto = require('node:crypto');

function md5(value) {
  return crypto.createHash('md5').update(value).digest('hex');
}

function parseChallenge(header) {
  if (!header || !/^digest\s/i.test(header)) return null;
  const params = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g;
  let match;
  while ((match = re.exec(header.slice(7))) !== null) {
    params[match[1].toLowerCase()] = match[2] !== undefined ? match[2] : match[3];
  }
  return params;
}

function buildAuthorization({ challenge, method, uri, username, password, nc, cnonce }) {
  const algorithm = (challenge.algorithm || 'MD5').toUpperCase();
  const qop = (challenge.qop || '')
    .split(',')
    .map((q) => q.trim())
    .find((q) => q === 'auth');
  const ncHex = nc.toString(16).padStart(8, '0');

  let ha1 = md5(`${username}:${challenge.realm}:${password}`);
  if (algorithm === 'MD5-SESS') ha1 = md5(`${ha1}:${challenge.nonce}:${cnonce}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);

  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`);
  if (challenge.opaque !== undefined) parts.push(`opaque="${challenge.opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${ncHex}`, `cnonce="${cnonce}"`);
  return `Digest ${parts.join(', ')}`;
}

class DigestClient {
  constructor({ baseUrl, username, password, timeoutMs = 5000, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.challenge = null;
    this.nc = 0;
  }

  async request(method, path, { body, headers = {} } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const reqHeaders = { ...headers };
      if (this.challenge) {
        this.nc += 1;
        reqHeaders.Authorization = buildAuthorization({
          challenge: this.challenge,
          method,
          uri: path,
          username: this.username,
          password: this.password,
          nc: this.nc,
          cnonce: crypto.randomBytes(8).toString('hex'),
        });
      }
      const res = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: reqHeaders,
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status !== 401) return res;

      const challenge = parseChallenge(res.headers.get('www-authenticate'));
      await res.arrayBuffer().catch(() => undefined);
      if (!challenge) return res;
      // Yeni (veya süresi dolmuş) nonce: bir kez yeni challenge ile tekrar dene.
      this.challenge = challenge;
      this.nc = 0;
    }
    throw new Error('Digest kimlik doğrulaması başarısız (kullanıcı adı / parola hatalı olabilir).');
  }
}

module.exports = { DigestClient, parseChallenge, buildAuthorization };
