# Frontend Audio Playback Change

Use the new backend endpoint to get a playable audio URL. Do not fetch the WAV as a Blob.

## Endpoint

```http
POST /pipeline/audio/prepare
Content-Type: application/json
```

Request body:

```json
{
  "user_id": "24",
  "lesson_id": "15",
  "document_id": "91",
  "language": "ar"
}
```

Response:

```json
{
  "status": "ready",
  "source": "cache",
  "audio_url": "https://presigned-s3-url...",
  "expires_in": 3600,
  "content_type": "audio/wav",
  "size_bytes": 123239104,
  "s3_key": "audio/24/15/91/ar.wav"
}
```

## React Usage

```jsx
const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function prepareAudio() {
  const res = await fetch(`${API_BASE}/pipeline/audio/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "24",
      lesson_id: "15",
      document_id: "91",
      language: "ar",
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
```

```jsx
const [audioUrl, setAudioUrl] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

async function handleLoadAudio() {
  try {
    setLoading(true);
    setError("");
    const data = await prepareAudio();
    setAudioUrl(data.audio_url);
  } catch (err) {
    console.error(err);
    setError("Failed to load audio");
  } finally {
    setLoading(false);
  }
}
```

```jsx
<button onClick={handleLoadAudio} disabled={loading}>
  {loading ? "Preparing audio..." : "Load Audio"}
</button>

{error && <p>{error}</p>}

{audioUrl && (
  <audio controls preload="metadata" src={audioUrl} />
)}
```

## Important Notes

- Do not use `res.blob()` for this audio flow.
- Do not use `URL.createObjectURL()` for the generated lesson audio.
- The browser should stream from `audio_url` directly through `<audio>`.
- `audio_url` expires after `expires_in` seconds, so request a fresh URL when reopening the lesson later.
- Set `VITE_API_BASE_URL` to the pipeline backend URL, for example the current Cloudflare tunnel URL.
