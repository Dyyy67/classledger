import { useEffect, useRef, useState } from 'react';
import { useClassroom } from '../contexts/ClassroomContext';
import {
  subscribeToTransactions, subscribeToStudents, subscribeToCampaigns,
  deleteTransaction,
} from '../api/firestore';
import LogTransactionModal from '../components/LogTransactionModal';
import { BookOpen, Plus, Download, Trash2, Filter, TrendingUp, TrendingDown, Search } from 'lucide-react';

const fmt = (n) =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

function DeleteConfirm({ isOpen, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl">
        <p className="font-semibold text-slate-800 mb-1">Delete transaction?</p>
        <p className="text-slate-500 text-sm mb-4">This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {loading ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Ledger() {
  const { currentClassroom } = useClassroom();
  const [transactions, setTransactions] = useState([]);
  const [students, setStudents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState('ALL'); // ALL | INCOME | EXPENSE
  const [search, setSearch] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);
  const ledgerRef = useRef(null);

  useEffect(() => {
    if (!currentClassroom) return;
    const id = currentClassroom.id;
    const u1 = subscribeToTransactions(id, setTransactions);
    const u2 = subscribeToStudents(id, setStudents);
    const u3 = subscribeToCampaigns(id, setCampaigns);
    return () => { u1(); u2(); u3(); };
  }, [currentClassroom?.id]);

  const getStudentName = (id) => students.find((s) => s.id === id)?.studentName || '—';
  const getCampaignTitle = (id) => campaigns.find((c) => c.id === id)?.title || null;

  const filtered = transactions.filter((t) => {
    const typeMatch = filter === 'ALL' || t.type === filter;
    const sName = t.studentId ? getStudentName(t.studentId) : '';
    const cTitle = t.campaignId ? getCampaignTitle(t.campaignId) : '';
    const searchMatch =
      !search ||
      sName.toLowerCase().includes(search.toLowerCase()) ||
      (cTitle && cTitle.toLowerCase().includes(search.toLowerCase())) ||
      (t.notes && t.notes.toLowerCase().includes(search.toLowerCase())) ||
      fmt(t.amount).includes(search);
    return typeMatch && searchMatch;
  });

  const totalIncome = filtered.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filtered.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

  const exportReport = async () => {
    if (!ledgerRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ledgerRef.current, {
        backgroundColor: '#f1f5f9',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');

      // Try native share first (mobile)
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'classledger-report.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'ClassLedger Report' });
          setExporting(false);
          return;
        }
      }

      // Fallback: download
      const a = document.createElement('a');
      a.href = url;
      a.download = `classledger-report-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!currentClassroom) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-400 text-sm">No classroom selected.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ledger</h1>
          <p className="text-slate-400 text-xs mt-0.5">{transactions.length} records · {currentClassroom.className}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportReport}
            disabled={exporting || transactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 shadow-sm"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button
            onClick={() => setLogOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            <Plus size={16} /> Log
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Income',  value: fmt(totalIncome),  color: 'bg-emerald-50 text-emerald-700', icon: TrendingUp  },
          { label: 'Expense', value: fmt(totalExpense), color: 'bg-red-50 text-red-700',         icon: TrendingDown },
          { label: 'Net',     value: fmt(totalIncome - totalExpense),
            color: (totalIncome - totalExpense) >= 0 ? 'bg-blue-50 text-[#1E3A5F]' : 'bg-red-50 text-red-700',
            icon: BookOpen },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`${color} rounded-2xl px-3 py-3 flex flex-col gap-1`}>
            <div className="flex items-center gap-1 opacity-70">
              <Icon size={11} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-sm font-bold leading-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-sm">
          {['ALL', 'INCOME', 'EXPENSE'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? f === 'INCOME'
                    ? 'bg-emerald-500 text-white'
                    : f === 'EXPENSE'
                    ? 'bg-red-500 text-white'
                    : 'bg-[#1E3A5F] text-white'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'INCOME' ? '↑ Income' : '↓ Expense'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, fund, notes…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Ledger Table — captured by html2canvas */}
      <div ref={ledgerRef} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        {/* Export header (visible in export, subtle in UI) */}
        <div className="px-5 py-3 bg-[#1E3A5F] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-blue-300" />
            <span className="text-white text-xs font-bold">ClassLedger</span>
            <span className="text-blue-300 text-xs">· {currentClassroom.className} · {currentClassroom.academicYear}</span>
          </div>
          <span className="text-blue-300 text-[10px]">
            Generated {new Date().toLocaleDateString('en-PH')}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {search || filter !== 'ALL' ? 'No matching transactions.' : 'No transactions yet.'}
            </p>
            {!search && filter === 'ALL' && (
              <button onClick={() => setLogOpen(true)} className="mt-2 text-blue-600 text-xs font-medium hover:underline">
                Log your first entry →
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Student / Label</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Fund / Campaign</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                    <th className="text-center px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                    <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50/50 transition-colors group ${
                        t.type === 'INCOME' ? 'ledger-row-income' : 'ledger-row-expense'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-slate-700 text-xs">{formatDate(t.createdAt)}</p>
                        <p className="text-slate-400 text-[10px]">{formatTime(t.createdAt)}</p>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 text-xs">
                        {t.type === 'INCOME' ? getStudentName(t.studentId) : '— Expense —'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {t.campaignId ? getCampaignTitle(t.campaignId) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs max-w-[150px] truncate">
                        {t.notes || <span className="text-slate-200">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          t.type === 'INCOME'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {t.type === 'INCOME' ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                          {t.type}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-right font-bold text-sm ${
                        t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount)}
                      </td>
                      <td className="px-3 py-3.5">
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="p-1.5 text-transparent group-hover:text-slate-400 hover:!text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-50">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 px-4 py-3.5 ${
                    t.type === 'INCOME' ? 'ledger-row-income' : 'ledger-row-expense'
                  }`}
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                    t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {t.type === 'INCOME' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {t.type === 'INCOME' ? getStudentName(t.studentId) : (t.notes || 'Expense')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {t.campaignId && (
                        <span className="text-xs text-slate-500">{getCampaignTitle(t.campaignId)}</span>
                      )}
                      <span className="text-[10px] text-slate-400">{formatDate(t.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-start gap-1">
                    <div>
                      <p className={`text-sm font-bold ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer totals */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                Showing {filtered.length} of {transactions.length}
              </span>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="text-emerald-600">+{fmt(totalIncome)}</span>
                <span className="text-red-500">-{fmt(totalExpense)}</span>
                <span className={`px-2 py-0.5 rounded-lg ${(totalIncome - totalExpense) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {fmt(totalIncome - totalExpense)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <LogTransactionModal
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        classroomId={currentClassroom.id}
        students={students}
        campaigns={campaigns}
      />

      <DeleteConfirm
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTransaction(deleteTarget.id)}
      />
    </div>
  );
}
