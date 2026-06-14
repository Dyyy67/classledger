import { useEffect, useRef, useState } from 'react';
import { useClassroom } from '../contexts/ClassroomContext';
import {
  subscribeToStudents, subscribeToTransactions,
  addStudent, updateStudent, deleteStudent,
} from '../api/firestore';
import Modal from '../components/Modal';
import {
  UserPlus, Pencil, Trash2, Users, Phone, Search,
  Upload, FileText, CheckSquare, Square, AlertTriangle,
  X, FileSpreadsheet, Plus, Loader,
} from 'lucide-react';

const fmt = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

// ─── Name Detection Helpers ────────────────────────────────────────────────

const isLikelyName = (text) => {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (/^\d/.test(t)) return false; // starts with number
  if (/^(no\.|lrn|learner|student|name|school|grade|section|subject|teacher|date|score|total|average|remarks|quarter|period)/i.test(t)) return false;
  const words = t.split(/[\s,]+/).filter(Boolean);
  if (words.length < 2 || words.length > 7) return false;
  const capitalizedCount = words.filter(w => /^[A-ZÑÁÉÍÓÚ]/.test(w) || /^(de|la|ng|jr|sr|ii|iii|iv)$/i.test(w)).length;
  return capitalizedCount >= Math.ceil(words.length * 0.6);
};

// Normalize "SANTOS, MARIA JOY" → "MARIA JOY SANTOS"
const normalizeName = (raw) => {
  const t = raw.trim();
  if (t.includes(',')) {
    const [last, ...rest] = t.split(',').map(s => s.trim());
    if (rest.length > 0 && rest[0]) return `${rest.join(' ')} ${last}`.trim();
  }
  return t;
};

const toTitleCase = (str) =>
  str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

// ─── Excel / XLSX Parser ─────────────────────────────────────────────────

const parseExcel = async (file) => {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Find header row (look for "name" keyword in any cell)
        let headerRowIdx = -1;
        let nameColIdx = -1;
        let firstNameColIdx = -1;
        let lastNameColIdx = -1;

        for (let r = 0; r < Math.min(rows.length, 15); r++) {
          const row = rows[r].map(c => c?.toString().toLowerCase().trim());
          // Check for combined name column
          const combined = row.findIndex(c =>
            c.includes('name of learner') || c.includes("learner's name") ||
            c.includes('full name') || c.includes('student name') ||
            c.includes('pangalan') || (c.includes('name') && !c.includes('school') && !c.includes('teacher'))
          );
          // Check for split first/last name columns
          const firstName = row.findIndex(c => c.includes('first') || c.includes('given'));
          const lastName  = row.findIndex(c => c.includes('last') || c.includes('surname') || c.includes('apelyido'));

          if (combined >= 0) { headerRowIdx = r; nameColIdx = combined; break; }
          if (firstName >= 0 && lastName >= 0) {
            headerRowIdx = r; firstNameColIdx = firstName; lastNameColIdx = lastName; break;
          }
        }

        let names = [];

        if (headerRowIdx >= 0 && nameColIdx >= 0) {
          // Combined name column found
          names = rows.slice(headerRowIdx + 1)
            .map(row => row[nameColIdx]?.toString().trim())
            .filter(n => n && n.length > 2 && !/^\d+$/.test(n));
        } else if (headerRowIdx >= 0 && firstNameColIdx >= 0 && lastNameColIdx >= 0) {
          // Separate first/last columns
          names = rows.slice(headerRowIdx + 1)
            .map(row => `${row[firstNameColIdx] || ''} ${row[lastNameColIdx] || ''}`.trim())
            .filter(n => n.length > 2);
        } else {
          // Fallback: scan all cells for things that look like names
          names = rows.flat()
            .map(c => c?.toString().trim())
            .filter(isLikelyName);
        }

        resolve([...new Set(names.map(n => toTitleCase(normalizeName(n))).filter(n => n.length > 2))]);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// ─── DOCX Parser ──────────────────────────────────────────────────────────

const parseDocx = async (file) => {
  const mammoth = await import('mammoth');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
        const lines = result.value.split('\n').map(l => l.trim()).filter(Boolean);
        const names = [...new Set(
          lines.filter(isLikelyName).map(n => toTitleCase(normalizeName(n)))
        )];
        resolve(names);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// ─── PDF Parser ───────────────────────────────────────────────────────────

const parsePdf = async (file) => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let allLines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group items by Y position (same line)
    const lineMap = {};
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item.str);
    });
    Object.values(lineMap).forEach(parts => allLines.push(parts.join(' ').trim()));
  }
  const names = [...new Set(
    allLines.filter(isLikelyName).map(n => toTitleCase(normalizeName(n)))
  )];
  return names;
};

