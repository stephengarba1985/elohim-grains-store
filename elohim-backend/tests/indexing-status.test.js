const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

test('GET /api/indexing-status returns a healthy status payload', async () => {
  const server = app.listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/indexing-status`);
  const body = await response.json();

  server.close();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.status, 'healthy');
});
