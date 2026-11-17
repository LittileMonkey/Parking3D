import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  Radio,
} from "lucide-react";
import { api } from "../../services/api";
import "./AiChatbotWidget.css";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}

const QUICK_PROMPTS = [
  "Bãi xe nào còn chỗ gần nhất?",
  "Giá gửi ô tô và xe máy bao nhiêu?",
  "Chính sách giữ chỗ 5 phút hoạt động thế nào?",
  "Tôi muốn tìm bãi có trạm sạc điện EV",
];

export default function AiChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: "welcome-1",
        sender: "bot",
        text: "Xin chào! Tôi là Trợ lý ảo ParkMatrix AI (Gemini Engine). Bạn cần tìm bãi đỗ xe, tra cứu biểu phí hay cần hỗ trợ gì hôm nay?",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    return sessionStorage.getItem("parkmatrix_ai_session_id") || "";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isTyping) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await api.chatWithAiAssistant({
        message: textToSend,
        sessionId: sessionId || undefined,
      });

      if (response.sessionId) {
        setSessionId(response.sessionId);
        sessionStorage.setItem("parkmatrix_ai_session_id", response.sessionId);
      }

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: response.replyMessage,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        suggestedActions: response.suggestedActions,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: err instanceof Error ? err.message : "Hiện tại dịch vụ AI đang bận hoặc chưa có kết nối tới cổng :5004. Vui lòng thử lại sau.",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetSession = async () => {
    if (sessionId) {
      try {
        await api.resetAiAssistantSession(sessionId);
      } catch {
        // Ignore reset error
      }
    }
    sessionStorage.removeItem("parkmatrix_ai_session_id");
    setSessionId("");
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "bot",
        text: "Đã làm mới cuộc trò chuyện. Tôi có thể giúp gì cho chuyến đi tiếp theo của bạn?",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="ai-widget-container">
      {/* ── Chat Window Box ── */}
      {isOpen && (
        <div className="ai-widget-window">
          {/* Header */}
          <div className="ai-widget-header">
            <div className="ai-widget-header-title">
              <div className="ai-widget-avatar">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="ai-widget-title-text">
                  Trợ Lý Ảo ParkMatrix
                </h3>
                <span className="ai-widget-subtitle">
                  <Radio size={10} color="#34d399" />
                  Gemini LLM • Domain Guardrails
                </span>
              </div>
            </div>

            <div className="ai-widget-header-actions">
              <button
                type="button"
                className="ai-widget-btn-icon"
                onClick={handleResetSession}
                title="Làm mới hội thoại"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                className="ai-widget-btn-icon"
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="ai-widget-suggestions">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="ai-widget-chip"
                onClick={() => handleSend(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="ai-widget-body">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`ai-msg ${msg.sender === "user" ? "ai-msg-user" : "ai-msg-bot"}`}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                  {msg.sender === "bot" && (
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7", marginTop: "2px", flexShrink: 0 }}>
                      <Bot size={13} />
                    </div>
                  )}
                  <div className="ai-msg-bubble">
                    {msg.text}
                  </div>
                  {msg.sender === "user" && (
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", marginTop: "2px", flexShrink: 0 }}>
                      <User size={13} />
                    </div>
                  )}
                </div>
                <span className="ai-msg-time">{msg.timestamp}</span>

                {/* Suggested follow-up actions */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px", marginLeft: "26px" }}>
                    {msg.suggestedActions.map((act, i) => (
                      <button
                        key={i}
                        type="button"
                        className="ai-widget-chip"
                        style={{ fontSize: "0.7rem", padding: "3px 8px" }}
                        onClick={() => handleSend(act)}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="ai-msg ai-msg-bot">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7" }}>
                    <Bot size={13} />
                  </div>
                  <div className="ai-msg-bubble" style={{ padding: "8px 12px" }}>
                    <div className="ai-typing-indicator">
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="ai-widget-footer">
            <form
              className="ai-widget-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                type="text"
                className="ai-widget-input"
                placeholder="Hỏi AI về bãi xe, biểu phí, quy định..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isTyping}
              />
              <button
                type="submit"
                className="ai-widget-send-btn"
                disabled={!input.trim() || isTyping}
                title="Gửi câu hỏi"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Floating Launcher Button ── */}
      <button
        type="button"
        className="ai-widget-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? "Thu nhỏ trợ lý AI" : "Mở Trợ lý ảo ParkMatrix AI"}
        aria-label="Trợ lý ảo AI"
      >
        {isOpen ? <X size={22} /> : <Sparkles size={22} />}
        {!isOpen && <span className="ai-widget-trigger-badge">AI</span>}
      </button>
    </div>
  );
}
