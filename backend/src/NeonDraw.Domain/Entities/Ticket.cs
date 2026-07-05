namespace NeonDraw.Domain.Entities;

public class Ticket
{
    public Guid Id { get; set; }
    public Guid DrawId { get; set; }
    public Draw Draw { get; set; } = null!;
    public ulong OnChainTicketId { get; set; }
    public string WalletAddress { get; set; } = string.Empty;
    public int[] Numbers { get; set; } = Array.Empty<int>();
    public string? TxHash { get; set; }
    public int ChainId { get; set; }
    public DateTimeOffset PurchasedAt { get; set; }
    public bool IsWinner { get; set; }
    public decimal? PaidAmountUsd { get; set; }
}
