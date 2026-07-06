using NeonDraw.Domain;
using Xunit;

namespace NeonDraw.Tests;

public class LotteryRulesTests
{
    [Fact]
    public void ValidateNumbers_Accepts_SixUniqueInRange()
    {
        var ex = Record.Exception(() => LotteryRules.ValidateNumbers(new[] { 1, 2, 3, 4, 5, 6 }));
        Assert.Null(ex);
    }

    [Theory]
    [InlineData(new[] { 1, 2, 3, 4, 5 })]          // too few
    [InlineData(new[] { 1, 2, 3, 4, 5, 6, 7 })]    // too many
    public void ValidateNumbers_Rejects_WrongCount(int[] numbers) =>
        Assert.Throws<LotteryValidationException>(() => LotteryRules.ValidateNumbers(numbers));

    [Fact]
    public void ValidateNumbers_Rejects_Duplicates() =>
        Assert.Throws<LotteryValidationException>(() => LotteryRules.ValidateNumbers(new[] { 1, 1, 2, 3, 4, 5 }));

    [Theory]
    [InlineData(new[] { 0, 2, 3, 4, 5, 6 })]
    [InlineData(new[] { 1, 2, 3, 4, 5, 50 })]
    public void ValidateNumbers_Rejects_OutOfRange(int[] numbers) =>
        Assert.Throws<LotteryValidationException>(() => LotteryRules.ValidateNumbers(numbers));

    [Theory]
    [InlineData("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", true)]
    [InlineData("0x123", false)]
    [InlineData("not-an-address", false)]
    [InlineData("", false)]
    public void IsValidAddress_Works(string address, bool expected) =>
        Assert.Equal(expected, LotteryRules.IsValidAddress(address));

    [Fact]
    public void SortNumbers_ReturnsSortedCopy()
    {
        var input = new[] { 42, 1, 7, 3, 20, 5 };
        var sorted = LotteryRules.SortNumbers(input);
        Assert.Equal(new[] { 1, 3, 5, 7, 20, 42 }, sorted);
        Assert.Equal(new[] { 42, 1, 7, 3, 20, 5 }, input); // original untouched
    }
}
