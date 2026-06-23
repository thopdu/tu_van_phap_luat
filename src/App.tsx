import React, { useState, useEffect } from 'react';
import { initAuth, googleSignIn, logout } from './auth';
import { User } from 'firebase/auth';
import { DocumentFile, ChatSession, ChatMessage } from './types';
import RegulationSidebar from './components/RegulationSidebar';
import ChatBox from './components/ChatBox';
import { 
  ShieldAlert, 
  Sparkles, 
  LogOut, 
  FileLock2, 
  Cpu, 
  Terminal, 
  Database, 
  Activity, 
  Settings, 
  Layers,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Bookmark,
  Users,
  UserCheck,
  Shield,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Toggle sidebar state
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  
  // Custom user role states
  const [userRole, setUserRole] = useState<'user' | 'editor'>('user');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showUserManagement, setShowUserManagement] = useState<boolean>(false);
  const [isUpdatingUserRole, setIsUpdatingUserRole] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingQuery, setIsLoadingQuery] = useState(false);
  
  // Custom non-blocking visual notification system
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Conversational sessions (thread states) stored locally
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('rag_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Sync sessions with localStorage
  useEffect(() => {
    localStorage.setItem('rag_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Set initial active session if exists
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      // Find pinned session, otherwise first
      const sorted = [...sessions].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
      setActiveSessionId(sorted[0].id);
    }
  }, [sessions, activeSessionId]);

  // Initialize firebase auth on load
  useEffect(() => {
    initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setToken(null);
      }
    );
  }, []);

  // Fetch indexed documents list
  const fetchDocuments = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;

    try {
      const res = await fetch('/api/files', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách tài liệu:', err);
    }
  };

  // Fetch the logged-in user profile & role
  const fetchUserProfile = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;

    try {
      const res = await fetch('/api/session/profile', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.user.role || 'user');
        setIsAdmin(!!data.isAdmin);
        
        // If they are admin, fetch user directory automatically
        if (data.isAdmin) {
          fetchAndSetAllUsers(activeToken);
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  // Fetch user directory for management (Admin only)
  const fetchAndSetAllUsers = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;

    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error('Error fetching registered user list:', err);
    }
  };

  // Action update target role (Admin only)
  const handleUpdateUserRole = async (targetUid: string, nextRole: 'user' | 'editor') => {
    if (!token) return;
    setIsUpdatingUserRole(targetUid);
    try {
      const res = await fetch(`/api/admin/users/${targetUid}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: nextRole })
      });

      if (res.ok) {
        showNotification('Cập nhật vai trò người dùng thành công.', 'success');
        fetchAndSetAllUsers(token);
      } else {
        const errData = await res.json();
        showNotification(`Lỗi cập nhật: ${errData.error}`, 'error');
      }
    } catch (err) {
      showNotification('Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setIsUpdatingUserRole(null);
    }
  };

  // Poll processing files to update indexing progress
  useEffect(() => {
    if (!token) return;

    const hasProcessing = documents.some(doc => doc.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, token]);

  // Handle immediate documents load on auth
  useEffect(() => {
    if (token) {
      fetchDocuments(token);
      fetchUserProfile(token);
    }
  }, [token]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setNeedsAuth(false);
        fetchDocuments(res.accessToken);
        fetchUserProfile(res.accessToken);
      }
    } catch (err) {
      console.error('Đăng nhập thất bại:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setDocuments([]);
  };

  // Upload document files to Express backend which handles Drive and Parsing
  const handleUpload = async (files: FileList) => {
    if (!token) return;
    setIsUploading(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      // Optimistic layout generation: append temporary loading indicators
      const tempDocs: DocumentFile[] = Array.from(files).map((f, i) => ({
        id: `temp_${Date.now()}_${i}`,
        name: f.name,
        size: f.size,
        uploadDate: new Date().toISOString(),
        status: 'processing',
        statusProgress: 10,
        type: f.name.split('.').pop() || 'txt'
      }));
      setDocuments(prev => [...prev, ...tempDocs]);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Lỗi hệ thống tải lên');
      }

      // Refresh list
      await fetchDocuments();
    } catch (err: any) {
      showNotification(`Không thể tải lên thành công: ${err.message}`, 'error');
      await fetchDocuments();
    } finally {
      setIsUploading(false);
    }
  };

  // Delete an indexed document file
  const handleDeleteDocument = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
        showNotification('Đã xóa tài liệu quy chuẩn thành công.', 'success');
      } else {
        const errData = await res.json();
        showNotification(`Lỗi khi xóa: ${errData.error}`, 'error');
      }
    } catch (err) {
      console.error('Lỗi delete file:', err);
    }
  };

  // Free completely local database values
  const handleClearDatabase = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/files/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setDocuments([]);
        showNotification('Đã xóa sạch cơ sở dữ liệu vector RAG thành công.', 'success');
      }
    } catch (err) {
      console.error('Lỗi khi xóa DB:', err);
    }
  };

  // Send chatbot query
  const handleSendMessage = async (text: string) => {
    if (!token || !text.trim()) return;

    // 1. Create a session if not active
    let currentSessionId = activeSessionId;
    let currentSessions = [...sessions];
    
    if (!currentSessionId) {
      const newSession: ChatSession = {
        id: `sess_${Date.now()}`,
        title: text.length > 25 ? `${text.substring(0, 25)}...` : text,
        messages: [],
        isPinned: false,
        createdAt: new Date().toISOString()
      };
      currentSessions.push(newSession);
      currentSessionId = newSession.id;
      setSessions(currentSessions);
      setActiveSessionId(currentSessionId);
    }

    const activeSessionIndex = currentSessions.findIndex(s => s.id === currentSessionId);
    if (activeSessionIndex === -1) return;

    // 2. Append User Message
    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    const sessionCopy = { ...currentSessions[activeSessionIndex] };
    sessionCopy.messages = [...sessionCopy.messages, userMessage];
    
    // Update title optimistic if it was generic
    if (sessionCopy.title.startsWith('Hội thoại') || sessionCopy.messages.length === 1) {
      sessionCopy.title = text.length > 25 ? `${text.substring(0, 25)}...` : text;
    }

    currentSessions[activeSessionIndex] = sessionCopy;
    setSessions(currentSessions);
    setIsLoadingQuery(true);

    try {
      // 3. Request Express Server
      const res = await fetch('/api/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: text,
          history: sessionCopy.messages.slice(0, -1), // skip current query
        })
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error || 'Máy chủ RAG phản hồi lỗi');
      }

      const replyData = await res.json();

      // 4. Append AI Answer with model citation refs
      const assistantMessage: ChatMessage = {
        id: `msg_model_${Date.now()}`,
        role: 'model',
        content: replyData.content,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        references: replyData.references || []
      };

      const updatedSessions = [...sessions];
      const activeIdx = updatedSessions.findIndex(s => s.id === currentSessionId);
      if (activeIdx !== -1) {
        const liveCopy = { ...updatedSessions[activeIdx] };
        liveCopy.messages = [...liveCopy.messages, assistantMessage];
        updatedSessions[activeIdx] = liveCopy;
        setSessions(updatedSessions);
      }
    } catch (err: any) {
      // Get friendly message from server or fallback if network is down
      let displayError = err.message || 'Không thể thiết lập kết nối tới dịch vụ phản hồi.';
      
      const lowerErr = displayError.toLowerCase();
      if (lowerErr.includes('failed to fetch') || lowerErr.includes('network') || lowerErr.includes('fetch error')) {
        displayError = 'Kết nối mạng tới máy chủ dữ liệu bị gián đoạn. Quý cán bộ vui lòng kiểm tra lại đường truyền internet và thử bấm gửi lại câu hỏi.';
      } else if (lowerErr.includes('gemini_api_key') || lowerErr.includes('api key') || lowerErr.includes('api_key')) {
        displayError = 'Cấu hình bảo mật lỗi: Khóa máy chủ AI (GEMINI_API_KEY) chưa được thiết lập hoặc không chính xác trên máy chủ. Vui lòng liên hệ Ban quản trị để xử lý!';
      }

      // Append an AI bubble indicating system RAG failure with elegant warning
      const errorMessage: ChatMessage = {
        id: `msg_model_err_${Date.now()}`,
        role: 'model',
        content: `⚠️ **Thông báo hệ thống:** ${displayError}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      const updatedSessions = [...sessions];
      const activeIdx = updatedSessions.findIndex(s => s.id === currentSessionId);
      if (activeIdx !== -1) {
        const liveCopy = { ...updatedSessions[activeIdx] };
        liveCopy.messages = [...liveCopy.messages, errorMessage];
        updatedSessions[activeIdx] = liveCopy;
        setSessions(updatedSessions);
      }
    } finally {
      setIsLoadingQuery(false);
    }
  };

  // Create new blank conversation thread
  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `sess_${Date.now()}`,
      title: `Hội thoại mới #${sessions.length + 1}`,
      messages: [],
      isPinned: false,
      createdAt: new Date().toISOString()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const handleTogglePinSession = (id: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, isPinned: !s.isPinned };
      }
      return s;
    }));
  };

  // Google OAuth Authorization onboarding panel (Least privilege concept)
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6" id="welcome-screener">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6 flex flex-col items-center">
          
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg transform hover:rotate-6 transition-all duration-300">
            <Bookmark className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
              Hệ Thống Trợ Lý Pháp Lý RAG
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Trợ lý thông minh truy vấn văn bản, quy trình quyết định & quy chế an toàn thông tin dựa trên kỹ thuật Retrieval-Augmented Generation (RAG).
            </p>
          </div>

          <div className="w-full border-t border-slate-100 my-1"></div>

          {/* Scopes disclaimer list */}
          <div className="text-left bg-slate-50 p-5 rounded-xl border border-slate-150 w-full space-y-3 shadow-2xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HỆ THỐNG ĐỒNG BỘ & BẢO MẬT:</p>
            <div className="space-y-3.5 text-xs">
              <div className="flex gap-2.5 items-start text-slate-700">
                <FileText className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="leading-snug font-medium"><strong>Google Drive API Sync</strong>: Tải văn bản quy chế cá nhân lên lưu trữ Cloud và phân tích dữ liệu cục bộ bảo mật.</p>
              </div>
              <div className="flex gap-2.5 items-start text-slate-700">
                <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="leading-snug font-medium"><strong>Bảo mật RAG tuyệt đối</strong>: Trích xuất tri thức phục vụ riêng tác vụ của bạn, hoàn toàn ẩn khóa API đối với môi trường bên ngoài.</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-350 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:cursor-not-allowed cursor-pointer tracking-wider uppercase"
          >
            {isLoggingIn ? (
              <span className="flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 animate-spin" />
                Đang ủy quyền Google...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4.5 h-4.5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                Đăng nhập bằng tài khoản Google
              </span>
            )}
          </button>
          <p className="text-[10px] text-slate-400 font-medium">Bảo mật RAG tri thức cục bộ tối cao • Server protected</p>
        </div>
      </div>
    );
  }

  // Double columns dashboard layout (Sidebar 30% Width, ChatBox 70% Width)
  return (
    <div className="h-screen bg-[#f8fafc] flex flex-col overflow-hidden font-sans text-slate-800" id="main-application-frame">
      
      {/* Premium Admin Navigation Bar */}
      <nav className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between shadow-xs z-30 shrink-0 select-none">
        <div className="flex items-center gap-3">
          {/* Toggle Sidebar Button */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 mr-1 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-1.5 font-bold text-xs shadow-2xs"
            title={showSidebar ? "Thu gọn danh sách tài liệu RAG" : "Mở rộng danh sách tài liệu RAG"}
            id="toggle-sidebar-button"
          >
            {showSidebar ? (
              <>
                <ChevronLeft className="w-4 h-4 text-slate-650" />
                <span className="hidden sm:inline">Ẩn RAG</span>
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4 text-blue-600 animate-pulse" />
                <span className="hidden sm:inline text-blue-700">Hiện RAG</span>
              </>
            )}
          </button>

          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-850 tracking-tight flex items-center gap-1.5">
              Hệ thống RAG Trợ lý Pháp lý & Quyết định
              <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold py-0.5 px-2 rounded-full uppercase tracking-wider ml-1">v2.0 PRO</span>
            </span>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hệ thống Tư vấn theo Nghị định & Thông tư Nhà Nước</p>
          </div>
        </div>

        {/* User Account Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1.5 justify-end">
              {user?.displayName || 'Cán bộ Cơ quan'}
              <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-md ${
                userRole === 'editor' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {userRole === 'editor' ? 'Editor' : 'Reader'}
              </span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{user?.email || 'officer@agency.gov.vn'}</span>
          </div>

          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Hồ sơ người dùng"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full border border-slate-200 shadow-xs"
            />
          ) : (
            <div className="w-9 h-9 bg-blue-600 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {user?.displayName?.substring(0, 1) || 'U'}
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                setShowUserManagement(true);
                fetchAndSetAllUsers(token || undefined);
              }}
              className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer animate-pulse-soft"
              title="Quản lý & phân quyền thành viên"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Phân quyền</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </nav>

      {/* Main split screens Content area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <div 
          className={`h-full transition-all duration-300 ease-in-out overflow-hidden flex flex-col shrink-0 ${
            showSidebar 
              ? 'w-full lg:w-[30%] border-r border-slate-200 opacity-100' 
              : 'w-0 opacity-0 border-r-0 pointer-events-none'
          }`}
        >
          <RegulationSidebar
            documents={documents}
            onUpload={handleUpload}
            onDelete={handleDeleteDocument}
            isUploading={isUploading}
            onClearAll={handleClearDatabase}
            userRole={userRole}
          />
        </div>
        <ChatBox
          documents={documents}
          onSendMessage={handleSendMessage}
          isLoading={isLoadingQuery}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onTogglePinSession={handleTogglePinSession}
          showSidebar={showSidebar}
        />
      </main>

      {/* Admin User Management Modal Overlay */}
      {showUserManagement && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden border border-slate-200 divide-y divide-slate-100 max-h-[85vh]">
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5 bg-transparent">
                <div className="bg-amber-100 text-amber-800 p-2 rounded-lg">
                  <Users className="w-5 h-5 text-amber-750" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-tight">Phân quyền cán bộ hệ thống</h3>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Chọn quyền lực đọc / chỉnh sửa cho từng tài khoản</p>
                </div>
              </div>
              <button 
                onClick={() => setShowUserManagement(false)}
                className="text-slate-400 hover:text-slate-600 font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-xs"
              >
                Đóng
              </button>
            </div>

            {/* List Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3 min-h-[300px] max-h-[50vh]">
              {allUsers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center bg-transparent">
                  <Users className="w-10 h-10 text-slate-300 mb-2.5 animate-pulse" />
                  <p className="text-xs text-slate-500 font-bold">Chưa có người dùng nào khác đăng nhập vào hệ thống.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[320px]">Quyền mặc định của một cán bộ mới sau khi đăng nhập qua Google OAuth là Chế độ khách (Reader).</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 bg-transparent">
                  {allUsers.map((item) => (
                    <div key={item.uid} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50/80 transition-all">
                      
                      {/* Left: User information */}
                      <div className="flex items-center gap-3 bg-transparent">
                        {item.picture ? (
                          <img src={item.picture} alt={item.name} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border border-slate-200" />
                        ) : (
                          <div className="w-9 h-9 bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center rounded-full border border-blue-200">
                            {item.name?.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 leading-tight">
                            {item.name}
                            {item.email === 'pvantho@pdu.edu.vn' && (
                              <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1.5 py-0.25 rounded border border-red-200 uppercase">Admin</span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{item.email}</span>
                        </div>
                      </div>

                      {/* Right: Role picker selection option */}
                      <div className="flex items-center gap-2 bg-transparent">
                        {isUpdatingUserRole === item.uid ? (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping inline-block"></span>
                            Đang lưu...
                          </span>
                        ) : item.email === 'pvantho@pdu.edu.vn' ? (
                          <span className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-lg font-bold">
                            Quản trị viên chính
                          </span>
                        ) : (
                          <select
                            value={item.role}
                            onChange={(e) => handleUpdateUserRole(item.uid, e.target.value as 'user' | 'editor')}
                            className="bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-705 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer hover:border-slate-350 transition-colors"
                          >
                            <option value="user">Reader (Chỉ xem & chat)</option>
                            <option value="editor">Editor (Thêm, Sửa, Xóa)</option>
                          </select>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer informational */}
            <div className="px-6 py-4 bg-slate-50/80 text-[10px] text-slate-400 font-semibold uppercase leading-normal">
              * Lưu ý: Khi cán bộ được nâng quyền lên Editor, họ sẽ có quyền thêm tài liệu mới vào cơ sở dữ liệu RAG, cập nhật và xóa tài liệu.
            </div>

          </div>
        </div>
      )}

      {/* Custom Floating Notification Toasts */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-4 py-3 rounded-xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${
            notification.type === 'success' ? 'bg-emerald-500 shadow-emerald-200' :
            notification.type === 'error' ? 'bg-rose-500 shadow-rose-200' : 'bg-blue-500 shadow-blue-200'
          } shadow-sm animate-pulse`} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
            {notification.message}
          </span>
          <button 
            onClick={() => setNotification(null)} 
            className="text-xs text-slate-400 hover:text-slate-600 font-bold ml-2 select-none cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
