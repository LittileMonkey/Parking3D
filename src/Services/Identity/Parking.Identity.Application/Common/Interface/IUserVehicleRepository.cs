using Parking.Identity.Domain.Entities;
namespace Parking.Identity.Application.Common.Interface
{
    public interface IUserVehicleRepository
    {
        Task<List<UserVehicle>> GetUserVehiclesByUserIdAsync(Guid userId, CancellationToken cancellationToken);
        Task<UserVehicle?> GetVehicleByIdAsync(Guid userId, Guid vehicleId, CancellationToken cancellationToken);
        Task<int> CountByUserIdAsync(Guid userId, CancellationToken cancellationToken);
        Task<bool> ExistsLicensePlateAsync(Guid userId, string licensePlate, Guid? excludeVehicleId, CancellationToken cancellationToken);
        Task AddVehicleAsync(UserVehicle userVehicle, CancellationToken cancellationToken);
        void UpdateUserVehicle(UserVehicle userVehicle);
        void RemoveUserVehicle(UserVehicle userVehicle);
        Task<UserVehicle?> GetDefaultUserVehicleAsync(Guid userId, CancellationToken cancellationToken);
    }
}
