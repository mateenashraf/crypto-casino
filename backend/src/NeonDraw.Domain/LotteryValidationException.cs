namespace NeonDraw.Domain;

/// <summary>
/// Thrown when a purchase or draw operation violates a business rule
/// (invalid numbers, unknown/closed draw, bad wallet address, etc.).
/// Mapped to HTTP 400 at the API boundary.
/// </summary>
public sealed class LotteryValidationException : Exception
{
    public LotteryValidationException(string message) : base(message) { }
}
