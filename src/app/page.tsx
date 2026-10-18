"use client";

import { useEffect, useState } from "react";

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

const sample: Sheet = {
  sign: "East Cesar Chavez tonight. Al pastor until we sell through.",
  story: "This is an example from the bundled Friday history, not your forecast.",
  voiceScript: "",
  forecast: [
    { item: "al pastor", units: 78, price: 4.5 },
    { item: "carnitas", units: 70, price: 4.5 },
    { item: "horchata", units: 70, price: 3 },
    { item: "elote", units: 52, price: 5 },
    { item: "churro", units: 58, price: 3.5 },
    { item: "agua de jamaica", units: 56, price: 3 },
  ],
  similar: [],
  events: [],
  sources: {},
};

const stages = ["Counting similar nights", "Writing the sidewalk sign", "Saving this run"];

const sourceLabels: Record<string, string> = {
  forecast: "How many to cook",
  similar: "Closest past night",
  events: "Nearby events",
  copy: "Sidewalk sign",
  memory: "Saved run",
  schedule: "Retry",
};

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
  const [stage, setStage] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStage((current) => (current + 1) % stages.length), 4000);
    return () => clearInterval(timer);
  }, [busy]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStage(0);
    setError("");
    try {
      const response = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, neighborhood, serviceDate, tempF, rain, notes }),
      });
      const body = (await response.json()) as Sheet & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The sheet did not build.");
      setSheet(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sheet did not build.");
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
        throw new Error(body.error ?? "The brief did not play.");
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      await audio.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The brief did not play.");
    } finally {
      setSpeaking(false);
    }
  }

  const shown = sheet ?? sample;
  const isSample = sheet === null;

  return (
    <>
      <header className="mast">
        <div className="wrap">
          <p className="brand">NightPrep</p>
          <h1>Cook the right amount before the window opens.</h1>
          <p className="lede">
            Tell NightPrep where the truck is parked tonight. It counts your past nights,
            writes the sidewalk sign, and reads the cook list back to you.
          </p>
          <ol className="steps">
            <li>
              <span className="num">1</span>
              <div>
                <strong>Describe tonight</strong>
                <span>Stop, weather, and anything that will draw a crowd.</span>
              </div>
            </li>
            <li>
              <span className="num">2</span>
              <div>
                <strong>Build the sheet</strong>
                <span>We count similar nights and write the sign. This takes about a minute.</span>
              </div>
            </li>
            <li>
              <span className="num">3</span>
              <div>
                <strong>Cook from the ticket</strong>
                <span>The big numbers are how many to make. Play the brief while you prep.</span>
              </div>
            </li>
          </ol>
        </div>
      </header>
      <main className="wrap">
        <div className="work">
          <form onSubmit={onSubmit}>
            <h2>Tonight</h2>
            <label>
              City
              <span className="hint">The city on the permit.</span>
              <input value={city} onChange={(event) => setCity(event.target.value)} required />
            </label>
            <label>
              Neighborhood
              <span className="hint">The stop for this service, not your home address.</span>
              <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} required />
            </label>
            <div className="pair">
              <label>
                Service date
                <span className="hint">The night you are prepping.</span>
                <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} required />
              </label>
              <label>
                High °F
                <span className="hint">Hot nights sell more drinks.</span>
                <input type="number" value={tempF} onChange={(event) => setTempF(Number(event.target.value))} required />
              </label>
            </div>
            <div className="check">
              <input id="rain" type="checkbox" checked={rain} onChange={(event) => setRain(event.target.checked)} />
              <label htmlFor="rain">
                Rain is expected
                <span className="hint">Wet nights usually sell less.</span>
              </label>
            </div>
            <label>
              Note for tonight
              <span className="hint">A game, a market, or a street that will be closed.</span>
              <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Building tonight's sheet" : "Build tonight's sheet"}
            </button>
            {busy && <p className="status">{stages[stage]}</p>}
            {error && <p className="error">{error} Your answers are still in the form.</p>}
          </form>
          <article className="ticket" aria-live="polite">
            <header>
              <h2>{isSample ? "Example ticket" : "Tonight's ticket"}</h2>
              <p>
                {isSample
                  ? "A Friday from the 48 nights already loaded. Build the sheet to replace it."
                  : `For ${neighborhood} on ${serviceDate}.`}
              </p>
            </header>
            <p className="sign">{shown.sign}</p>
            <div className="menu">
              {shown.forecast.map((line) => (
                <div key={line.item}>
                  <strong>{line.item}</strong>
                  <span className="units">
                    {line.units}
                    <span className="price">${line.price.toFixed(2)}</span>
                  </span>
                </div>
              ))}
            </div>
            {!isSample && <p className="story">{shown.story}</p>}
            {!isSample && shown.similar[0] && <p className="closest">Closest night: {shown.similar[0].notes}</p>}
            {!isSample && shown.events.length > 0 && (
              <ul className="events">
                {shown.events.map((item) => (
                  <li key={item.link}><a href={item.link}>{item.title}</a></li>
                ))}
              </ul>
            )}
            {!isSample && (
              <button className="quiet" type="button" onClick={speak} disabled={speaking}>
                {speaking ? "Playing the cook brief" : "Play the cook brief"}
              </button>
            )}
            {!isSample && (
              <ul className="sources">
                {Object.entries(shown.sources).map(([key, value]) => (
                  <li key={key}>{sourceLabels[key] ?? key}: {value}</li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </main>
    </>
  );
}
