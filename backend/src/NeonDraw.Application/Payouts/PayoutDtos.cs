using NeonDraw.Domain.Enums;

namespace NeonDraw.Application.Payouts;

public sealed record ProcessPayoutRequest(
    string Wallet,
    decimal UsdAmount,
    string Type,
    string? MetaJson = null);

public sealed record ProcessPayoutResponse(
    bool Auto,
    decimal Usd,
    Guid? RequestId,
    string? ExternalId,
    PayoutStatus? Status);

public sealed record PayoutSummaryDto(
    Guid Id,
    string ExternalId,
    string WalletAddress,
    decimal UsdAmount,
    string Type,
    PayoutStatus Status,
    DateTimeOffset CreatedAt,
    string? MetaJson);

public sealed record PayoutStatusDto(
    Guid Id,
    string ExternalId,
    string WalletAddress,
    decimal UsdAmount,
    decimal EthAmount,
    string Type,
    PayoutStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ResolvedAt,
    string? ResolvedBy,
    string? MetaJson);

public interface IPayoutService
{
    Task<ProcessPayoutResponse> ProcessAsync(ProcessPayoutRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<PayoutSummaryDto>> GetPendingAsync(CancellationToken ct = default);
    Task<PayoutSummaryDto?> ApproveAsync(Guid id, string operatorId, CancellationToken ct = default);
    Task<PayoutSummaryDto?> RejectAsync(Guid id, string operatorId, CancellationToken ct = default);
    Task<PayoutStatusDto?> GetByExternalIdAsync(string externalId, CancellationToken ct = default);
}
