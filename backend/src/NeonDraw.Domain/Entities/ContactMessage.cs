using System.ComponentModel.DataAnnotations;

namespace NeonDraw.Domain.Entities;

public class ContactMessage
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? WalletAddress { get; set; }
    public string? ClientIp { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
