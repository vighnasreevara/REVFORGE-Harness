#!/usr/bin/env node
/**
 * REVFORGE provider-egress allowlist proxy (BMad LIVE runs).
 *
 * usage: node egress-proxy.mjs --socket PATH --log FILE [--allow HOST:PORT]...
 *                              [--max-tunnels N] [--idle-ms N] [--max-bytes N] [--pid-file FILE]
 *
 * Runs inside WSL / Linux, OUTSIDE the sandbox namespaces. It listens only on
 * a Unix domain socket (mode 600; never on TCP). The sandbox bind-mounts that
 * one socket into its new root, and a socat bridge inside the sandbox's own
 * network namespace exposes it as 127.0.0.1:3128. That is the only route out.
 *
 * Policy (default deny):
 *   - only `CONNECT host:port HTTP/1.x` is accepted; every other method is
 *     answered 405 and plain HTTP is never forwarded;
 *   - host:port must be an exact entry of the allowlist. The default allowlist
 *     is exactly api.anthropic.com:443; extra entries only via --allow;
 *   - anything else (other host, other port, IP literal, malformed or
 *     oversized request head, header timeout) is answered 4xx and closed
 *     before any name is resolved or any connection is opened;
 *   - limits: maximum concurrent tunnels, idle timeout per tunnel, optional
 *     maximum total bytes for the life of the proxy.
 * One JSON line per decision is appended to the log: time, host, port,
 * decision, status, reason, bytes up/down and duration. Request headers and
 * payload are never logged. TLS is end to end between the client and the
 * provider: the proxy sees the destination name and byte counts only.
 *
 * `decide()` is a pure function (no sockets) so the policy can be tested
 * anywhere. No dependencies beyond Node's standard library.
 */
import fs from 'node:fs';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

export const DEFAULT_ALLOWLIST = Object.freeze(['api.anthropic.com:443']);
export const DEFAULT_LIMITS = Object.freeze({ maxTunnels: 8, idleMs: 120000, headerTimeoutMs: 10000, maxHeaderBytes: 8192, maxTotalBytes: null });

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOST_RE = new RegExp(`^(?=.{1,253}$)${LABEL}(?:\\.${LABEL})+$`);
const STATUS_TEXT = { 200: 'Connection Established', 400: 'Bad Request', 403: 'Forbidden', 405: 'Method Not Allowed', 408: 'Request Timeout', 431: 'Request Header Fields Too Large', 502: 'Bad Gateway', 503: 'Service Unavailable' };