const parseFile = async (file) => {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file);
  if (ext === 'docx' || ext === 'doc') return parseDocx(file);
  if (ext === 'pdf') return parsePdf(file);
  throw new Error('Unsupported file type.');
};

// ─── Sub-components ───────────────────────────────────────────────────────

function StudentModal({ isOpen, onClose, onSave, initial }) {
  const [studentName, setStudentName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isOpen) { setStudentName(initial?.studentName || ''); setGuardianContact(initial?.guardianContact || ''); setError(''); }
  }, [isOpen, initial]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentName.trim()) { setError('Student name is required.'); return; }
    setLoading(true);
    try { await onSave({ studentName: studentName.trim(), guardianContact: guardianContact.trim() }); onClose(); }
    catch { setError('Failed to save. Please try again.'); }
    finally { setLoading(false); }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Edit Student' : 'Add Student'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Full Name *</label>
          <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g. Maria Santos" required
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Guardian Contact <span className="text-slate-400">(optional)</span></label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={guardianContact} onChange={e => setGuardianContact(e.target.value)} placeholder="09XX-XXX-XXXX"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? 'Saving…' : initial ? 'Save Changes' : 'Add Student'}
        </button>
      </form>
    </Modal>
  );
}

function ConfirmDeleteModal({ isOpen, onClose, onConfirm, studentName }) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => { setLoading(true); await onConfirm(); setLoading(false); onClose(); };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Remove Student" size="sm">
      <p className="text-slate-600 text-sm mb-5">Remove <strong>{studentName}</strong>? Their transaction records remain in the ledger.</p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {loading ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────

function ImportModal({ isOpen, onClose, onAddStudents }) {
  const fileInputRef = useRef(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [detectedNames, setDetectedNames] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setParsing(false); setParseError(''); setDetectedNames([]);
    setSelected(new Set()); setAdding(false); setAddedCount(0); setFileName('');
  };
  const handleClose = () => { reset(); onClose(); };

  const processFile = async (file) => {
    if (!file) return;
    const allowed = ['xlsx','xls','docx','doc','pdf'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { setParseError('Unsupported file. Please use XLSX, DOCX, or PDF.'); return; }
    setFileName(file.name);
    setParseError('');
    setDetectedNames([]);
    setSelected(new Set());
    setParsing(true);
    try {
      const names = await parseFile(file);
      if (names.length === 0) {
        setParseError('No student names detected. The file may use an unsupported format. Try an Excel file with a "Name" column.');
      } else {
        setDetectedNames(names);
        setSelected(new Set(names)); // pre-select all
      }
    } catch (err) {
      setParseError(`Failed to read file: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const toggleName = (name) => {
    const next = new Set(selected);
    next.has(name) ? next.delete(name) : next.add(name);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === detectedNames.length) setSelected(new Set());
    else setSelected(new Set(detectedNames));
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    let count = 0;
    for (const name of selected) {
      await onAddStudents(name);
      count++;
      setAddedCount(count);
    }
    setAdding(false);
    setTimeout(() => handleClose(), 1200);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Students from File" size="lg">
      <div className="space-y-4">
        {/* Drop zone */}
        {detectedNames.length === 0 && !parsing && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            }`}
          >
            <Upload size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600 font-medium text-sm">Drop your file here, or click to browse</p>
            <p className="text-slate-400 text-xs mt-1">Supports: Excel (.xlsx, .xls) · Word (.docx) · PDF</p>
            <p className="text-blue-500 text-xs mt-3 font-medium">
              💡 Best results with DepEd Class Record Excel files
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.docx,.doc,.pdf" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* Parsing spinner */}
        {parsing && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader size={28} className="text-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Reading <span className="font-medium">{fileName}</span>…</p>
            <p className="text-slate-400 text-xs">Detecting student names</p>
          </div>
        )}

        {/* Error */}
        {parseError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 text-sm font-medium">Could not detect names</p>
              <p className="text-red-500 text-xs mt-0.5">{parseError}</p>
              <button onClick={reset} className="text-red-600 text-xs font-medium mt-2 hover:underline">Try another file</button>
            </div>
          </div>
        )}

        {/* Detected names list */}
        {detectedNames.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={15} className="text-emerald-500" />
                <span className="text-sm font-medium text-slate-700">
                  {detectedNames.length} names detected in <span className="text-slate-500">{fileName}</span>
                </span>
              </div>
              <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X size={12} /> Change file
              </button>
            </div>

            {/* Select all toggle */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
              <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600">
                {selected.size === detectedNames.length
                  ? <CheckSquare size={16} className="text-blue-600" />
                  : <Square size={16} className="text-slate-400" />}
                {selected.size === detectedNames.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-xs text-slate-500">{selected.size} of {detectedNames.length} selected</span>
            </div>

            {/* Names list */}
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {detectedNames.map((name) => (
                <button
                  key={name}
                  onClick={() => toggleName(name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                    selected.has(name) ? 'bg-blue-50 text-blue-800' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {selected.has(name)
                    ? <CheckSquare size={16} className="text-blue-600 flex-shrink-0" />
                    : <Square size={16} className="text-slate-300 flex-shrink-0" />}
                  <span className="font-medium">{name}</span>
                </button>
              ))}
            </div>

            {/* Add button */}
            {adding ? (
              <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 rounded-xl">
                <Loader size={15} className="animate-spin text-emerald-600" />
                <span className="text-emerald-700 text-sm font-medium">
                  Adding {addedCount} of {selected.size}…
                </span>
              </div>
            ) : addedCount > 0 ? (
              <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 rounded-xl">
                <span className="text-emerald-700 text-sm font-medium">✓ {addedCount} students added!</span>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                disabled={selected.size === 0}
                className="w-full py-3 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add {selected.size} Student{selected.size !== 1 ? 's' : ''}
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Remove All Confirm Modal ─────────────────────────────────────────────

function RemoveAllModal({ isOpen, onClose, onConfirm, count }) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    setConfirmText('');
    onClose();
  };
  const handleClose = () => { setConfirmText(''); onClose(); };
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Remove All Students" size="sm">
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
        <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-red-700 text-xs">
          This will remove all <strong>{count} students</strong> from the roster. Transaction records will remain in the ledger, but student names will show as "—".
        </p>
      </div>
      <p className="text-slate-600 text-sm mb-3">Type <strong>REMOVE ALL</strong> to confirm:</p>
      <input
        value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
        placeholder="REMOVE ALL"
        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
      />
      <div className="flex gap-2">
        <button onClick={handleClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button
          onClick={handleConfirm}
          disabled={loading || confirmText !== 'REMOVE ALL'}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          {loading ? 'Removing…' : 'Remove All'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function Students() {
  const { currentClassroom } = useClassroom();
  const [students, setStudents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [removeAllOpen, setRemoveAllOpen] = useState(false);

  useEffect(() => {
    if (!currentClassroom) return;
    const u1 = subscribeToStudents(currentClassroom.id, setStudents);
    const u2 = subscribeToTransactions(currentClassroom.id, setTransactions);
    return () => { u1(); u2(); };
  }, [currentClassroom?.id]);

  const getStudentTotals = (studentId) =>
    transactions.filter(t => t.studentId === studentId && t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);

  const handleAddImportedStudent = (name) =>
    addStudent(currentClassroom.id, { studentName: name, guardianContact: '' });

  const handleRemoveAll = async () => {
    for (const s of students) await deleteStudent(s.id);
  };

  const filtered = students.filter(s => s.studentName.toLowerCase().includes(search.toLowerCase()));

  if (!currentClassroom) {
    return <div className="flex items-center justify-center h-[60vh]"><p className="text-slate-400 text-sm">No classroom selected.</p></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Student Roster</h1>
          <p className="text-slate-400 text-xs mt-0.5">{students.length} student{students.length !== 1 ? 's' : ''} · {currentClassroom.className}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {students.length > 0 && (
            <button
              onClick={() => setRemoveAllOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-xs font-medium transition-colors"
            >
              <Trash2 size={13} /> Remove All
            </button>
          )}
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F]/5 rounded-xl font-semibold text-sm transition-colors"
          >
            <Upload size={15} /> Import File
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            <UserPlus size={16} /> Add Student
          </button>
        </div>
      </div>

      {/* Import hint banner (shown when no students) */}
      {students.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <FileText size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-800 text-sm font-medium">Import from your DepEd class record</p>
            <p className="text-blue-600 text-xs mt-0.5">Upload an Excel, Word, or PDF file and ClassLedger will automatically detect your student names.</p>
            <button onClick={() => setImportOpen(true)} className="mt-2 text-blue-700 text-xs font-semibold hover:underline flex items-center gap-1">
              <Upload size={12} /> Import now →
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {students.length > 4 && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 && students.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-10 text-center">
          <p className="text-slate-400 text-sm">No students match "{search}".</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center shadow-sm">
          <Users size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">No students yet.</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button onClick={() => setImportOpen(true)} className="text-blue-600 text-xs font-medium hover:underline">Import from file</button>
            <span className="text-slate-300 text-xs">or</span>
            <button onClick={() => setAddOpen(true)} className="text-blue-600 text-xs font-medium hover:underline">Add manually →</button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Guardian Contact</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Paid</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{s.studentName}</td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {s.guardianContact
                        ? <a href={`tel:${s.guardianContact}`} className="hover:text-blue-600 hover:underline flex items-center gap-1"><Phone size={11} /> {s.guardianContact}</a>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-semibold text-emerald-600">{fmt(getStudentTotals(s.id))}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setEditTarget(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-400">{filtered.length} student{filtered.length !== 1 ? 's' : ''} shown</p>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((s, i) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center text-[#1E3A5F] font-bold text-sm flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{s.studentName}</p>
                  {s.guardianContact
                    ? <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone size={10} /> {s.guardianContact}</p>
                    : <p className="text-xs text-slate-300">No contact</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-600">{fmt(getStudentTotals(s.id))}</p>
                  <p className="text-xs text-slate-400">total paid</p>
                </div>
                <div className="flex flex-col gap-1 ml-1">
                  <button onClick={() => setEditTarget(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <StudentModal isOpen={addOpen} onClose={() => setAddOpen(false)} onSave={data => addStudent(currentClassroom.id, data)} />
      <StudentModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} onSave={data => updateStudent(editTarget.id, data)} initial={editTarget} />
      <ConfirmDeleteModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteStudent(deleteTarget.id)} studentName={deleteTarget?.studentName} />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onAddStudents={handleAddImportedStudent} />
      <RemoveAllModal isOpen={removeAllOpen} onClose={() => setRemoveAllOpen(false)} onConfirm={handleRemoveAll} count={students.length} />
    </div>
  );
}
