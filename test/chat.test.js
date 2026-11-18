const test = require('node:test');
const assert = require('node:assert/strict');
const chatHandler = require('../api/chat');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    }
  };
}

test('rejects invalid chat input without calling Groq', async () => {
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('Fetch should not run for invalid input.');
  };

  try {
    const response = createResponse();
    await chatHandler({ method: 'POST', body: { message: ' ' } }, response);

    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /1-2000 karakter/);
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('sends validated chat history to the selected Groq model', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GROQ_API_KEY;
  let requestUrl;
  let requestOptions;
  process.env.GROQ_API_KEY = 'test-groq-key';
  global.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Jawaban tes.' } }] })
    };
  };

  try {
    const response = createResponse();
    await chatHandler({
      method: 'POST',
      body: {
        message: 'Apa kabar?',
        history: [{ role: 'model', text: 'Halo.' }]
      }
    }, response);

    const requestBody = JSON.parse(requestOptions.body);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { reply: 'Jawaban tes.' });
    assert.equal(requestUrl, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(requestBody.model, 'openai/gpt-oss-120b');
    assert.deepEqual(requestBody.messages.slice(-2), [
      { role: 'assistant', content: 'Halo.' },
      { role: 'user', content: 'Apa kabar?' }
    ]);
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalApiKey;
    }
  }
});
