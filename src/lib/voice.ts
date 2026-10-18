export async function speakBrief(script: string): Promise<{ audio: Buffer | null; source: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { audio: null, source: "none" };
  const voice = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: script.slice(0, 800),
      model_id: "eleven_flash_v2_5",
    }),
  });
  if (!response.ok) return { audio: null, source: `none (elevenlabs ${response.status})` };
  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, source: "elevenlabs" };
}
