"use client";

import { useState } from "react";

type Line = { item: string; units: number; price: number };
type Sheet = {
  sign: string;
  story: string;
  voiceScript: string;
  forecast: Line[];
  similar: Array<{ id: string; notes: string; distance: number }>;
  events: Array<{ title: string; link: string }>;
  sources: Record<string, string>;
};

const today = new Date().toISOString().slice(0, 10);

export default function HomePage() {
  const [city, setCity] = useState("Austin");
  const [neighborhood, setNeighborhood] = useState("East Cesar Chavez");
  const [serviceDate, setServiceDate] = useState(today);
  const [tempF, setTempF] = useState(78);
  const [rain, setRain] = useState(false);
  const [notes, setNotes] = useState("Soccer match lets out at 8. Pastor sells out when it does.");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, neighborhood, serviceDate, tempF, rain, notes }),
      });
      const body = (await response.json()) as Sheet & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Prep failed");
      setSheet(body);
    } catch (caught) {
      setSheet(null);
      setError(caught instanceof Error ? caught.message : "Prep failed");
    } finally {
      setBusy(false);
    }
  }

  async function speak() {
    if (!sheet) return;
    setSpeaking(true);
    setError("");
    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: sheet.voiceScript }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "No audio");
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      await audio.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No audio");
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <main>
      <header>
        <h1>Night<span>Prep</span></h1>
        <p>
          A prep sheet a taco truck would pay for. Open-weight Gemma writes the sign.
          TabPFN forecasts how many of each item to cook. History stays on your stack.
        </p>
      </header>
      <div className="layout">
        <form onSubmit={onSubmit}>
          <label>
            City
            <input value={city} onChange={(event) => setCity(event.target.value)} required />
          </label>
          <label>
            Neighborhood
            <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} required />
          </label>
          <label>
            Service date
            <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} required />
          </label>
          <label>
            Temp °F
            <input
              type="number"
              value={tempF}
              onChange={(event) => setTempF(Number(event.target.value))}
              required
            />
          </label>
          <label className="row">
            <input type="checkbox" checked={rain} onChange={(event) => setRain(event.target.checked)} />
            Rain expected
          </label>
          <label>
            Owner notes
            <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Prepping…" : "Build tonight's sheet"}</button>
        </form>
        <section className="sheet">
          {!sheet && !error && <p>Forty-eight past nights are already loaded. Run a sheet.</p>}
          {error && <p className="error">{error}</p>}
          {sheet && (
            <>
              <p className="sign">{sheet.sign}</p>
              <p>{sheet.story}</p>
              <div className="menu">
                {sheet.forecast.map((line) => (
                  <div key={line.item}>
                    <strong>{line.item}</strong>
                    <span>{line.units} @ ${line.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {sheet.similar[0] && <p>Closest night: {sheet.similar[0].notes}</p>}
              {sheet.events.length > 0 && (
                <ul>
                  {sheet.events.map((item) => (
                    <li key={item.link}><a href={item.link}>{item.title}</a></li>
                  ))}
                </ul>
              )}
              <button className="secondary" type="button" onClick={speak} disabled={speaking}>
                {speaking ? "Speaking…" : "Play the cook brief"}
              </button>
              <ul className="sources">
                {Object.entries(sheet.sources).map(([key, value]) => (
                  <li key={key}>{key}: {value}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
