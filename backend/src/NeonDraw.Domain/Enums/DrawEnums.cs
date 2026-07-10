namespace NeonDraw.Domain.Enums;

public enum DrawTier
{
    Daily = 0,
    Weekly = 1,
    Monthly = 2,
    Quarterly = 3
}

public enum DrawStatus
{
    Open = 0,
    Closed = 1,
    VRFRequested = 2,
    Settled = 3,
    Cancelled = 4
}

public enum TransactionType
{
    TicketPurchase = 0,
    PrizePayout = 1,
    Refund = 2
}
