using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Application.DTOs
{
    public class SearchParkingLotsResultDto
    {
        public int TotalCount { get; set; }
        public List<ParkingLotItemDto> Items { get; set; } = new();
    }

}
