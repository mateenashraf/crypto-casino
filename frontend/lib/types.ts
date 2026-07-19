export type DrawSummary = {
  id: string;
  onChainDrawId: number;
  tier: string;
  status: string;
  opensAt: string;
  closesAt: string;
  ticketPriceEth: number;
  advertisedJackpotUsd: number;
  poolBalanceEth: number;
  ticketCount: number;
  winnerCount: number;
};

export type WinnerSummary = {
  drawId: string;
  drawName: string;
  walletDisplay: string;
  prizeUsd: number;
  prizeLabel: string;
  prizeType: string;
  matchCount: number;
  source: string;
  timestamp: number;
  payloadJson: string;
};

export type TicketSummary = {
  id: string;
  onChainTicketId: number;
  onChainDrawId: number;
  tier: string;
  numbers: number[];
  txHash?: string;
  chainId: number;
  purchasedAt: string;
  isWinner: boolean;
  paidAmountUsd?: number;
};
