import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
// @ts-ignore
import { PDFParse } from 'pdf-parse';
// @ts-ignore
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { DocumentFile, CitationSource } from './src/types';

const app = express();
const PORT = 3000;

// Configure JSON parser and URL-encoded parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup multer for memory storage uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 } // 40MB max
});

// Paths for database persistence
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'rag_db.json');

// Ensure database folders exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database Schema interface
interface ChunkData {
  id: string; // docId_index
  docId: string;
  text: string;
  embedding: number[];
  page?: string;
  section?: string;
}

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'editor';
}

interface LocalDB {
  documents: DocumentFile[];
  chunks: ChunkData[];
  users?: UserProfile[];
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

async function getUserInfo(accessToken: string | null): Promise<GoogleUserInfo | null> {
  if (!accessToken) return null;
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      return null;
    }
    return await response.json() as GoogleUserInfo;
  } catch (err) {
    console.error('[Auth] Error fetching user info:', err);
    return null;
  }
}

// Initialize database
let db: LocalDB = { documents: [], chunks: [] };
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    console.log(`[Database] Loaded ${db.documents.length} docs and ${db.chunks.length} chunks.`);
  } catch (err) {
    console.error('[Database] Error loading db file, resetting:', err);
    db = { documents: [], chunks: [] };
  }
} else {
  // Seed with standard files if empty for demo/UI safety, or let user upload
  saveDB();
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Fail to save DB file:', err);
  }
}

// Helper to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Translate raw Gemini or system error strings into polished friendly Vietnamese messages
function translateGeminiError(errorMsg: string): string {
  if (!errorMsg) {
    return 'Hệ thống Trợ lý AI gặp lỗi không xác định. Xin vui lòng gửi câu hỏi lại hoặc thử lại sau.';
  }
  
  const lowerMsg = errorMsg.toLowerCase();
  
  // 503 Unavailable / High Demand
  if (
    lowerMsg.includes('high demand') || 
    lowerMsg.includes('unavailable') || 
    lowerMsg.includes('503') ||
    lowerMsg.includes('busy')
  ) {
    return 'Hệ thống Trợ lý AI hiện đang bị quá tải tạm thời do lượng cán bộ truy cập tăng đột biến. Xin quý cán bộ vui lòng bấm gửi lại câu hỏi hoặc thử lại sau giây lát.';
  }
  
  // Quota Exceeded / Rate Limit / Exhausted
  if (
    lowerMsg.includes('quota exceeded') || 
    lowerMsg.includes('resource exhausted') || 
    lowerMsg.includes('429') ||
    lowerMsg.includes('rate limit')
  ) {
    return 'Hệ thống AI đã tạm thời vượt quá giới hạn tần suất gửi tin nhắn cho phép. Quý cán bộ vui lòng chờ ít giây rồi bấm gửi lại câu hỏi!';
  }
  
  // Unauthorized / Invalid API Key / Bad Credentials
  if (
    lowerMsg.includes('api_key') || 
    lowerMsg.includes('key not found') || 
    lowerMsg.includes('api key') || 
    lowerMsg.includes('invalid') || 
    lowerMsg.includes('403') || 
    (lowerMsg.includes('400') && (lowerMsg.includes('key') || lowerMsg.includes('credential') || lowerMsg.includes('authorized')))
  ) {
    return 'Lỗi xác thực khóa kết nối AI (GEMINI_API_KEY) không hợp lệ hoặc chưa cấu hình trên máy chủ. Xin vui lòng liên hệ Ban quản trị để kiểm tra!';
  }
  
  // Network / Connection Reset / Timeout
  if (
    lowerMsg.includes('fetch failed') || 
    lowerMsg.includes('network') || 
    lowerMsg.includes('timeout') || 
    lowerMsg.includes('econnreset')
  ) {
    return 'Kết nối mạng giữa máy chủ RAG và dịch vụ AI (Gemini) bị gián đoạn. Xin quý cán bộ vui lòng kiểm tra lại đường truyền và gửi lại.';
  }

  // General user friendly fallback
  return `Trợ lý AI tạm thời gặp sự cố khi xử lý dữ liệu: ${errorMsg}. Vui lòng thử gửi lại câu hỏi.`;
}

