import { DrawSummary, TicketSummary, WinnerSummary } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5080";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchDraws() {
  return getJson<DrawSummary[]>("/api/draws");
}

export function fetchWinners() {
  return getJson<WinnerSummary[]>("/api/draws/winners?limit=20");
}

export function fetchTickets(wallet: string) {
  return getJson<TicketSummary[]>(`/api/tickets/${wallet}?limit=50`);
}
