using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.CheckOut.Queries;

/// <summary>
/// Handler điều phối xác thực quyền bãi đỗ và tra cứu cước phí xuất bãi.
/// </summary>
public sealed class GetCheckOutQuoteQueryHandler(
    IParkingRepository repository,
    IFacilityAccess access)
    : IRequestHandler<GetCheckOutQuoteQuery, CheckOutQuoteResultDto>
{
    public async Task<CheckOutQuoteResultDto> Handle(GetCheckOutQuoteQuery query, CancellationToken ct)
    {
        // 1. Xác thực quyền hạn nhân viên tại bãi xe qua Identity gRPC trước khi truy vấn DB
        await access.RequireAsync(query.ActorId, query.Request.LotId, "CHECK_IN", ct);

        // 2. Gọi repository tra cứu session ACTIVE, đối soát biển số và tính cước
        return await repository.GetCheckOutQuoteAsync(
            query.Request.LotId,
            query.Request.GateId,
            query.Request.DetectedPlate,
            query.Request.QrPayload,
            ct);
    }
}
