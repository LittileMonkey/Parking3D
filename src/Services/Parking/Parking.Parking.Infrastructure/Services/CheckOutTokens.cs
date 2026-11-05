using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using Parking.ServiceDefaults;

namespace Parking.Parking.Infrastructure.Services;

// Different token purposes prevent a consumed PARK1 check-in QR from becoming an exit credential.
public sealed class CheckOutTokens(IConfiguration config, TimeProvider clock) : ICheckOutTokens
{
    private readonly byte[] key = GetKey(config);
    private static byte[] GetKey(IConfiguration config)
    {
        var value = Encoding.UTF8.GetBytes(config["Qr:SigningKey"] ?? "");
        if (value.Length < 32) throw new InvalidOperationException("Qr:SigningKey requires 32 bytes.");
        return value;
    }

    public string SignQuote(CheckOutProof proof) => Sign("CHECKOUT1", proof);
    public string SignExitPermit(CheckOutVerification verification) => Sign("EXITPERMIT1",verification);
    public CheckOutVerification ValidateExitPermit(string token)
    {
        var value=Read<CheckOutVerification>("EXITPERMIT1",token);
        if(value.Proof.ExpiresAt<=clock.GetUtcNow() || value.Payment.SessionId!=value.Proof.SessionId ||
            value.Payment.LotId!=value.Proof.LotId || value.Payment.Currency!="VND" ||
            value.Payment.AmountPaid<value.Proof.GrossAmount || (value.Proof.GrossAmount>0&&value.Payment.PaymentId is null))
            throw new ServiceException(409,"Exit permit is expired or payment evidence is insufficient.");
        return value;
    }
    public CheckOutProof ValidateQuote(string token)
    {
        var proof = Read<CheckOutProof>("CHECKOUT1", token);
        if (proof.QuoteId == Guid.Empty || proof.SessionId == Guid.Empty || proof.ActorId == Guid.Empty ||
            proof.LotId == Guid.Empty || proof.GateId == Guid.Empty || proof.GrossAmount < 0 ||
            proof.QuoteAt > clock.GetUtcNow().AddSeconds(1) || proof.ExpiresAt <= clock.GetUtcNow() ||
            proof.ExpiresAt <= proof.QuoteAt || proof.ExpiresAt - proof.QuoteAt > TimeSpan.FromMinutes(5))
            throw new ServiceException(409, "Checkout quote is invalid or expired. Request a new quote.");
        return proof;
    }

    public CheckOutQrDto IssueExitQr(Guid sessionId, Guid lotId)
    {
        var expires = clock.GetUtcNow().AddMinutes(5);
        return new(Sign("EXIT1", new ExitClaims(sessionId, lotId, expires)), expires);
    }

    public (Guid SessionId, Guid LotId) ValidateExitQr(string token)
    {
        var claim = Read<ExitClaims>("EXIT1", token);
        if (claim.SessionId == Guid.Empty || claim.LotId == Guid.Empty || claim.ExpiresAt <= clock.GetUtcNow())
            throw new ServiceException(409, "Exit QR is invalid or expired.");
        return (claim.SessionId, claim.LotId);
    }

    private string Sign<T>(string purpose, T value)
    {
        var body = purpose + "." + Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(value));
        return body + "." + Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(body)));
    }

    private T Read<T>(string purpose, string token)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 8192) throw new FormatException();
            var parts = token.Split('.');
            if (parts.Length != 3 || parts[0] != purpose || parts[2].Length != 64) throw new FormatException();
            var expected = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(parts[0] + "." + parts[1]));
            if (!CryptographicOperations.FixedTimeEquals(expected, Convert.FromHexString(parts[2]))) throw new FormatException();
            return JsonSerializer.Deserialize<T>(Convert.FromBase64String(parts[1])) ?? throw new FormatException();
        }
        catch (Exception error) when (error is FormatException or JsonException or ArgumentException)
        { throw new ServiceException(409, "Invalid checkout token."); }
    }

    private sealed record ExitClaims(Guid SessionId, Guid LotId, DateTimeOffset ExpiresAt);
}
