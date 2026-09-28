'use strict';

/**
 * MainApi agent uçları için HTTPS istemcisi. Yalnızca giden istek atar.
 * Sözleşme: docs/access-agent-contract.md
 */

class MainApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  /** 401/403: agent iptal edilmiş veya kimlik geçersiz; tekrar denemek anlamsız. */
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

class MainApiClient {
  constructor({ baseUrl, agentId, token, timeoutMs = 15000, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.agentId = agentId;
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  static async enroll({ baseUrl, code, name, hostname, agentVersion, fetchImpl = fetch }) {
    const client = new MainApiClient({ baseUrl, fetchImpl });
    return client.call('POST', '/gym/access/agents/enroll', { code, name, hostname, agentVersion }, false);
  }

  getWork(limit = 50) {
    return this.call('GET', `/gym/access/agents/work?limit=${limit}`);
  }

  ack(itemId, body) {
    return this.call('POST', `/gym/access/agents/work/${encodeURIComponent(itemId)}/ack`, body);
  }

  sendEvents(events) {
    return this.call('POST', '/gym/access/agents/events/batch', { events });
  }

  heartbeat(body) {
    return this.call('POST', '/gym/access/agents/heartbeat', body);
  }

  async call(method, path, body, authenticated = true) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authenticated) headers.Authorization = `Agent ${this.agentId}.${this.token}`;

    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* JSON olmayan yanıt (ör. proxy hata sayfası) */
    }
    if (!res.ok) {
      const err = json?.error ?? {};
      throw new MainApiError(res.status, err.code ?? 'HTTP_ERROR', err.message ?? `MainApi HTTP ${res.status}`);
    }
    return json && typeof json === 'object' && 'data' in json ? json.data : json;
  }
}

module.exports = { MainApiClient, MainApiError };
