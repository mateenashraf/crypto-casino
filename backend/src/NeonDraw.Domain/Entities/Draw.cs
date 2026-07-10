using NeonDraw.Domain.Enums;

namespace NeonDraw.Domain.Entities;

public class Draw
{
    public Guid Id { get; set; }
    public ulong OnChainDrawId { get; set; }
    public DrawTier Tier { get; set; }
    public DrawStatus Status { get; set; }
    public DateTimeOffset OpensAt { get; set; }
    public DateTimeOffset ClosesAt { get; set; }
    public decimal TicketPriceEth { get; set; }
    public decimal AdvertisedJackpotUsd { get; set; }
    public decimal PoolBalanceEth { get; set; }
    public int TicketCount { get; set; }
    public int WinnerCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SettledAt { get; set; }

    public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
}
