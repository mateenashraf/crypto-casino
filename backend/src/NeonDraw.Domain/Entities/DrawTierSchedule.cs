namespace NeonDraw.Domain.Entities;

public class DrawTierSchedule
{
    public string TierId { get; set; } = string.Empty;
    public DateTimeOffset NextDrawAt { get; set; }
    public DateTimeOffset? LastRunAt { get; set; }
    public int RunCount { get; set; }
}
