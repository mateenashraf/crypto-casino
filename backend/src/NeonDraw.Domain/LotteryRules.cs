using System.Text.RegularExpressions;

namespace NeonDraw.Domain;

/// <summary>
/// Pure business rules shared by services and tests. Ports the validation in
/// js/lottery.js (number picking) and js/wallet.js / js/ticket-lookup.js (addresses).
/// </summary>
public static partial class LotteryRules
{
    [GeneratedRegex("^0x[0-9a-fA-F]{40}$")]
    private static partial Regex AddressRegex();

    public static bool IsValidAddress(string? address) =>
        !string.IsNullOrWhiteSpace(address) && AddressRegex().IsMatch(address.Trim());

    public static string NormalizeAddress(string address) => address.Trim().ToLowerInvariant();

    /// <summary>Validates a 6/49 pick. Throws <see cref="LotteryValidationException"/> on failure.</summary>
    public static void ValidateNumbers(int[]? numbers)
    {
        if (numbers is null || numbers.Length != LotteryConstants.NumbersPerTicket)
            throw new LotteryValidationException($"Select exactly {LotteryConstants.NumbersPerTicket} numbers.");

        if (numbers.Distinct().Count() != numbers.Length)
            throw new LotteryValidationException("Numbers must be unique.");

        if (numbers.Any(n => n < LotteryConstants.MinNumber || n > LotteryConstants.MaxNumber))
            throw new LotteryValidationException(
                $"Numbers must be between {LotteryConstants.MinNumber} and {LotteryConstants.MaxNumber}.");
    }

    /// <summary>Returns a sorted copy so stored tickets are canonical.</summary>
    public static int[] SortNumbers(int[] numbers)
    {
        var copy = (int[])numbers.Clone();
        Array.Sort(copy);
        return copy;
    }
}
