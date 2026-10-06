using ParkingSystem.Domain.Common;

namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Thực thể tài liệu hướng dẫn bãi đỗ xe cho AI Assistant (bảng assistant_documents)
/// </summary>
public class AssistantDocument : BaseEntity
{
    public Guid? LotId { get; set; }
    public string DocumentKey { get; set; } = string.Empty;
    public int Revision { get; set; } = 1;
    public string Title { get; set; } = string.Empty;
    public string Language { get; set; } = "vi";
    public string Visibility { get; set; } = "PUBLIC";
    public string Status { get; set; } = "PUBLISHED"; // DRAFT, PUBLISHED, ARCHIVED
    public string SourceReference { get; set; } = string.Empty;
    public Guid? ApprovedBy { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset EffectiveFrom { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EffectiveUntil { get; set; }
    public int Version { get; set; } = 1;

    public ICollection<AssistantDocumentChunk> Chunks { get; set; } = new List<AssistantDocumentChunk>();
}

/// <summary>
/// Các phân đoạn nội dung tài liệu phục vụ truy xuất RAG của Assistant (bảng assistant_document_chunks)
/// </summary>
public class AssistantDocumentChunk : BaseEntity
{
    public Guid DocumentId { get; set; }
    public AssistantDocument? Document { get; set; }
    public int ChunkIndex { get; set; }
    public string SectionTitle { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
}
