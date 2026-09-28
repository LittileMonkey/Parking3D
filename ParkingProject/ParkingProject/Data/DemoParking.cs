using ParkingProject.Domain;

namespace ParkingProject.Data;

public static class DemoParking
{
    public static IEnumerable<ParkingSlot> CreateSlots()
    {
        for (var floor = 1; floor <= 3; floor++)
        {
            var count = floor == 1 ? 1000 : 500;
            for (var number = 1; number <= count; number++)
                yield return new ParkingSlot
                {
                    Id = $"F{floor:00}-A{number:0000}",
                    Floor = $"F{floor:00}", Zone = $"F{floor:00}-A",
                    VehicleType = floor == 1 ? VehicleType.MOTORBIKE : VehicleType.CAR,
                    SlotType = SlotType.NORMAL, Status = SlotStatus.AVAILABLE,
                    ExitOrder = number
                };
        }
    }
}