// Create Gemini clients lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not defined in environments.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API to generate text chunks
function chunkText(text: string, maxLength: number = 800, overlap: number = 100): string[] {
  const chunks: string[] = [];
  if (!text || text.trim().length === 0) return chunks;
  
  // Replace multiple newlines/spaces
  const cleanText = text.replace(/\s+/g, ' ').trim();
  let index = 0;
  while (index < cleanText.length) {
    const chunk = cleanText.substring(index, index + maxLength);
    chunks.push(chunk);
    index += (maxLength - overlap);
  }
  return chunks;
}

// Helper to verify if the user has editor permissions
async function verifyEditorRole(accessToken: string | null): Promise<boolean> {
  const gUser = await getUserInfo(accessToken);
  if (!gUser) return false;
  if (gUser.email === 'pvantho@pdu.edu.vn') return true;

  if (!db.users) {
    db.users = [];
  }
  let dbUser = db.users.find(u => u.uid === gUser.sub || u.email === gUser.email);
  if (!dbUser) {
    dbUser = {
      uid: gUser.sub,
      email: gUser.email,
      name: gUser.name || gUser.email.split('@')[0],
      picture: gUser.picture,
      role: 'user'
    };
    db.users.push(dbUser);
    saveDB();
  }
  return dbUser.role === 'editor';
}

// API endpoints
// GET logged in user's profile and active role
app.get('/api/session/profile', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  const gUser = await getUserInfo(accessToken);
  if (!gUser) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đăng nhập hết hạn.' });
  }

  if (!db.users) {
    db.users = [];
  }

  let userProfile = db.users.find(u => u.uid === gUser.sub || u.email === gUser.email);
  if (!userProfile) {
    userProfile = {
      uid: gUser.sub,
      email: gUser.email,
      name: gUser.name || gUser.email.split('@')[0],
      picture: gUser.picture,
      role: gUser.email === 'pvantho@pdu.edu.vn' ? 'editor' : 'user'
    };
    db.users.push(userProfile);
    saveDB();
  } else {
    // Sync latest info
    userProfile.name = gUser.name || userProfile.name;
    userProfile.picture = gUser.picture || userProfile.picture;
    if (gUser.email === 'pvantho@pdu.edu.vn') {
      userProfile.role = 'editor';
    }
    saveDB();
  }

  res.json({
    user: userProfile,
    isAdmin: gUser.email === 'pvantho@pdu.edu.vn'
  });
});

// GET all registered users (Admin only)
app.get('/api/admin/users', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  const gUser = await getUserInfo(accessToken);
  if (!gUser || gUser.email !== 'pvantho@pdu.edu.vn') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập danh sách người dùng.' });
  }

  if (!db.users) {
    db.users = [];
  }

  res.json(db.users);
});

// PUT update a user's role (Admin only)
app.put('/api/admin/users/:uid/role', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  const gUser = await getUserInfo(accessToken);
  if (!gUser || gUser.email !== 'pvantho@pdu.edu.vn') {
    return res.status(403).json({ error: 'Bạn không có quyền cập nhật quyền lực người dùng.' });
  }

  const targetUid = req.params.uid;
  const { role } = req.body;

  if (role !== 'user' && role !== 'editor') {
    return res.status(400).json({ error: 'Vai trò chỉ được là user hoặc editor.' });
  }

  if (!db.users) {
    db.users = [];
  }

  const targetUser = db.users.find(u => u.uid === targetUid);
  if (!targetUser) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng này trên hệ thống.' });
  }

  if (targetUser.email === 'pvantho@pdu.edu.vn') {
    return res.status(400).json({ error: 'Không thể thay đổi quyền của quản trị viên hệ thống.' });
  }

  targetUser.role = role;
  saveDB();

  res.json({ success: true, user: targetUser });
});

// Get list of indexed document files
app.get('/api/files', (req: Request, res: Response) => {
  res.json(db.documents);
});

