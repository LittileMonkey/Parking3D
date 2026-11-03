using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.CheckOut.Queries;

/// <summary>
/// Query tra cứu phiên đỗ, đối soát biển số và tính cước phí phát sinh tại cổng ra.
/// </summary>
public sealed record GetCheckOutQuoteQuery(Guid ActorId, CheckOutQuoteRequestDto Request)
    : IRequest<CheckOutQuoteResultDto>;
