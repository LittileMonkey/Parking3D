using System.Security.Cryptography;

namespace Parking.Identity.Infrastructure;

public static class PasswordHash
{
    public static string Create(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(32);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 600_000, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2-sha256:600000:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string encoded)
    {
        try
        {
            var p = encoded.Split(':');
            if (p.Length != 4 || p[0] != "pbkdf2-sha256" || !int.TryParse(p[1], out var iterations)
                || iterations is < 100_000 or > 1_000_000) return false;
            var salt = Convert.FromBase64String(p[2]); var expected = Convert.FromBase64String(p[3]);
            if (salt.Length != 32 || expected.Length != 32) return false;
            return CryptographicOperations.FixedTimeEquals(expected,
                Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, 32));
        }
        catch (FormatException) { return false; }
    }
}