// Delete document and its vectors
app.delete('/api/files/:id', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const isEditor = await verifyEditorRole(accessToken);
  if (!isEditor) {
    return res.status(403).json({ error: 'Bạn không có quyền thực hiện xóa tài liệu. Cần vai trò Editor.' });
  }

  try {
    const document = db.documents.find(d => d.id === docId);
    if (!document) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu quy chuẩn này.' });
    }

    // Optional: Delete from Google Drive too if we have user credentials
    if (accessToken && docId && !docId.startsWith('local_')) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${docId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log(`[Google Drive] Deleted file ID: ${docId}`);
      } catch (err) {
        console.warn(`[Google Drive] Could not delete file from Drive:`, err);
      }
    }

    // Remove from local database and memory
    db.documents = db.documents.filter(d => d.id !== docId);
    db.chunks = db.chunks.filter(c => c.docId !== docId);
    saveDB();

    res.json({ success: true, message: 'Đã xóa tài liệu và toàn bộ các vector lập chỉ mục liên quan.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi khi xóa tài liệu: ' + error.message });
  }
});

// Clean up and reset entire vector database
app.post('/api/files/clear', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const isEditor = await verifyEditorRole(accessToken);
  if (!isEditor) {
    return res.status(403).json({ error: 'Bạn không có quyền reset cơ sở dữ liệu. Cần vai trò Editor.' });
  }

  db = { ...db, documents: [], chunks: [] };
  saveDB();
  res.json({ success: true, message: 'Đã làm trống toàn bộ cơ sở dữ liệu tài liệu RAG.' });
});

