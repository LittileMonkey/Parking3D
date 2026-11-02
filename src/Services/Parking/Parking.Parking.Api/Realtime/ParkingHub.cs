using Microsoft.AspNetCore.SignalR;

namespace Parking.Parking.Api.Realtime;

// Same public data as availability: event ID, lot ID, slot ID and status; no plates/users/session IDs.
public sealed class ParkingHub : Hub;
