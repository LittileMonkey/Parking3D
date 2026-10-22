namespace Parking.Identity.Application.DTOs
{
    public class LotsAssignmentDto
    {
        private Guid id;

        public Guid AssignmentId { get; init; }

        public Guid LotId { get; init; }

        public string RoleCode { get; init; } = string.Empty;

        public DateTime ValidFrom { get; init; }

        public DateTime? ValidUntil { get; init; }

        public bool CanManageStaffAssignments { get; init; }

        public LotsAssignmentDto() { }
        public LotsAssignmentDto(Guid id, Guid lotId, string roleCode, DateTime validFrom, DateTime? validUntil, bool canManageStaffAssignments)
        {
            this.id = id;
            LotId = lotId;
            RoleCode = roleCode;
            ValidFrom = validFrom;
            ValidUntil = validUntil;
            CanManageStaffAssignments = canManageStaffAssignments;
        }
    }
}
