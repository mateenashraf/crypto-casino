using NeonDraw.Domain.Enums;

namespace NeonDraw.Domain.Entities;

public class PayoutRequest
{
    public Guid Id { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string WalletAddress { get; set; } = string.Empty;
    public decimal UsdAmount { get; set; }
    public decimal EthAmount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? MetaJson { get; set; }
    public PayoutStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? ResolvedBy { get; set; }
}
