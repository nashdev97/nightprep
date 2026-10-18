export type HistoryRow = {
  item: string;
  dayOfWeek: string;
  tempF: number;
  rain: number;
  eventNearby: number;
  price: number;
  unitsSold: number;
};

export const MENU = [
  { item: "al pastor", price: 4.5, base: 48 },
  { item: "carnitas", price: 4.5, base: 40 },
  { item: "horchata", price: 3, base: 32 },
  { item: "elote", price: 5, base: 22 },
  { item: "churro", price: 3.5, base: 28 },
  { item: "agua de jamaica", price: 3, base: 26 },
] as const;

const NIGHTS = [
  { dayOfWeek: "Friday", tempF: 81, rain: 0, eventNearby: 1 },
  { dayOfWeek: "Saturday", tempF: 76, rain: 0, eventNearby: 1 },
  { dayOfWeek: "Sunday", tempF: 70, rain: 1, eventNearby: 0 },
  { dayOfWeek: "Wednesday", tempF: 74, rain: 0, eventNearby: 0 },
  { dayOfWeek: "Thursday", tempF: 68, rain: 1, eventNearby: 1 },
  { dayOfWeek: "Saturday", tempF: 84, rain: 0, eventNearby: 0 },
  { dayOfWeek: "Friday", tempF: 62, rain: 1, eventNearby: 0 },
  { dayOfWeek: "Sunday", tempF: 79, rain: 0, eventNearby: 1 },
] as const;

export function sampleHistory(): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const night of NIGHTS) {
    for (const item of MENU) {
      let units = item.base;
      if (night.dayOfWeek === "Friday" || night.dayOfWeek === "Saturday") units += 14;
      if (night.dayOfWeek === "Wednesday") units -= 10;
      if (night.rain) units -= 12;
      if (night.eventNearby) units += 16;
      if (night.tempF < 65) units -= 6;
      if (item.item === "horchata" && night.tempF > 80) units += 8;
      if (item.item === "churro" && night.rain) units += 4;
      rows.push({
        item: item.item,
        price: item.price,
        dayOfWeek: night.dayOfWeek,
        tempF: night.tempF,
        rain: night.rain,
        eventNearby: night.eventNearby,
        unitsSold: Math.max(4, units),
      });
    }
  }
  return rows;
}

export function dayOfWeek(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}