// Upload and index a file
// Runs: Upload to Google Drive -> Parse locally -> Chunk -> Gemini Embed -> Vector DB
app.post('/api/files/upload', upload.array('files'), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập Google để thực hiện tải lên Google Drive.' });
  }

  const isEditor = await verifyEditorRole(accessToken);
  if (!isEditor) {
    return res.status(403).json({ error: 'Bạn không có quyền thêm/sửa tài liệu. Cần vai trò Editor.' });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Vui lòng chọn ít nhất một file để tải lên.' });
  }

  const results: DocumentFile[] = [];

  for (const file of files) {
    const docId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const originalName = file.originalname;
    const size = file.size;
    const type = path.extname(originalName).toLowerCase().replace('.', '');
    
    // Create direct placeholder entry in local state
    const newDocItem: DocumentFile = {
      id: docId,
      name: originalName,
      size,
      uploadDate: new Date().toISOString(),
      status: 'processing',
      statusProgress: 10,
      type
    };
    db.documents.push(newDocItem);
    saveDB();

    // Trigger async parsing & embedding pipeline so we return fast,
    // or run it sequentially for short, real-time responses. We run it sequentially
    // but update DB state sequentially so the client gets true progress on polling!
    try {
      // Step 2 (Google Drive upload): progress = 20%
      newDocItem.statusProgress = 20;
      saveDB();

      let driveFileId = docId;
      let driveUrl = '';
      
      const boundary = 'googledrive_upload_boundary';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;
      const metadata = {
        name: originalName,
        mimeType: file.mimetype || 'application/octet-stream'
      };

      const multipartBody = Buffer.concat([
        Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n'),
        Buffer.from(delimiter + 'Content-Type: ' + (file.mimetype || 'application/octet-stream') + '\r\n\r\n'),
        file.buffer,
        Buffer.from(closeDelimiter)
      ]);

      const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (driveRes.ok) {
        const driveData: any = await driveRes.json();
        driveFileId = driveData.id;
        driveUrl = driveData.webViewLink || '';
        // Replace temp doc item with real google drive file ID
        db.documents = db.documents.filter(d => d.id !== docId);
        newDocItem.id = driveFileId;
        newDocItem.driveUrl = driveUrl;
        db.documents.push(newDocItem);
        newDocItem.statusProgress = 40;
        saveDB();
      } else {
        const errText = await driveRes.text();
        console.warn('Lỗi khi tải lên Google Drive, sử dụng ID cục bộ:', errText);
      }

      // Step 3 (Parse contents): progress = 60%
      newDocItem.statusProgress = 60;
      saveDB();

      let extractedText = '';
      if (type === 'txt' || type === 'csv') {
        extractedText = file.buffer.toString('utf-8');
      } else if (type === 'docx') {
        const pr = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = pr.value;
      } else if (type === 'xlsx' || type === 'xls') {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          extractedText += XLSX.utils.sheet_to_txt(sheet) + '\n';
        }
      } else if (type === 'pdf') {
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        try {
          const parsedPdf = await parser.getText();
          extractedText = parsedPdf.text;
        } finally {
          await parser.destroy();
        }
      } else {
        // Fallback simple parsing
        extractedText = file.buffer.toString('utf-8');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Nội dung tài liệu rỗng hoặc không thể trích xuất văn bản.');
      }

      // Step 4 (Chunking & Embeddings): progress = 80%
      newDocItem.statusProgress = 80;
      saveDB();

      const chunks = chunkText(extractedText, 800, 100);
      newDocItem.numChunks = chunks.length;

      const ai = getGeminiClient();
      
      // Batch embedding call using text-embedding model
      const chunkEmbeds: ChunkData[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const textToEmbed = chunks[i];
        
        try {
          const embedRes = await ai.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: textToEmbed,
          });

          if (embedRes.embeddings && embedRes.embeddings.length > 0) {
            const vector = embedRes.embeddings[0].values;
            chunkEmbeds.push({
              id: `${newDocItem.id}_${i}`,
              docId: newDocItem.id,
              text: textToEmbed,
              embedding: vector,
              page: type === 'pdf' ? `Trang ${Math.floor(i / 3) + 1}` : undefined,
              section: `Mục ${i + 1}`
            });
          }
        } catch (embedErr: any) {
          console.error(`[Embedding Error] Failed chunk ${i}:`, embedErr);
        }
      }

      if (chunkEmbeds.length === 0) {
        throw new Error('Không thể sinh Vector Embedding cho các phân đoạn văn bản.');
      }

      // Add actual chunks to global vector database
      db.chunks.push(...chunkEmbeds);

      // Final Step: Complete! status = indexed, progress = 100%
      newDocItem.status = 'indexed';
      newDocItem.statusProgress = 100;
      saveDB();
      results.push(newDocItem);
    } catch (err: any) {
      console.error(`[Index Error] Fail to parse/index "${originalName}":`, err);
      newDocItem.status = 'error';
      newDocItem.statusProgress = 100;
      newDocItem.errorMessage = translateGeminiError(err.message || 'Lỗi hệ thống lập chỉ mục');
      saveDB();
      results.push(newDocItem);
    }
  }

  res.json({
    success: true,
    data: results
  });
});

