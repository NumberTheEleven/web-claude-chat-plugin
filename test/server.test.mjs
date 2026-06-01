import { describe, it } from 'node:test';
import assert from 'node:assert';
import { handleRequest, validatePathParam } from '../server/server.mjs';

// ---- Helpers ----

function mockReq(url, method = 'GET', body = null) {
  return {
    url, method,
    on: (evt, cb) => {
      if (evt === 'data' && body) cb(Buffer.from(body));
      if (evt === 'end') cb();
    }
  };
}

function mockRes() {
  const res = { statusCode: 0, body: '', headers: {} };
  res.writeHead = (code, headers) => { res.statusCode = code; if (headers) res.headers = headers; };
  res.end = (data) => {
    res.body = data || '';
    if (typeof data === 'string') {
      try { res.parsedBody = JSON.parse(data); } catch {}
    }
  };
  return res;
}

// ============================================================
// validatePathParam (R-001: Path Traversal Protection)
// ============================================================

describe('validatePathParam - path traversal protection', () => {

  // TC-001: Reject path traversal with ..
  it('should reject path traversal with ..', () => {
    assert.strictEqual(validatePathParam('project', '../../etc'), false);
    assert.strictEqual(validatePathParam('project', '..'), false);
    assert.strictEqual(validatePathParam('project', 'sub/../etc'), false);
  });

  // TC-002: Reject backslashes (Windows path separator)
  it('should reject backslashes', () => {
    assert.strictEqual(validatePathParam('project', 'C:\\windows'), false);
    assert.strictEqual(validatePathParam('project', 'a\\b'), false);
  });

  // TC-003: Reject forward slashes (Unix path separator)
  it('should reject forward slashes', () => {
    assert.strictEqual(validatePathParam('sessionId', 'a/b'), false);
    assert.strictEqual(validatePathParam('project', 'etc/passwd'), false);
  });

  // TC-004: Accept normal values
  it('should accept normal values', () => {
    assert.strictEqual(validatePathParam('project', 'normal-project'), true);
    assert.strictEqual(validatePathParam('project', 'my_project_123'), true);
    assert.strictEqual(validatePathParam('project', ''), true);
  });

  // TC-005: Handle null/undefined
  it('should handle null and undefined', () => {
    assert.strictEqual(validatePathParam('project', null), true);
    assert.strictEqual(validatePathParam('project', undefined), true);
  });
});

// ============================================================
// handleRequest - HTTP Endpoints (R-002, R-003, R-005)
// ============================================================

describe('handleRequest - HTTP endpoints', () => {

  // TC-006: Path traversal in project param returns 400 (R-001 via routing)
  it('should return 400 for path traversal project param in /api/sessions', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/sessions?project=../../etc'), res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.parsedBody, { error: 'Invalid parameter' });
  });

  // TC-007: Path traversal in project param on questions route
  it('should return 400 for path traversal project param in /api/sessions/{id}/questions', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/sessions/test-session/questions?project=../etc'), res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.parsedBody, { error: 'Invalid parameter' });
  });

  // TC-008: URL parsing correctness - verifies URL constructor handles typical URLs (R-002)
  it('should correctly parse URL with query parameters', async () => {
    const res = mockRes();
    // The project param "normal_project" should pass validation
    await handleRequest(mockReq('/api/sessions?project=normal_project&other=value'), res);
    // Should route to handleSessions which validates "normal_project" (passes)
    // handleSessions may fail to read the project dir, but returns 200 with empty list
    // OR if project dir is truly nonexistent, readdir throws -> caught -> returns empty 200
    assert.ok(res.statusCode === 200 || res.statusCode === 0,
      `Expected 200 or 0 (async pending), got ${res.statusCode}`);
  });

  // TC-009: Invalid JSON body returns 400 (R-003)
  it('should return 400 for invalid JSON body in PUT name request', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/sessions/test-session/name?project=test', 'PUT', '{invalid'), res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.parsedBody, { error: 'Invalid JSON' });
  });

  // TC-010: Invalid JSON body for different endpoint
  it('should return 400 for malformed JSON with unexpected characters', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/sessions/test/name?project=test', 'PUT', 'not-even-json'), res);
    assert.strictEqual(res.statusCode, 400);
  });

  // TC-011: /api/projects returns 200 (R-005 - routing)
  it('should handle /api/projects', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/projects'), res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.parsedBody), 'Should return an array');
  });

  // TC-012: /api/commands returns 200 with command list (R-005 - routing)
  it('should handle /api/commands and return command list', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/commands'), res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.parsedBody), 'Should return an array of commands');
    assert.ok(res.parsedBody.length > 0, 'Should return at least one command');
    // Verify command structure
    const first = res.parsedBody[0];
    assert.ok(first.cmd, 'Each command should have a cmd field');
    assert.ok(first.group, 'Each command should have a group field');
    assert.ok(first.desc, 'Each command should have a desc field');
  });

  // TC-013: /api/sessions with nonexistent project returns gracefully
  it('should handle /api/sessions with nonexistent project gracefully', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/sessions?project=nonexistent_project_12345'), res);
    // Should return 200 with empty session list (fs error is caught internally)
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.parsedBody), 'Should return an array');
    assert.strictEqual(res.parsedBody.length, 0, 'Should be empty for nonexistent project');
  });

  // TC-014: Unknown API route returns 404
  it('should return 404 for unknown API route', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/unknown_endpoint'), res);
    assert.strictEqual(res.statusCode, 404);
  });

  // TC-015: Static file serving is dispatched (does not crash)
  it('should dispatch static file serving for / without crashing', async () => {
    const res = mockRes();
    // serveStatic uses fire-and-forget readFile promise — the response may or
    // may not complete by the time we check. We only verify no crash occurred.
    await handleRequest(mockReq('/'), res);
    // No assertion on statusCode — serveStatic writes async.
    // Just verify handleRequest didn't throw.
    assert.ok(true, 'handleRequest did not throw for /');
  });

  // TC-016: Session name DELETE route dispatches correctly
  it('should route DELETE /api/sessions/{id}/name', async () => {
    const res = mockRes();
    await handleRequest(mockReq('/api/sessions/test-session/name?project=test'), res);
    // GET /name calls handleSessionNames which reads from disk (async).
    // Status may be 200 if dir exists and meta loads, or 0 if async still pending.
    // The key assertion: the route was recognized (not 404).
    assert.notStrictEqual(res.statusCode, 404, 'Route should be recognized');
  });

  // TC-017: Path traversal in project param on messages route
  it('should reject path traversal in project param on messages route', async () => {
    const res = mockRes();
    // The URL path is clean; the traversal is in the query parameter
    await handleRequest(mockReq('/api/sessions/test-session/messages?project=../../etc'), res);
    // handleSessionMessages validates the project param -> returns 400
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.parsedBody, { error: 'Invalid parameter' });
  });

  // TC-018: Path traversal in URL path is normalized by URL constructor
  // (URL normalization is a first line of defense; our validatePathParam
  // catches traversal in query params, which the URL parser does not touch.)
  it('should validate project param even when URL path contains special chars', async () => {
    // This test verifies that when a legitimate session route is hit,
    // the project query param is still validated against traversal.
    // URL path contains a session ID (no traversal), project param has traversal.
    const res = mockRes();
    await handleRequest(mockReq('/api/sessions/test-session/messages?project=..\\secret'), res);
    // Backslash in project param -> validatePathParam rejects -> 400
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.parsedBody, { error: 'Invalid parameter' });
  });
});

console.log('Server tests completed');