/** Parses one allowlist entry "host:port" (a DNS name, lower case, no wildcard, no IP literal). Throws if invalid. */
export function parseAllowEntry(entry) {
  const m = /^([^:\s]+):(\d{1,5})$/.exec(String(entry ?? '').trim());
  if (!m) throw new Error(`invalid allowlist entry ${JSON.stringify(entry)}: expected host:port`);
  const host = m[1].toLowerCase();
  const port = Number(m[2]);
  if (!HOST_RE.test(host) || /^[0-9.]+$/.test(host)) throw new Error(`invalid allowlist host ${JSON.stringify(m[1])}: a fully qualified DNS name is required (no wildcard, no IP literal)`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid allowlist port ${m[2]}`);
  return { host, port, key: `${host}:${port}` };
}

/** The effective allowlist: the default plus explicit extra entries, normalised and de-duplicated. */
export function buildAllowlist(extra = []) {
  return [...new Set([...DEFAULT_ALLOWLIST, ...extra].map((e) => parseAllowEntry(e).key))];
}

/**
 * The request decision. `head` is the request head without the final CRLFCRLF.
 * `state` = { allowlist, active, totalBytes, limits }. Returns
 * { allow, status, reason, method, host, port }; host/port are null unless a
 * well-formed CONNECT target was given. Pure: no I/O, no DNS.
 */
export function decide(head, state = {}) {
  const allowlist = state.allowlist ?? DEFAULT_ALLOWLIST;
  const limits = { ...DEFAULT_LIMITS, ...(state.limits ?? {}) };
  const deny = (status, reason, method = null, host = null, port = null) => ({ allow: false, status, reason, method, host, port });
  if (typeof head !== 'string' || !head.length) return deny(400, 'empty request');
  if (Buffer.byteLength(head, 'latin1') > limits.maxHeaderBytes) return deny(431, 'request head too large');
  if (/[^\x20-\x7e\r\n\t]/.test(head)) return deny(400, 'malformed request: non-printable bytes');
  const lines = head.split('\r\n');
  if (lines.some((l) => /[\r\n]/.test(l))) return deny(400, 'malformed request: bare CR or LF');
  const rl = /^([A-Z]{1,16}) (\S+) HTTP\/1\.[01]$/.exec(lines[0]);
  if (!rl) return deny(400, 'malformed request line');
  const method = rl[1];
  for (const h of lines.slice(1)) if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+:[ \t]*[^\r\n]*$/.test(h)) return deny(400, 'malformed header line', method);
  if (method !== 'CONNECT') return deny(405, 'only CONNECT is allowed; plain HTTP is never forwarded', method);
  const t = /^([A-Za-z0-9.-]{1,253}):(\d{1,5})$/.exec(rl[2]);
  if (!t) return deny(400, 'malformed CONNECT target (expected host:port)', method);
  const host = t[1].toLowerCase();
  const port = Number(t[2]);
  if (port < 1 || port > 65535) return deny(400, 'invalid port', method, host, port);
  if (!allowlist.includes(`${host}:${port}`)) return deny(403, 'destination not on the allowlist', method, host, port);
  if ((state.active ?? 0) >= limits.maxTunnels) return deny(503, 'concurrent tunnel limit reached', method, host, port);
  if (limits.maxTotalBytes != null && (state.totalBytes ?? 0) >= limits.maxTotalBytes) return deny(503, 'total byte budget exhausted', method, host, port);
  return { allow: true, status: 200, reason: 'allowlisted', method, host, port };
}

/** Formats the one-line response for a status (no body, always closes for refusals). */
export function responseFor(status) {
  return status === 200 ? 'HTTP/1.1 200 Connection Established\r\n\r\n' : `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'Error'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`;
}

/**
 * Creates the proxy server (not yet listening). `connect` is injectable for tests.
 * Returns { server, stats }.
 */
export function createProxy({ logPath, allowlist = DEFAULT_ALLOWLIST, limits = {}, connect = (o) => net.connect(o), now = () => Date.now() }) {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const stats = { active: 0, totalBytes: 0, allowed: 0, denied: 0 };
  const log = (entry) => {
    try {
      fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', { mode: 0o600 });
    } catch {
      /* a log failure never opens anything; the decision already happened */
    }
  };
  const server = net.createServer({ allowHalfOpen: false }, (client) => {
    const started = now();
    let buf = Buffer.alloc(0);
    let decided = false;
    client.on('error', () => undefined);
    const refuse = (d) => {
      decided = true;
      stats.denied++;
      log({ time: new Date().toISOString(), host: d.host, port: d.port, method: d.method, decision: 'denied', status: d.status, reason: d.reason, bytes_up: 0, bytes_down: 0, duration_ms: now() - started });
      client.end(responseFor(d.status));
      client.destroySoon?.();
      setTimeout(() => client.destroy(), 1000).unref();
    };
    client.setTimeout(L.headerTimeoutMs, () => {
      if (!decided) refuse({ status: 408, reason: 'request head timeout', method: null, host: null, port: null });
      else client.destroy();
    });
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) {
        if (buf.length > L.maxHeaderBytes) {
          client.off('data', onData);
          refuse({ status: 431, reason: 'request head too large', method: null, host: null, port: null });
        }
        return;
      }
      client.off('data', onData);
      client.pause();
      const head = buf.subarray(0, idx).toString('latin1');
      const rest = buf.subarray(idx + 4);
      const d = decide(head, { allowlist, active: stats.active, totalBytes: stats.totalBytes, limits: L });
      if (!d.allow) return refuse(d);
      decided = true;
      tunnel(client, d, rest, started);
    };
    client.on('data', onData);
    client.on('end', () => {
      if (!decided) refuse({ status: 400, reason: 'connection closed before a complete request head', method: null, host: null, port: null });
    });
  });

  function tunnel(client, d, rest, started) {
    stats.active++;
    let up = 0;
    let down = 0;
    let connected = false;
    let done = false;
    let endReason = 'closed';
    const upstream = connect({ host: d.host, port: d.port });
    const finish = () => {
      if (done) return;
      done = true;
      stats.active--;
      if (connected) stats.allowed++;
      else stats.denied++;
      log({ time: new Date().toISOString(), host: d.host, port: d.port, method: 'CONNECT', decision: connected ? 'allowed' : 'denied', status: connected ? 200 : 502, reason: connected ? `allowlisted; tunnel ${endReason}` : `allowlisted, but the upstream connection failed (${endReason})`, bytes_up: up, bytes_down: down, duration_ms: now() - started });
      client.destroy();
      upstream.destroy();
    };
    const budget = (n) => {
      stats.totalBytes += n;
      if (L.maxTotalBytes != null && stats.totalBytes > L.maxTotalBytes) {
        endReason = 'closed: total byte budget exhausted';
        finish();
        return false;
      }
      return true;
    };
    client.on('close', finish);
    upstream.on('close', finish);
    upstream.on('error', (e) => {
      endReason = connected ? `upstream error ${e.code ?? ''}`.trim() : `${e.code ?? 'error'}`;
      if (!connected && !client.destroyed) client.end(responseFor(502));
      finish();
    });
    client.on('error', () => {
      endReason = 'client error';
      finish();
    });
    upstream.on('connect', () => {
      connected = true;
      client.setTimeout(L.idleMs, () => {
        endReason = 'closed: idle timeout';
        finish();
      });
      upstream.setTimeout(L.idleMs, () => {
        endReason = 'closed: idle timeout';
        finish();
      });
      client.write(responseFor(200));
      if (rest.length) {
        up += rest.length;
        if (!budget(rest.length)) return;
        upstream.write(rest);
      }
      client.on('data', (c) => {
        up += c.length;
        if (budget(c.length) && !upstream.write(c)) {
          client.pause();
          upstream.once('drain', () => client.resume());
        }
      });
      upstream.on('data', (c) => {
        down += c.length;
        if (budget(c.length) && !client.write(c)) {
          upstream.pause();
          client.once('drain', () => upstream.resume());
        }
      });
      client.on('end', () => upstream.end());
      upstream.on('end', () => client.end());
      client.resume();
    });
  }
  return { server, stats };
}

/** Parses the command line. Throws on anything unknown or missing. */
export function parseArgs(argv) {
  const o = { socket: null, log: null, allow: [], pidFile: null, limits: {} };
  const num = (k, v) => {
    if (!/^\d+$/.test(v ?? '')) throw new Error(`${k} needs a positive integer`);
    return Number(v);
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--socket') o.socket = v;
    else if (k === '--log') o.log = v;
    else if (k === '--allow') o.allow.push(v);
    else if (k === '--pid-file') o.pidFile = v;
    else if (k === '--max-tunnels') o.limits.maxTunnels = num(k, v);
    else if (k === '--idle-ms') o.limits.idleMs = num(k, v);
    else if (k === '--max-bytes') o.limits.maxTotalBytes = num(k, v);
    else throw new Error(`unknown argument ${k}`);
    i++;
  }
  if (!o.socket || !o.socket.startsWith('/')) throw new Error('--socket needs an absolute path');
  if (!o.log || !o.log.startsWith('/')) throw new Error('--log needs an absolute path');
  return o;
}

export function main(argv) {
  let o;
  try {
    o = parseArgs(argv);
    o.allowlist = buildAllowlist(o.allow);
  } catch (e) {
    process.stderr.write(`egress-proxy: ${e.message}\n`);
    process.exit(64);
  }
  if (fs.existsSync(o.socket)) {
    process.stderr.write(`egress-proxy: ${o.socket} already exists; refusing to reuse it\n`);
    process.exit(65);
  }
  process.umask(0o077);
  const { server } = createProxy({ logPath: o.log, allowlist: o.allowlist, limits: o.limits });
  const stop = () => {
    server.close();
    try {
      fs.unlinkSync(o.socket);
    } catch {
      /* already gone */
    }
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  server.on('error', (e) => {
    process.stderr.write(`egress-proxy: ${e.message}\n`);
    process.exit(70);
  });
  server.listen(o.socket, () => {
    fs.chmodSync(o.socket, 0o600);
    if (o.pidFile) fs.writeFileSync(o.pidFile, `${process.pid}\n`, { mode: 0o600 });
    process.stdout.write(`REVFORGE_EGRESS_LISTENING ${o.socket} allow=${o.allowlist.join(',')}\n`);
  });
}

const invoked = (() => {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (invoked) main(process.argv.slice(2));
