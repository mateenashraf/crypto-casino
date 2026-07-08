namespace NeonDraw.Application.Contact;

public sealed record ContactRequest(
    string Name,
    string Email,
    string Topic,
    string Message,
    string? Wallet);

public sealed record ContactResponse(bool Ok);
