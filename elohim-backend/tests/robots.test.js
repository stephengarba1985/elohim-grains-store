const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

test('GET /robots.txt returns the site policy', async () => {
  const server = app.listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/robots.txt`);
  const body = await response.text();

  server.close();

  assert.equal(response.status, 200);
  assert.match(body, /User-agent:\s*\*/i);
});
