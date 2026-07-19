// @ts-nocheck
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDraws, fetchTickets, fetchWinners } from "@/lib/api";
import { DrawSummary, TicketSummary, WinnerSummary } from "@/lib/types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string }) => Promise<string[]>;
      on?: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

function shorten(addr: string) {
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

export default function Dashboard() {
  const [wallet, setWallet] = useState<string>("");
  const [draws, setDraws] = useState<DrawSummary[]>([]);
  const [winners, setWinners] = useState<WinnerSummary[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [error, setError] = useState<string>("");

  const loadReadModels = useCallback(async (currentWallet?: string) => {
    setError("");
    try {
      const [drawRows, winnerRows] = await Promise.all([fetchDraws(), fetchWinners()]);
      setDraws(drawRows);
      setWinners(winnerRows);
      const target = currentWallet ?? wallet;
      if (target) {
        setTickets(await fetchTickets(target));
      } else {
        setTickets([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, [wallet]);

  async function connectWallet() {
    if (!window.ethereum) {
      setError("MetaMask not detected");
      return;
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const account = accounts[0] ?? "";
    setWallet(account);
    await loadReadModels(account);
  }

  useEffect(() => {
    loadReadModels();
  }, [loadReadModels]);

  const openDraws = useMemo(() => draws.filter(d => String(d.status).toLowerCase() === "open"), [draws]);

  return (
    <main>
      <section>
        <h1>NeonDraw Production Console</h1>
        <p><small>Authoritative data source: backend API + on-chain settlement records.</small></p>
        <div className="row">
          <button onClick={connectWallet}>{wallet ? `Connected: ${shorten(wallet)}` : "Connect MetaMask"}</button>
          <button onClick={() => loadReadModels()}>Refresh</button>
        </div>
        {error ? <p style={{ color: "#ff8d8d" }}>{error}</p> : null}
      </section>

      <section>
        <h2>Open / Scheduled Draws</h2>
        <table>
          <thead>
            <tr>
              <th>On-chain Draw</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Ticket Price (ETH)</th>
              <th>Pool (ETH)</th>
              <th>Closes (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {(openDraws.length ? openDraws : draws).map(d => (
              <tr key={d.id}>
                <td>{d.onChainDrawId}</td>
                <td>{d.tier}</td>
                <td>{d.status}</td>
                <td>{d.ticketPriceEth}</td>
                <td>{d.poolBalanceEth}</td>
                <td>{new Date(d.closesAt).toISOString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Recent Winners</h2>
        <table>
          <thead>
            <tr>
              <th>Draw</th>
              <th>Wallet</th>
              <th>Prize</th>
              <th>Type</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {winners.map((w, idx) => (
              <tr key={`${w.drawId}-${w.timestamp}-${idx}`}>
                <td>{w.drawName}</td>
                <td>{w.walletDisplay}</td>
                <td>{w.prizeLabel}</td>
                <td>{w.prizeType}</td>
                <td>{w.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{wallet ? "My Tickets" : "My Tickets (connect wallet)"}</h2>
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Draw</th>
              <th>Tier</th>
              <th>Numbers</th>
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id}>
                <td>{t.onChainTicketId}</td>
                <td>{t.onChainDrawId}</td>
                <td>{t.tier}</td>
                <td>{t.numbers.join(", ")}</td>
                <td>{t.isWinner ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
