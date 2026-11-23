const maxPhotoSize = 3 * 1024 * 1024;
const fields = [
  ['name', 'Name', 120], ['email', 'Email', 254], ['phone', 'Phone', 30, true],
  ['propertyType', 'Property type', 120], ['unitCount', 'Units', 5, true],
  ['location', 'City or ZIP', 120], ['timeline', 'Timeline', 120],
  ['service', 'Service', 120], ['project', 'Project details', 3000],
];

function reply(status, message) {
  return Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isImage(type, bytes) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
  if (type === 'image/webp') {
    const text = new TextDecoder();
    return text.decode(bytes.subarray(0, 4)) === 'RIFF' && text.decode(bytes.subarray(8, 12)) === 'WEBP';
  }
  return false;
}

function encodePhoto(bytes) {
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return btoa(parts.join(''));
}

export async function onRequestPost({ request, env }) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return reply(403, 'Please submit from the Turning 4 Success website.');
  }
  if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) {
    return reply(415, 'Please use the quote request form.');
  }
  const limit = 5 * maxPhotoSize + 65536;
  if (!request.body || Number(request.headers.get('Content-Length')) > limit) {
    return reply(413, 'Your photos exceed the upload limit.');
  }
  const chunks = [];
  const reader = request.body.getReader();
  let size = 0;
  let data;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return reply(413, 'Your photos exceed the upload limit.');
      }
      chunks.push(value);
    }
    data = await new Response(new Blob(chunks), {
      headers: { 'Content-Type': request.headers.get('Content-Type') },
    }).formData();
  } catch {
    return reply(400, 'The request could not be read.');
  }

  if (!env.RESEND_API_KEY || !env.QUOTE_FROM || !env.QUOTE_TO) {
    return reply(503, 'Online requests are temporarily unavailable. Please email us directly.');
  }
  if (data.get('website')) return reply(400, 'Please submit a valid quote request.');
  const lines = [];
  for (const [key, label, max, optional] of fields) {
    const raw = data.get(key);
    const value = typeof raw === 'string' ? raw.trim() : '';
    if ((!optional && !value) || value.length > max) return reply(400, 'Please review the form fields.');
    lines.push(label + ': ' + (value || '—'));
  }
  const email = data.get('email').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, 'Enter a valid email address.');
  const units = data.get('unitCount');
  if (units && (!/^\d+$/.test(units) || Number(units) < 1 || Number(units) > 10000)) {
    return reply(400, 'Enter a unit count from 1 to 10,000.');
  }

  const photos = data.getAll('projectPhotos').filter(file => typeof file !== 'string' && (file.name || file.size));
  if (photos.length > 5) return reply(400, 'Choose up to five photos.');
  const attachments = [];
  for (const photo of photos) {
    if (photo.size > maxPhotoSize) return reply(400, 'Each photo must be 3 MB or smaller.');
    const bytes = new Uint8Array(await photo.arrayBuffer());
    if (!isImage(photo.type, bytes)) return reply(400, 'Choose valid JPEG, PNG or WebP photos.');
    const extension = photo.type.split('/')[1];
    attachments.push({ filename: 'project-photo-' + (attachments.length + 1) + '.' + extension, content: encodePhoto(bytes) });
  }

  const submission = request.headers.get('X-Submission-ID') || '';
  if (!/^[a-f0-9-]{36}$/i.test(submission)) return reply(400, 'Refresh the page and try again.');
  try {
    const delivery = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': 't4-quote/' + submission,
      },
      body: JSON.stringify({
        from: env.QUOTE_FROM, to: [env.QUOTE_TO], reply_to: email,
        subject: 'New Turning 4 Success quote request', text: lines.join('\n\n'), attachments,
      }),
    });
    if (delivery.ok) return reply(200, 'Your quote request was sent.');
  } catch {
    // The form preserves the request for a retry when delivery is unavailable.
  }
  return reply(502, 'We could not send your request. Please retry or email us directly.');
}
