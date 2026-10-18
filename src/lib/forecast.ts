import { MENU, dayOfWeek, sampleHistory, type HistoryRow } from "@/data/history";
import type { ForecastLine, Tonight } from "@/lib/sheet";

const BASE = "https://api.priorlabs.ai";

type UploadInfo = {
  signed_urls: string[];
  required_headers: Record<string, string>;
};

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function historyMean(tonight: Tonight, rows: HistoryRow[]): ForecastLine[] {
  return MENU.map((item) => {
    const mine = rows.filter((row) => row.item === item.item);
    const close = mine.filter((row) => row.rain === (tonight.rain ? 1 : 0));
    const pool = close.length >= 2 ? close : mine;
    const units = Math.round(pool.reduce((sum, row) => sum + row.unitsSold, 0) / pool.length);
    return { item: item.item, units, price: item.price };
  });
}

function numbersFrom(value: unknown): number[] {
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(numbersFrom);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(numbersFrom);
  }
  return [];
}

async function priorFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = process.env.PRIOR_API_KEY;
  if (!token) throw new Error("PRIOR_API_KEY missing");
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const body = jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
  const parsed = body ? (JSON.parse(body) as unknown) : {};
  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : `TabPFN ${response.status}`;
    throw new Error(message);
  }
  return parsed;
}

async function putUpload(info: UploadInfo, csv: string): Promise<void> {
  const response = await fetch(info.signed_urls[0], {
    method: "PUT",
    headers: info.required_headers,
    body: csv,
  });
  if (!response.ok) throw new Error(`TabPFN upload failed (${response.status})`);
}

export async function buildForecast(
  tonight: Tonight,
): Promise<{ lines: ForecastLine[]; source: string }> {
  const rows = sampleHistory();
  const fallback = () => ({ lines: historyMean(tonight, rows), source: "history-mean" });
  if (!process.env.PRIOR_API_KEY) return fallback();

  try {
    const header = ["item", "day_of_week", "temp_f", "rain", "event_nearby", "price"];
    const xTrain = toCsv([
      header,
      ...rows.map((row) => [
        row.item,
        row.dayOfWeek,
        row.tempF,
        row.rain,
        row.eventNearby,
        row.price,
      ]),
    ]);
    const yTrain = toCsv([["units_sold"], ...rows.map((row) => [row.unitsSold])]);
    const dow = dayOfWeek(tonight.serviceDate);
    const xTest = toCsv([
      header,
      ...MENU.map((item) => [
        item.item,
        dow,
        tonight.tempF,
        tonight.rain ? 1 : 0,
        0,
        item.price,
      ]),
    ]);

    const prepared = (await priorFetch("/tabpfn/prepare_train_set_upload", {
      method: "POST",
      body: JSON.stringify({
        x_train_info: { format: "csv" },
        y_train_info: { format: "csv" },
      }),
    })) as {
      train_set_upload_id: string;
      x_train_info: UploadInfo;
      y_train_info: UploadInfo;
    };
    await putUpload(prepared.x_train_info, xTrain);
    await putUpload(prepared.y_train_info, yTrain);

    const fitted = (await priorFetch("/tabpfn/fit", {
      method: "POST",
      body: JSON.stringify({
        train_set_upload_id: prepared.train_set_upload_id,
        task_config: {
          task: "regression",
          tabpfn_config: { model_path: "v3.5_default" },
        },
      }),
    })) as { fitted_train_set_id: string };

    const testPrep = (await priorFetch("/tabpfn/prepare_test_set_upload", {
      method: "POST",
      body: JSON.stringify({
        fitted_train_set_id: fitted.fitted_train_set_id,
        x_test_info: { format: "csv" },
      }),
    })) as { test_set_upload_id: string; x_test_info: UploadInfo };
    await putUpload(testPrep.x_test_info, xTest);

    const predicted = (await priorFetch("/tabpfn/predict", {
      method: "POST",
      body: JSON.stringify({
        test_set_upload_id: testPrep.test_set_upload_id,
        fitted_train_set_id: fitted.fitted_train_set_id,
        task_config: {
          task: "regression",
          predict_params: { output_type: "mean" },
        },
      }),
    })) as { prediction?: unknown };

    const values = numbersFrom(predicted.prediction).slice(0, MENU.length);
    if (values.length !== MENU.length) {
      return { ...fallback(), source: "history-mean (tabpfn shape unexpected)" };
    }
    return {
      source: "tabpfn-3.5",
      lines: MENU.map((item, index) => ({
        item: item.item,
        price: item.price,
        units: Math.max(0, Math.round(values[index])),
      })),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "TabPFN failed";
    return { ...fallback(), source: `history-mean (${reason})` };
  }
}
