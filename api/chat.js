const MODEL = 'openai/gpt-oss-120b';
const SYSTEM_PROMPT = "Kamu adalah 'Sakera Ai', asisten virtual resmi untuk website KKNT Universitas Trunojoyo Madura di Desa Socah tahun 2026. Jawab pertanyaan tentang program kerja KKNT, anggota tim, pendidikan, budaya Madura, dan Desa Socah dengan bahasa Indonesia yang ramah, sopan, terstruktur, dan maksimal dua paragraf.";

function sendJson(res, status, body) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(body);
  }

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

module.exports = async function chatHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Metode request tidak didukung.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: 'Body request harus berupa JSON yang valid.' });
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { error: 'Body request tidak valid.' });
  }

  const { message, history = [] } = body;
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    return sendJson(res, 400, { error: 'Pesan harus berisi 1-2000 karakter.' });
  }

  if (!Array.isArray(history) || history.length > 10) {
    return sendJson(res, 400, { error: 'Riwayat percakapan tidak valid.' });
  }

  const messages = [];
  for (const entry of history) {
    if (
      !entry ||
      !['user', 'assistant', 'model'].includes(entry.role) ||
      typeof entry.text !== 'string' ||
      entry.text.length > 2000
    ) {
      return sendJson(res, 400, { error: 'Format riwayat percakapan tidak valid.' });
    }

    messages.push({
      role: entry.role === 'model' ? 'assistant' : entry.role,
      content: entry.text
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'GROQ_API_KEY belum dikonfigurasi.' });
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
          { role: 'user', content: message.trim() }
        ],
        max_completion_tokens: 1024
      }),
      signal: AbortSignal.timeout(25000)
    });

    const data = await groqResponse.json().catch(() => null);
    if (!groqResponse.ok) {
      const errorMessage = data?.error?.message;
      console.error(`Groq API returned HTTP ${groqResponse.status}.`);
      return sendJson(res, 502, {
        error: typeof errorMessage === 'string'
          ? errorMessage.slice(0, 400)
          : `Permintaan ke Groq gagal (HTTP ${groqResponse.status}).`
      });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      console.error('Groq API returned an empty or invalid response.');
      return sendJson(res, 502, { error: 'Groq tidak mengembalikan jawaban yang valid.' });
    }

    return sendJson(res, 200, { reply });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return sendJson(res, 504, { error: 'Permintaan ke Groq melewati batas waktu. Silakan coba lagi.' });
    }

    console.error('Groq chat request failed:', error.message);
    return sendJson(res, 502, { error: 'Tidak dapat menghubungi Groq. Silakan coba lagi.' });
  }
};
