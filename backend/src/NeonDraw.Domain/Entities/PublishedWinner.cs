namespace NeonDraw.Domain.Entities;

public class PublishedWinner
{
    public Guid Id { get; set; }
    public string DrawTierId { get; set; } = string.Empty;
    public string DrawName { get; set; } = string.Empty;
    public string WalletDisplay { get; set; } = string.Empty;
    public decimal PrizeUsd { get; set; }
    public string PrizeLabel { get; set; } = string.Empty;
    public string PrizeType { get; set; } = string.Empty;
    public int MatchCount { get; set; }
    public string Source { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset PublishedAt { get; set; }
}
