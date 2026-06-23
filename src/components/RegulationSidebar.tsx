import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Search, 
  Trash2, 
  RefreshCw, 
  ExternalLink,
  Plus, 
  FileText, 
  FileSpreadsheet, 
  FileUp, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash
} from 'lucide-react';
import { DocumentFile } from '../types';

interface SidebarProps {
  documents: DocumentFile[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUploading: boolean;
  onClearAll: () => Promise<void>;
  userRole?: 'user' | 'editor';
}

export default function RegulationSidebar({
  documents,
  onUpload,
  onDelete,
  isUploading,
  onClearAll,
  userRole = 'user'
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dragActive, setDragActive] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File type categorizers
  const getFileIcon = (type: string) => {
    const ext = type.toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    return <FileText className="w-5 h-5 text-blue-600" />;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onUpload(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Filter documents based on name / type / code number
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || doc.type.toLowerCase() === filterType.toLowerCase() || 
      (filterType === 'excel' && ['xlsx', 'xls', 'csv'].includes(doc.type.toLowerCase())) ||
      (filterType === 'pdf/doc' && ['pdf', 'docx', 'doc'].includes(doc.type.toLowerCase()));
    return matchesSearch && matchesType;
  });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <aside className="w-full h-full flex flex-col sidebar-gradient overflow-hidden" id="regulation-sidebar">
      {/* Title & Stats */}
      <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md flex flex-col gap-1.5" id="sidebar-header-stats">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <FileUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-slate-800">
              Hệ Thống RAG
              <span className="block text-blue-600 font-medium text-[10px] tracking-wide uppercase mt-0.5">Trợ Lý Pháp Lý Nhà Nước</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
          <span className="text-[11px] text-slate-500 font-medium">Kho tài liệu đang nạp:</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
            {documents.length} File
          </span>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div className="p-2.5 bg-white/60 border-b border-slate-100">
        <div
          onDragEnter={userRole === 'editor' ? handleDrag : undefined}
          onDragOver={userRole === 'editor' ? handleDrag : undefined}
          onDragLeave={userRole === 'editor' ? handleDrag : undefined}
          onDrop={userRole === 'editor' ? handleDrop : undefined}
          onClick={userRole === 'editor' ? triggerFileInput : undefined}
          className={`border rounded-lg p-2.5 text-center transition-all duration-200 ${
            userRole !== 'editor'
              ? 'border-amber-200 bg-amber-50/20 cursor-not-allowed'
              : dragActive 
                ? 'border-blue-500 bg-blue-50/80 scale-[0.98] shadow-inner cursor-pointer' 
                : 'border-blue-200 hover:border-blue-400 bg-blue-50/10 hover:bg-blue-50/40 cursor-pointer'
          }`}
        >
          {userRole !== 'editor' ? (
            <div className="flex items-center justify-center gap-2 bg-transparent">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-bold text-amber-700 leading-tight">
                  Chế độ khách (Chỉ đọc)
                </p>
                <p className="text-[9px] text-slate-400 leading-none mt-0.5">
                  Bạn không có quyền tải lên. Liên hệ Admin để cấp quyền editor!
                </p>
              </div>
            </div>
          ) : (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 bg-transparent">
                {isUploading ? (
                  <Loader2 className="w-4.5 h-4.5 text-blue-600 animate-spin shrink-0" />
                ) : (
                  <Upload className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                )}
                <div className="text-left">
                  <p className="text-[11px] font-bold text-blue-700 leading-tight">
                    {isUploading ? 'Đang phân tích tài liệu...' : 'Tải tài liệu mới lên'}
                  </p>
                  <p className="text-[9px] text-slate-400 leading-none mt-0.5">
                    Kéo thả hoặc bấm để chọn PDF, Word, Excel, CSV, TXT
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="p-3 flex flex-col gap-1.5 border-b border-slate-200 bg-white/40">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu quy định..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 transition-all font-medium"
          />
        </div>
        
        {/* Quick Filter types */}
        <div className="flex gap-1.5 mt-1 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md border shrink-0 transition uppercase tracking-wider ${
              filterType === 'all'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilterType('pdf/doc')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md border shrink-0 transition uppercase tracking-wider ${
              filterType === 'pdf/doc'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            PDF & Word
          </button>
          <button
            onClick={() => setFilterType('excel')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md border shrink-0 transition uppercase tracking-wider ${
              filterType === 'excel'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Bảng tính/CSV
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Danh sách tài liệu RAG</h2>
        {filteredDocs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/50">
            <p className="text-xs font-medium">Không tìm thấy tài liệu phù hợp.</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-blue-200 hover:shadow-sm transition-all flex flex-col gap-2 relative group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-1.5 rounded-lg bg-blue-50/50 shrink-0">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate" title={doc.name}>
                      {doc.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatSize(doc.size)} • {formatDate(doc.uploadDate)}
                    </p>
                  </div>
                </div>

                {/* Inline Action Menus */}
                <div className="flex items-center gap-1 shrink-0">
                  {deleteConfirmId === doc.id ? (
                    <div className="flex items-center gap-1 bg-red-50/80 px-1.5 py-0.5 rounded border border-red-200">
                      <span className="text-[9px] text-red-600 font-semibold select-none">Xóa?</span>
                      <button
                        onClick={() => {
                          onDelete(doc.id);
                          setDeleteConfirmId(null);
                        }}
                        className="text-[9px] text-white bg-red-500 hover:bg-red-600 px-1 rounded cursor-pointer transition font-bold"
                      >
                        Có
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[9px] text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-1 rounded cursor-pointer transition font-bold"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <>
                      {doc.driveUrl && (
                        <a
                          href={doc.driveUrl}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Xem trên Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {userRole === 'editor' && doc.status !== 'processing' && (
                        <button
                          onClick={() => setDeleteConfirmId(doc.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Xóa tài liệu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Status and Progress Bar */}
              <div className="w-full mt-1">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="flex items-center gap-1 font-semibold">
                    {doc.status === 'processing' && (
                      <span className="text-blue-600 flex items-center gap-1 font-semibold status-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                        Đang xử lý ({doc.statusProgress}%)
                      </span>
                    )}
                    {doc.status === 'indexed' && (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-150 px-1.5 py-0.25 rounded-md flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                        Đã lập chỉ mục ({doc.numChunks || 0} chunks)
                      </span>
                    )}
                    {doc.status === 'error' && (
                      <span className="text-red-700 bg-red-50 border border-red-150 px-1.5 py-0.25 rounded-md flex items-center gap-1" title={doc.errorMessage}>
                        <AlertCircle className="w-2.5 h-2.5 text-red-500" />
                        Lỗi phân tích
                      </span>
                    )}
                  </span>
                </div>

                {doc.status === 'error' && doc.errorMessage && (
                  <p className="text-[10px] text-red-600 font-medium bg-red-50/70 p-1.5 rounded-lg border border-red-100 mt-1 leading-normal">
                    {doc.errorMessage}
                  </p>
                )}
                
                {doc.status === 'processing' && (
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${doc.statusProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clear Database Footer Actions */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col gap-2 text-[11px] text-slate-500">
        <div className="flex justify-between items-center w-full">
          <span>Đồng bộ Google Drive: Đang hoạt động</span>
          {userRole === 'editor' && documents.length > 0 && !showResetConfirm && (
            <button
              onClick={() => {
                setShowResetConfirm(true);
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors font-bold uppercase tracking-wider text-[10px]"
            >
              Reset RAG
            </button>
          )}
        </div>
        {showResetConfirm && (
          <div className="mt-2 bg-red-50 p-2.5 rounded-lg border border-red-200 flex flex-col gap-2">
            <p className="text-red-700 font-semibold leading-normal">
              Bạn có đồng ý xóa toàn bộ tài liệu đã tải lên và làm sạch hoàn toàn cơ sở dữ liệu vector? Thao tác này không thể thu hồi.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  onClearAll();
                  setShowResetConfirm(false);
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold px-2.5 py-1 rounded transition text-[10px] cursor-pointer"
              >
                Xóa tất cả
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold px-2.5 py-1 rounded transition text-[10px] cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
