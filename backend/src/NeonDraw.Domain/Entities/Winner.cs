namespace NeonDraw.Domain.Entities;

public class Winner
{
    public Guid Id { get; set; }
    public Guid DrawId { get; set; }
    public Draw? Draw { get; set; }
    public Guid? TicketId { get; set; }
    public string WalletAddress { get; set; } = string.Empty;
    public int[] WinningNumbers { get; set; } = Array.Empty<int>();
    public decimal PrizeUsd { get; set; }

    /// <summary>True when no real ticket was in the pool and a placeholder winner was shown.</summary>
    public bool IsSimulated { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
