namespace Parking.Parking.Domain;

/// <summary>
/// Chuẩn hóa 3 loại phương tiện (Ô tô thường, Ô tô điện EV, Xe máy) trong khi giữ bảng vehicle_types ở 2 mã gốc (CAR, MOTORBIKE).
/// Ô tô điện được phân biệt bằng tính năng ô EV_CHARGING và fuel_type = ELECTRIC.
/// </summary>
public static class VehicleTypeRules
{
    public const string Car = "CAR";
    public const string Motorbike = "MOTORBIKE";
    public const string Ev = "EV";
    public const string ElectricFuel = "ELECTRIC";
    public const string FlatBlockRule = "FLAT_BLOCK";
    public const string FlatBlockEvRule = "FLAT_BLOCK_EV";

    public readonly record struct ResolvedVehicleType(string BaseVehicleType, bool IsEv, string ApiCode)
    {
        public string PricingRuleType => IsEv ? FlatBlockEvRule : FlatBlockRule;
        public string DefaultFuelType => IsEv ? ElectricFuel : "GASOLINE";
    }

    public static bool TryResolve(string? value, out ResolvedVehicleType resolved)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        switch (normalized)
        {
            case "CAR":
                resolved = new ResolvedVehicleType(Car, false, Car);
                return true;
            case "EV" or "ELECTRIC" or "ELECTRIC_CAR" or "ELECTRICCAR" or "ELECTRICVEHICLE" or "ELECTRIC_VEHICLE":
                resolved = new ResolvedVehicleType(Car, true, Ev);
                return true;
            case "MOTORBIKE" or "MOTORCYCLE" or "BIKE":
                resolved = new ResolvedVehicleType(Motorbike, false, Motorbike);
                return true;
            default:
                resolved = default;
                return false;
        }
    }

    public static bool IsElectricVehicle(string? baseVehicleType, string? fuelType) =>
        string.Equals(baseVehicleType, Car, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(fuelType, ElectricFuel, StringComparison.OrdinalIgnoreCase);

    public static string ToDisplayApiCode(string baseVehicleType, string? fuelType) =>
        IsElectricVehicle(baseVehicleType, fuelType) ? Ev : baseVehicleType;
}
