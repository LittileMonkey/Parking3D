using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Parking.Identity.Application;
using Parking.ServiceDefaults;

namespace Parking.Identity.Infrastructure;

public sealed class IdentityService(NpgsqlDataSource db, IConfiguration config, TimeProvider clock) : IIdentityService
{
    private static readonly string DummyHash = PasswordHash.Create("dummy-not-a-login-password");
    private static string Email(string value)
    {
        if(string.IsNullOrWhiteSpace(value))throw new ServiceException(400,"Email required");
        var v = value.Trim().ToLowerInvariant();
        if (v.Length is < 3 or > 254 || !System.Net.Mail.MailAddress.TryCreate(v, out var address) || address.Address != v)
            throw new ServiceException(400, "Invalid email");
        return v;
    }

    public async Task<Guid> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        if (request.Password is null || request.Password.Length is < 10 or > 128 || string.IsNullOrWhiteSpace(request.FullName) || request.FullName.Trim().Length > 200)
            throw new ServiceException(400, "Password must contain 10–128 characters; full name is required");
        var id = Guid.NewGuid();
        await using var connection = await db.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using var command = new NpgsqlCommand("""
            INSERT INTO app_users(id,email_normalized,full_name,password_hash,status,created_at,updated_at)
            VALUES(@id,@email,@name,@hash,'ACTIVE',now(),now());
            INSERT INTO platform_user_roles(user_id,role_code) VALUES(@id,'CUSTOMER');
            INSERT INTO audit_logs(id,actor_user_id,actor_type,action,entity_type,entity_id,created_at)
            VALUES(gen_random_uuid(),@id,'USER','REGISTER','USER',@entity,now());
            """, connection, tx);
        command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("email", Email(request.Email));
        command.Parameters.AddWithValue("name", request.FullName.Trim()); command.Parameters.AddWithValue("hash", PasswordHash.Create(request.Password));
        command.Parameters.AddWithValue("entity", id.ToString());
        await command.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
        return id;
    }

    public async Task<TokenReply> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        if (request.Password is null || request.Password.Length is < 1 or > 128) throw new ServiceException(401, "Invalid credentials");
        await using var command = db.CreateCommand("SELECT id,password_hash,status,locked_until FROM app_users WHERE email_normalized=@email");
        command.Parameters.AddWithValue("email", Email(request.Email));
        Guid id = Guid.Empty; string hash = DummyHash; bool active = false;
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            if (await reader.ReadAsync(ct))
            {
                id = reader.GetGuid(0); hash = reader.IsDBNull(1) ? DummyHash : reader.GetString(1);
                active = reader.GetString(2) == "ACTIVE" && (reader.IsDBNull(3) || reader.GetDateTime(3) <= clock.GetUtcNow().UtcDateTime);
            }
        }
        if (!PasswordHash.Verify(request.Password, hash) || !active) throw new ServiceException(401, "Invalid credentials");
        await using var roles = db.CreateCommand("SELECT role_code FROM platform_user_roles WHERE user_id=@id");
        roles.Parameters.AddWithValue("id", id);
        var claims = new List<Claim> { new("sub", id.ToString()), new("jti", Guid.NewGuid().ToString()) };
        await using (var reader = await roles.ExecuteReaderAsync(ct))
            while (await reader.ReadAsync(ct)) claims.Add(new Claim("role", reader.GetString(0)));
        var now = clock.GetUtcNow(); var expiry = now.AddMinutes(15);
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(config["Jwt:Issuer"] ?? "parking-identity", "parking-api", claims, now.UtcDateTime, expiry.UtcDateTime, credentials);
        return new TokenReply(new JwtSecurityTokenHandler().WriteToken(token), expiry);
    }

    public async Task<bool> CheckAccessAsync(Guid userId, Guid lotId, string capability, CancellationToken ct)
    {
        if (userId == Guid.Empty || capability is not ("USER" or "ADMIN" or "OCR" or "GATE" or "CASH" or "REPORT")) return false;
        await using var command = db.CreateCommand("""
            SELECT EXISTS(SELECT 1 FROM app_users u WHERE u.id=@user AND u.status='ACTIVE'
              AND (u.locked_until IS NULL OR u.locked_until<=now())
              AND ((@cap='USER') OR (@cap='ADMIN' AND EXISTS(SELECT 1 FROM platform_user_roles r WHERE r.user_id=u.id AND r.role_code='ADMIN'))
              OR (@cap<>'ADMIN' AND EXISTS(SELECT 1 FROM lot_staff_assignments a WHERE a.user_id=u.id AND a.lot_id=@lot
                AND a.revoked_at IS NULL AND a.valid_from<=now() AND (a.valid_until IS NULL OR now()<a.valid_until)
                AND ((@cap='OCR' AND a.role_code IN ('PARKING_STAFF','PARKING_MANAGER'))
                  OR (@cap IN ('GATE','CASH') AND a.role_code='PARKING_STAFF') OR (@cap='REPORT' AND a.role_code='PARKING_MANAGER'))))))
            """);
        command.Parameters.AddWithValue("user", userId); command.Parameters.AddWithValue("lot", lotId); command.Parameters.AddWithValue("cap", capability);
        return (bool)(await command.ExecuteScalarAsync(ct))!;
    }

    public async Task<Guid> AssignAsync(Guid actorId, AssignmentRequest request, CancellationToken ct)
    {
        if (!await CheckAccessAsync(actorId, Guid.Empty, "ADMIN", ct)) throw new ServiceException(403, "Admin permission required");
        if (request.LotId == Guid.Empty || request.UserId == Guid.Empty || request.Role is not ("PARKING_STAFF" or "PARKING_MANAGER")
            || request.ActiveTo <= request.ActiveFrom || (request.CanManageStaffAssignments && request.Role != "PARKING_MANAGER"))
            throw new ServiceException(400, "Invalid assignment");
        var id = Guid.NewGuid();
        await using var connection = await db.OpenConnectionAsync(ct); await using var tx = await connection.BeginTransactionAsync(ct);
        await using var command = new NpgsqlCommand("""
            INSERT INTO lot_staff_assignments(id,lot_id,user_id,role_code,valid_from,valid_until,can_manage_staff_assignments)
            VALUES(@id,@lot,@user,@role,@from,@until,@delegation);
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,created_at)
            VALUES(gen_random_uuid(),@lot,@actor,'USER','ASSIGN_STAFF','ASSIGNMENT',@entity,now());
            """, connection, tx);
        command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("lot", request.LotId); command.Parameters.AddWithValue("user", request.UserId);
        command.Parameters.AddWithValue("role", request.Role); command.Parameters.AddWithValue("from", request.ActiveFrom.UtcDateTime);
        command.Parameters.AddWithValue("until", NpgsqlTypes.NpgsqlDbType.TimestampTz, (object?)request.ActiveTo?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("delegation", request.CanManageStaffAssignments); command.Parameters.AddWithValue("actor", actorId);
        command.Parameters.AddWithValue("entity", id.ToString());
        await command.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct); return id;
    }

    public async Task BootstrapAsync(CancellationToken ct)
    {
        var email = config["Bootstrap:Email"]; var password = config["Bootstrap:Password"];
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password)) return;
        if (config["ASPNETCORE_ENVIRONMENT"] != "Development") throw new InvalidOperationException("Bootstrap is Development-only");
        if (password.Length is < 12 or > 128) throw new InvalidOperationException("Bootstrap password must contain 12–128 characters");
        await using var connection = await db.OpenConnectionAsync(ct); await using var tx = await connection.BeginTransactionAsync(ct);
        await using var existing = new NpgsqlCommand("SELECT id FROM app_users WHERE email_normalized=@email", connection, tx);
        existing.Parameters.AddWithValue("email", Email(email)); var old = await existing.ExecuteScalarAsync(ct);
        if (old is Guid oldId)
        {
            await using var role = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM platform_user_roles WHERE user_id=@id AND role_code='ADMIN')", connection, tx);
            role.Parameters.AddWithValue("id", oldId);
            if (!(bool)(await role.ExecuteScalarAsync(ct))!) throw new InvalidOperationException("Bootstrap cannot promote an existing customer");
            await tx.CommitAsync(ct); return;
        }
        var id = Guid.NewGuid();
        await using var insert = new NpgsqlCommand("""
            INSERT INTO app_users(id,email_normalized,full_name,password_hash,status,created_at,updated_at)
            VALUES(@id,@email,'Development Administrator',@hash,'ACTIVE',now(),now());
            INSERT INTO platform_user_roles(user_id,role_code) VALUES(@id,'ADMIN');
            """, connection, tx);
        insert.Parameters.AddWithValue("id", id); insert.Parameters.AddWithValue("email", Email(email)); insert.Parameters.AddWithValue("hash", PasswordHash.Create(password));
        await insert.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
    }
}
