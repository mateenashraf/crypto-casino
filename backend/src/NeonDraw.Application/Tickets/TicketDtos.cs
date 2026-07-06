using NeonDraw.Domain.Enums;

namespace NeonDraw.Application.Tickets;

public sealed record PurchaseTicketRequest(
    ulong DrawId,
    string WalletAddress,
    int[] Numbers,
    int Quantity = 1,
    string? TxHash = null,
    int ChainId = 11155111);

public sealed record TicketDto(
    Guid Id,
    ulong DrawId,
    DrawTier Tier,
    string WalletAddress,
    int[] Numbers,
    string? TxHash,
    int ChainId,
    DateTimeOffset PurchasedAt,
    bool IsWinner,
    decimal? PaidAmountUsd);

public sealed record PurchaseResultDto(
    int TicketsCreated,
    decimal TotalUsd,
    decimal TotalEth,
    IReadOnlyList<TicketDto> Tickets);

public sealed record TicketLookupResultDto(
    string WalletAddress,
    int TicketCount,
    decimal TotalUsd,
    decimal TotalEth,
    IReadOnlyList<TicketDto> Tickets);

public interface ITicketService
{
    Task<PurchaseResultDto> PurchaseAsync(PurchaseTicketRequest request, CancellationToken cancellationToken = default);
    Task<TicketLookupResultDto> LookupByWalletAsync(string wallet, CancellationToken cancellationToken = default);
}
