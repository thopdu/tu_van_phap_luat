import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Copy, 
  Check, 
  FileDown, 
  Pin, 
  Trash2, 
  Clock, 
  BookOpen, 
  ChevronRight,
  Sparkles,
  Search,
  MessageCircle,
  HelpCircle,
  Hash,
  Plus,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { ChatSession, ChatMessage, DocumentFile, CitationSource } from '../types';

interface ChatBoxProps {
  documents: DocumentFile[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onTogglePinSession: (id: string) => void;
  showSidebar?: boolean;
}

export default function ChatBox({
  documents,
  onSendMessage,
  isLoading,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onTogglePinSession,
  showSidebar = true
}: ChatBoxProps) {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportSessionToPDF = () => {
    if (!activeSession) return;
    
    // Create print window with elegant styled sheet
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Vui lòng cho phép thiết bị hiển thị popup để xuất PDF/Bản in.');
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>${activeSession.title}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #171717; padding: 40px; margin: 0; max-width: 800px; mx-auto; }
            h1 { font-size: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 15px; margin-bottom: 25px; color: #111; }
            .date { color: #666; font-size: 12px; margin-bottom: 30px; }
            .message-block { margin-bottom: 35px; page-break-inside: avoid; }
            .role { font-weight: bold; font-size: 13px; text-transform: uppercase; color: #555; margin-bottom: 8px; letter-spacing: 0.5px; }
            .content { font-size: 15px; border-left: 3px solid #e5e5e5; padding-left: 15px; margin-left: 5px; }
            .content p { margin: 0 0 10px 0; }
            .references { background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eeeeee; margin-top: 15px; font-size: 12px; }
            .references h4 { margin: 0 0 8px 0; color: #222; }
            .ref-item { margin-bottom: 6px; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>${activeSession.title}</h1>
          <div class="date">Thời gian xuất bản: ${new Date().toLocaleString('vi-VN')}</div>
          
          ${activeSession.messages.map(msg => `
            <div class="message-block">
              <div class="role">${msg.role === 'user' ? 'Người dùng' : 'Trợ lý Tư vấn Quy định RAG'}</div>
              <div class="content">
                ${msg.content.replace(/\n/g, '<br/>')}
              </div>
              
              ${msg.references && msg.references.length > 0 ? `
                <div class="references">
                  <h4>Tài liệu tham chiếu RAG:</h4>
                  ${msg.references.map((ref, idx) => `
                    <div class="ref-item">
                      <strong>[${idx + 1}] ${ref.fileName}</strong> 
                      ${ref.page ? `• ${ref.page}` : ''} 
                      ${ref.section ? `• ${ref.section}` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
          
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleTemplateClick = (prompt: string) => {
    setInputText(prompt);
  };

  // Predefined prompts for Vietnam Legal Regulations context
  const suggestionTemplates = [
    {
      title: "Luật An ninh mạng",
      desc: "So sánh Luật An ninh mạng và Luật An toàn thông tin mạng",
      text: "Hãy so sánh chi tiết Luật An ninh mạng 2018 và Luật An toàn thông tin mạng 2015 dựa trên tài liệu đã tải lên."
    },
    {
      title: "Tóm tắt Thông tư 12",
      desc: "Tóm tắt các yêu cầu của Thông tư 12/2022/TT-BTTTT",
      text: "Hãy tóm tắt ngắn gọn các yêu cầu then chốt có trong Thông tư 12/2022/TT-BTTTT về bảo mật thông tin."
    },
    {
      title: "Checklist cấp độ 2",
      desc: "Sinh danh mục checklist đánh giá hệ thống cấp độ 2",
      text: "Dựa vào Thông tư 12/2022, hãy lập bảng checklist đánh giá bảo đảm an toàn hệ thống thông tin cấp độ 2."
    },
    {
      title: "Mô hình cho xã",
      desc: "Đề xuất kiến trúc mạng và bảo mật cho cấp UBND xã",
      text: "Hãy đề xuất giải pháp kiến trúc mạng và bảo mật an toàn thông tin áp dụng cho UBND xã theo đúng các nghị định hướng dẫn."
    }
  ];

  // Search through all past conversation sessions
  const filteredSessions = sessions.filter(session => {
    return session.title.toLowerCase().includes(historySearchTerm.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-row h-full overflow-hidden" id="chatbox-pane">
      
      {/* Thread/Session Sidebar inside ChatGPT pane (200px equivalent) */}
      <div className="hidden md:flex w-60 border-r border-slate-200 sidebar-gradient flex-col h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <button
            onClick={onNewSession}
            className="w-full py-2.5 px-3 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border-2 border-dashed border-blue-200 shadow-2xs flex items-center justify-center gap-1.5 transition active:scale-98"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            Hội thoại mới RAG
          </button>
        </div>

        {/* Search Session Area */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm lịch sử hội thoại..."
              value={historySearchTerm}
              onChange={(e) => setHistorySearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-slate-300 transition-all font-medium"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredSessions.length === 0 ? (
            <p className="text-center text-[11px] text-slate-400 mt-6 font-medium">Không tìm thấy hội thoại</p>
          ) : (
            filteredSessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => onSelectSession(sess.id)}
                className={`group p-2.5 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-all ${
                  sess.id === activeSessionId
                    ? 'bg-blue-50/80 border border-blue-100 font-bold text-blue-900 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden mr-2">
                  <MessageCircle className={`w-3.5 h-3.5 shrink-0 ${sess.id === activeSessionId ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="truncate">{sess.title}</span>
                </div>
                
                {/* Thread action buttons (Pin, Delete) */}
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinSession(sess.id);
                    }}
                    className={`p-1 rounded hover:bg-slate-250 transition ${sess.isPinned ? 'text-blue-700' : 'text-slate-400'}`}
                    title={sess.isPinned ? "Bỏ ghim" : "Ghim"}
                  >
                    <Pin className={`w-3 h-3 ${sess.isPinned ? 'fill-blue-600 text-blue-600' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionToDeleteId(sess.id);
                    }}
                    className="p-1 rounded hover:bg-slate-250 text-slate-400 hover:text-red-500 transition"
                    title="Xóa hội thoại"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {sess.isPinned && sess.id !== activeSessionId && (
                  <Pin className="w-2.5 h-2.5 text-slate-400 fill-slate-400 shrink-0 select-none group-hover:hidden" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Primary Chat Box Section */}
      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] relative overflow-hidden">
        
        {/* Chat Box Header area showing connection state and general document count */}
        <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-xs shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-blue-100 p-2 rounded-full">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h3 className="font-bold text-slate-850 text-sm leading-tight flex items-center gap-1.5">
                Trợ lý tư vấn quy định
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {documents.filter(d => d.status === 'indexed').length} Tài liệu đã lập chỉ mục • Gemini AI Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSession && activeSession.messages.length > 0 && (
              <button
                onClick={exportSessionToPDF}
                className="py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-250 hover:border-slate-350 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
                title="Xuất lịch sử chat thành PDF bảo mật"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                Tải báo cáo PDF
              </button>
            )}
            
            {/* Small screen thread toggler */}
            <button
              onClick={onNewSession}
              className="md:hidden p-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 block shrink-0"
              title="Cuộc gọi mới"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter questions by target documents in realtime query (Optional) */}
        {documents.filter(d => d.status === 'indexed').length > 0 && (
          <div className="px-6 py-2 bg-white border-b border-slate-100 flex items-center gap-3 overflow-x-auto select-none shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">PHẠM VI TRA CỨU RAG:</span>
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedFileIds([])}
                className={`px-3 py-1 text-[10px] rounded-full border transition-all font-semibold uppercase tracking-wider whitespace-nowrap ${
                  selectedFileIds.length === 0
                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                TẤT CẢ ({documents.filter(d => d.status === 'indexed').length})
              </button>
              {documents.filter(d => d.status === 'indexed').map(doc => {
                const isSelected = selectedFileIds.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFileIds(selectedFileIds.filter(id => id !== doc.id));
                      } else {
                        setSelectedFileIds([...selectedFileIds, doc.id]);
                      }
                    }}
                    className={`px-3 py-1 text-[10px] rounded-full border transition-all flex items-center gap-1 truncate ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    style={{ maxWidth: '160px' }}
                  >
                    <BookOpen className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversational Screen */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar bg-[#f8fafc]">
          {!activeSession || activeSession.messages.length === 0 ? (
            
            // Onboarding layout if empty chat history
            <div className={`mx-auto py-12 text-center space-y-6 transition-all duration-300 ${showSidebar ? 'max-w-xl' : 'max-w-4xl'}`}>
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Bot className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Hệ Thống RAG Tri Thức Trợ Lý Pháp Lý</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Truy vấn văn bản và quy định pháp lý an toàn thông tin bảo mật. Hệ thống RAG trả lời chính xác dựa trên tài liệu được tải lên, cung cấp trích dẫn nguồn rành mạch và nói không với tự ý suy diễn.
                </p>
              </div>
            </div>
          ) : (
            
            // Loop chat messages
            <div className={`space-y-8 mx-auto transition-all duration-300 ${showSidebar ? 'max-w-3xl' : 'max-w-5xl'}`}>
              {activeSession.messages.map((message) => {
                const isAI = message.role === 'model';
                return (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${isAI ? 'justify-start' : 'justify-end'}`}
                  >
                    {/* Chat Bubble card container */}
                    <div className={`max-w-[85%] flex flex-col gap-1.5`}>
                      <div
                        className={`text-sm leading-relaxed ${
                          isAI
                            ? 'message-ai p-6 rounded-2xl rounded-tl-none'
                            : 'bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-lg font-medium'
                        }`}
                      >
                        {isAI && (
                          <div className="flex items-center gap-2 mb-3 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <Bot className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
                            Phản hồi từ AI
                          </div>
                        )}

                        {/* Message content parsed natively */}
                        <div className="whitespace-pre-wrap select-text break-words">
                          {message.content}
                        </div>

                        {/* RAG Citation Sources in AI response */}
                        {isAI && message.references && message.references.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                              Nguồn trích dẫn tham chiếu RAG:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {message.references.map((ref, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-slate-300 transition-all"
                                >
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                  <span className="text-[12px] font-bold text-slate-700 truncate" style={{ maxWidth: '150px' }} title={ref.fileName}>
                                    {ref.fileName}
                                  </span>
                                  {(ref.page || ref.section) && (
                                    <span className="text-[10px] text-slate-400">
                                      | {ref.page || ref.section}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Small actions underneath text bubble */}
                      <div
                        className={`flex gap-2 text-[10px] text-slate-400 px-1 items-center font-medium ${
                          isAI ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <span>{message.timestamp}</span>
                        {isAI && (
                          <>
                            <span>•</span>
                            <button
                              onClick={() => copyToClipboard(message.id, message.content)}
                              className="hover:text-blue-600 font-bold flex items-center gap-0.5 transition-colors"
                              title="Sao chép câu trả lời"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Đã sao chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-450" />
                                  <span>Sao chép</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Prompt loader */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] message-ai p-6 rounded-2xl rounded-tl-none flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      RAG đang xử lý tài liệu liên quan...
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Hệ thống đang thực hiện tìm kiếm vector RAG, tổng hợp văn bản liên quan và nạp ngữ cảnh vào mô hình Gemini AI...
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat input box footer */}
        <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0">
          <form onSubmit={handleSend} className={`mx-auto flex gap-4 relative items-center transition-all duration-300 ${showSidebar ? 'max-w-4xl' : 'max-w-5xl'}`}>
            <div className="flex-1 relative">
              <input
                type="text"
                required
                disabled={isLoading}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  documents.filter(d => d.status === 'indexed').length === 0
                    ? "Vui lòng tải lên tài liệu quy chế ở cột bên trái trước..."
                    : "Hỏi tôi bất cứ điều gì về các văn bản đã tải lên..."
                }
                className="w-full pl-5 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium transition-all"
                id="chat-input-text"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim() || documents.filter(d => d.status === 'indexed').length === 0}
                className="absolute right-3 top-2 p-1.5 text-blue-600 disabled:text-slate-400 hover:bg-blue-50 rounded-lg transition-all"
                title="Gửi câu hỏi"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
          <p className="text-center text-[10px] text-slate-400 mt-3 font-medium uppercase tracking-wider">
            Cảnh báo: AI chỉ trả lời dựa trên kho tài liệu đã cung cấp. Không tự ý suy diễn.
          </p>
        </div>
      </div>

      {/* Custom Confirmation Modal for Safe Conversation Deletion (unaffected by iframe restrictions) */}
      {sessionToDeleteId !== null && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Xác nhận xóa hội thoại
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                  Bạn có đồng ý xóa toàn bộ lịch sử trò chuyện của phiên làm việc này không? Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDeleteId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sessionToDeleteId) {
                    onDeleteSession(sessionToDeleteId);
                  }
                  setSessionToDeleteId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-md transition"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