// API endpoint for Chatbox queries using context-retrieval (Top-K)
app.post('/api/chat/query', async (req: Request, res: Response) => {
  const { question, history = [], targetFileIds = [] } = req.body;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: 'Nội dung câu hỏi không được để trống.' });
  }

  try {
    const ai = getGeminiClient();

    // 1. Generate text embedding for the question query
    const questionEmbedRes = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: question,
    });

    if (!questionEmbedRes.embeddings || questionEmbedRes.embeddings.length === 0) {
      throw new Error('Không thể tạo Embedding cho câu hỏi truy vấn.');
    }

    const queryVector = questionEmbedRes.embeddings[0].values;

    // 2. Compute similarity for all chunks of indexed files
    // Filter by target documents if specified by the user in the UI, or use all documents
    let eligibleChunks = db.chunks;
    if (targetFileIds && targetFileIds.length > 0) {
      eligibleChunks = db.chunks.filter(c => targetFileIds.includes(c.docId));
    }

    // Score eligible chunks
    const chunksWithScores = eligibleChunks.map(chunk => {
      const score = cosineSimilarity(queryVector, chunk.embedding);
      return { chunk, score };
    });

    // Sort by descending score
    chunksWithScores.sort((a, b) => b.score - a.score);

    // Retrieve Top-K segments (limit to 5 for context size and high precision relevance)
    const topSegments = chunksWithScores.slice(0, 5).filter(item => item.score > 0.35); // filter low semantic relevance

    // Return mock fallback or negative answer if no documents are loaded or no relevance found
    if (db.documents.length === 0 || topSegments.length === 0) {
      return res.json({
        content: "Tôi không tìm thấy nội dung này trong các tài liệu đã được tải lên. Bạn có muốn tải thêm tài liệu liên quan không?",
        references: []
      });
    }

    // 3. Assemble prompt context text and capture metadata references
    let contextText = '';
    const citations: CitationSource[] = [];

    topSegments.forEach((item, index) => {
      const doc = db.documents.find(d => d.id === item.chunk.docId);
      const docName = doc ? doc.name : 'Văn bản quy định';
      
      contextText += `--- TÀI LIỆU KHẢO SÁT ${index + 1}: [TÊN FILE: ${docName}] ---\n`;
      contextText += `${item.chunk.text}\n\n`;

      citations.push({
        fileName: docName,
        docId: item.chunk.docId,
        textSnippet: item.chunk.text,
        page: item.chunk.page || undefined,
        section: item.chunk.section || undefined
      });
    });

    // 4. Call generation model via gemini-3.5-flash for accurate and fast responses
    const systemPromptMessage = `Bạn là Trợ lý tư vấn quy định pháp luật và quy chế nội bộ chuyên nghiệp, chính xác.
Nhiệm vụ của bạn là trả lời câu hỏi của người dùng một cách chính xác dựa trên danh sách các tài liệu tham chiếu (văn bản quy định) được cung cấp dưới đây.

Dưới đây là các tài liệu liên quan mà bạn có:
${contextText}

HƯỚNG DẪN TRẢ LỜI NGHIÊM NGẶT:
1. Bạn CHỈ được trả lời dựa trên thông tin chính thức có trong tài liệu quy định được cung cấp ở trên.
2. KHÔNG ĐƯỢC tự ý suy diễn, thêm thông tin bên ngoài hoặc phỏng đoán nếu tài liệu không đề cập đến.
3. Nếu thông tin trong tài liệu quy định ở trên không đủ để trả lời câu hỏi của người dùng, hoặc không liên quan gì, bạn phải trả lời nguyên văn như sau:
"Tôi không tìm thấy nội dung này trong các tài liệu đã được tải lên. Bạn có muốn tải thêm tài liệu liên quan không?"
4. Khi trả lời được, bạn phải trích dẫn rõ ràng tên tài liệu tham chiếu nào đã được dùng để trả lời cho luận điểm đó (ví dụ: Nguồn: [Tên tài liệu], Điều, Trang, v.v.).
5. Hãy tổ chức câu trả lời định dạng Markdown, phân đoạn rõ ràng bằng danh sách gạch đầu dòng hoặc đánh số thứ tự cho dễ đọc. Ngôn ngữ câu trả lời: Tiếng Việt.

LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ (Cho ngữ cảnh):
${history.map((h: any) => `${h.role === 'user' ? 'Người dùng' : 'AI Trợ lý'}: ${h.content}`).join('\n')}

Câu hỏi hiện tại của người dùng: "${question}"
`;

    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: systemPromptMessage
    });

    const aiAnswerText = chatResponse.text || "Xin lỗi, không có câu trả lời nào được tạo ra.";

    res.json({
      content: aiAnswerText,
      references: citations
    });
  } catch (error: any) {
    console.error('[Chat Query Error]:', error);
    const friendlyMsg = translateGeminiError(error.message || String(error));
    res.status(500).json({ error: friendlyMsg });
  }
});

// Setup dev server with Vite integration or standard production static serving
async function setUpServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasBuiltApp = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' && hasBuiltApp;

  if (!isProduction) {
    console.log('[Status] Starting in DEVELOPMENT mode using Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Status] Starting in PRODUCTION mode serving static files from dist...');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Server Error Handler]:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi nội bộ trên hệ thống máy chủ.' });
  });

  // Clean bind to all interfaces on port 3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Status] Server fully operational at host 0.0.0.0, binding on port ${PORT}`);
  });
}

setUpServer();
