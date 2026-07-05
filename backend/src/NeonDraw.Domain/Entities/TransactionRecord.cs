using NeonDraw.Domain.Enums;

namespace NeonDraw.Domain.Entities;

public class TransactionRecord
{
    public Guid Id { get; set; }
    public TransactionType Type { get; set; }
    public string WalletAddress { get; set; } = string.Empty;
    public decimal AmountEth { get; set; }
    public string? TxHash { get; set; }
    public int ChainId { get; set; }
    public Guid? TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
