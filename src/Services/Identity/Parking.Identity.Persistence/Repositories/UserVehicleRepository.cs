using Microsoft.EntityFrameworkCore;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence.DataAccessLayer;

namespace Parking.Identity.Persistence.Repositories
{
    public class UserVehicleRepository : IUserVehicleRepository
    {
        private readonly ParkingDatabaseV4Context context;
        public UserVehicleRepository(ParkingDatabaseV4Context context)
        {
            this.context = context;
        }
        public async Task AddVehicleAsync(UserVehicle userVehicle, CancellationToken cancellationToken)
        {
            await context.UserVehicles.AddAsync(userVehicle, cancellationToken);
        }

        public Task<int> CountByUserIdAsync(Guid userId, CancellationToken cancellationToken)
        {
            return context.UserVehicles.CountAsync(x => x.UserId == userId, cancellationToken);
        }

        public Task<bool> ExistsLicensePlateAsync(Guid userId,string licensePlate,Guid? excludeVehicleId,CancellationToken cancellationToken)
        {
            return context.UserVehicles.AnyAsync(
                x => x.UserId == userId
                     && x.LicensePlate == licensePlate
                     && (!excludeVehicleId.HasValue
                         || x.Id != excludeVehicleId.Value),
                cancellationToken);
        }

        public Task<UserVehicle?> GetDefaultUserVehicleAsync(Guid userId, CancellationToken cancellationToken)
        {
            return context.UserVehicles.FirstOrDefaultAsync(
                x => x.UserId == userId && x.IsDefault, cancellationToken);
        }

        public Task<List<UserVehicle>> GetUserVehiclesByUserIdAsync(Guid userId, CancellationToken cancellationToken)
        {
            return context.UserVehicles
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.IsDefault)
                .ThenByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public Task<UserVehicle?> GetVehicleByIdAsync(Guid userId, Guid vehicleId, CancellationToken cancellationToken)
        {
            return context.UserVehicles.FirstOrDefaultAsync(x => x.UserId == userId && x.Id == vehicleId, cancellationToken);
        }

        public void RemoveUserVehicle(UserVehicle userVehicle)
        {
            context.UserVehicles.Remove(userVehicle);
        }

        public void UpdateUserVehicle(UserVehicle userVehicle)
        {
            context.UserVehicles.Update(userVehicle);
        }
    }
}
