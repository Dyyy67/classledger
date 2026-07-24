import { useEffect, useState } from 'react';
import { useClassroom } from '../contexts/ClassroomContext';
import {
  subscribeToCampaigns, subscribeToStudents, subscribeToTransactions,
  addCampaign, updateCampaign, deleteCampaign,
} from '../api/firestore';
import Modal from '../components/Modal';
import { Target, Plus, Pencil, Trash2, Users, CheckCircle2, CheckCircle, Circle, Copy, Share2 } from 'lucide-react';

const fmt = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

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

function CampaignModal({ isOpen, onClose, onSave, initial }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(initial?.title || '');
      setTarget(initial?.targetAmountPerStudent || '');
      setError('');
    }
  }, [isOpen, initial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Fund name is required.'); return; }
    if (!target || isNaN(Number(target)) || Number(target) <= 0) {
      setError('Please enter a valid target amount.');
      return;
    }
    setLoading(true);
    try {
      await onSave({ title: title.trim(), targetAmountPerStudent: Number(target) });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Edit Fund' : 'Create Fund'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Fund Name *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Field Trip Fund"
            required
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Target Amount per Student (₱) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            The goal per student. Total goal = this × number of students.
          </p>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving…' : initial ? 'Save Changes' : 'Create Fund'}
        </button>
      </form>
    </Modal>
  );
}

function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title }) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Fund" size="sm">
      <p className="text-slate-600 text-sm mb-5">
        Delete <strong>{title}</strong>? Existing transactions linked to this fund will remain in the ledger.
      </p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}

function ProgressBar({ percent }) {
  const clamped = Math.min(percent, 100);
  const color = clamped >= 100 ? 'bg-emerald-500' : clamped >= 60 ? 'bg-blue-500' : clamped >= 30 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function FundDetailModal({ isOpen, onClose, campaign, students, transactions }) {
  const [view, setView] = useState('list');

  if (!isOpen || !campaign) return null;

  const fundTx = transactions.filter((t) => t.campaignId === campaign.id && t.type === 'INCOME');
  const totalGoal = campaign.targetAmountPerStudent * students.length;
  const collected = fundTx.reduce((s, t) => s + Number(t.amount), 0);
  const percent = totalGoal > 0 ? (collected / totalGoal) * 100 : 0;

  const paidList = students
    .map((s) => {
      const paid = fundTx.filter((t) => t.studentId === s.id).reduce((sum, t) => sum + Number(t.amount), 0);
      return { student: s, paid, isFull: paid >= campaign.targetAmountPerStudent };
    })
    .filter((x) => x.paid > 0)
    .sort((a, b) => a.student.studentName.localeCompare(b.student.studentName));

  const unpaidList = students
    .filter((s) => !paidList.find((p) => p.student.id === s.id))
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  const history = [...fundTx].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const reportText =
    `📊 *Fund Progress Report*\n` +
    `─────────────\n` +
    `Fund: ${campaign.title}\n` +
    `Target: ${fmt(campaign.targetAmountPerStudent)}/student\n` +
    `Collected: ${fmt(collected)} / ${fmt(totalGoal)} (${Math.round(percent)}%)\n\n` +
    `✅ Paid (${paidList.length}/${students.length}):\n` +
    (paidList.length > 0
      ? paidList.map((p) => `- ${p.student.studentName} — ${fmt(p.paid)}${p.isFull ? '' : ' (partial)'}`).join('\n')
      : '(none yet)') +
    `\n\n❌ Not yet paid (${unpaidList.length}):\n` +
    (unpaidList.length > 0 ? unpaidList.map((s) => `- ${s.studentName}`).join('\n') : '(everyone has paid!)') +
    `\n\nUpdated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}\n— ClassLedger`;

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      alert('Progress report copied! Paste it in your GC.');
    } catch {
      alert('Could not copy. Please copy the text manually.');
    }
  };

  const handleClose = () => { setView('list'); onClose(); };

  if (view === 'report') {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Progress Report" size="sm">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          {reportText}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={copyReport} className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-medium text-sm transition-colors">
            <Copy size={16} /> Copy Report Text
          </button>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600 text-sm py-1.5 transition-colors">
            ← Back to fund details
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={campaign.title} size="md">
      <div className="mb-5">
        <div className="flex items-end justify-between mb-2">
          <p className="text-2xl font-bold text-slate-800">{fmt(collected)}</p>
          <p className={`text-lg font-bold ${percent >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{Math.round(percent)}%</p>
        </div>
        <ProgressBar percent={percent} />
        <p className="text-xs text-slate-400 mt-1.5">
          of {fmt(totalGoal)} goal · {fmt(campaign.targetAmountPerStudent)}/student
        </p>
      </div>

      <button
        onClick={() => setView('report')}
        className="flex items-center justify-center gap-2 w-full py-2.5 mb-5 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-medium text-sm transition-colors"
      >
        <Share2 size={15} /> Generate GC Progress Report
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1">
            <CheckCircle size={13} /> Paid ({paidList.length}/{students.length})
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {paidList.length === 0 && <p className="text-xs text-slate-300">No payments yet.</p>}
            {paidList.map((p) => (
              <div key={p.student.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-slate-700 truncate">{p.student.studentName}</span>
                <span className="text-xs font-semibold text-emerald-600 flex-shrink-0 ml-2">
                  {fmt(p.paid)}{!p.isFull && ' ⏳'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-500 mb-2 flex items-center gap-1">
            <Circle size={13} /> Not Yet Paid ({unpaidList.length})
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {unpaidList.length === 0 && <p className="text-xs text-slate-300">Everyone has paid!</p>}
            {unpaidList.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-red-50 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-slate-700 truncate">{s.studentName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">Payment History</p>
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {history.length === 0 && <p className="text-xs text-slate-300">No transactions yet for this fund.</p>}
          {history.map((t) => {
            const stu = students.find((st) => st.id === t.studentId);
            return (
              <div key={t.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{stu?.studentName || 'Unknown'}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(t.createdAt)} · {formatTime(t.createdAt)}</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 flex-shrink-0 ml-2">{fmt(t.amount)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export default function Campaigns() {
  const { currentClassroom } = useClassroom();
  const [campaigns, setCampaigns] = useState([]);
  const [students, setStudents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);

  useEffect(() => {
    if (!currentClassroom) return;
    const id = currentClassroom.id;
    const u1 = subscribeToCampaigns(id, setCampaigns);
    const u2 = subscribeToStudents(id, setStudents);
    const u3 = subscribeToTransactions(id, setTransactions);
    return () => { u1(); u2(); u3(); };
  }, [currentClassroom?.id]);

  const getCampaignStats = (campaign) => {
    const totalGoal = campaign.targetAmountPerStudent * students.length;
    const collected = transactions
      .filter((t) => t.campaignId === campaign.id && t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);
    const percent = totalGoal > 0 ? (collected / totalGoal) * 100 : 0;
    const paidCount = new Set(
      transactions
        .filter((t) => t.campaignId === campaign.id && t.type === 'INCOME' && t.studentId)
        .map((t) => t.studentId)
    ).size;
    return { totalGoal, collected, percent, paidCount };
  };

  if (!currentClassroom) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-400 text-sm">No classroom selected.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Fund Campaigns</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} · {currentClassroom.className}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          <Plus size={16} /> New Fund
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center shadow-sm">
          <Target size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">No fund campaigns yet.</p>
          <p className="text-slate-400 text-xs mt-1">Create one to start tracking collections.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-4 px-5 py-2 bg-[#1E3A5F] text-white rounded-xl text-sm font-semibold hover:bg-[#264d7e] transition-colors"
          >
            Create your first fund
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((c) => {
            const { totalGoal, collected, percent, paidCount } = getCampaignStats(c);
            const isComplete = percent >= 100;

            return (
              <div
                key={c.id}
                onClick={() => setDetailTarget(c)}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Title row */}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isComplete ? 'bg-emerald-100' : 'bg-blue-50'}`}>
                      {isComplete
                        ? <CheckCircle2 size={16} className="text-emerald-600" />
                        : <Target size={16} className="text-blue-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{c.title}</p>
                      {isComplete && (
                        <span className="text-xs text-emerald-600 font-medium">✓ Complete</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditTarget(c); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 mb-3">
                  <ProgressBar percent={percent} />
                </div>

                {/* Stats */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xl font-bold text-slate-800">{fmt(collected)}</p>
                    <p className="text-xs text-slate-400">
                      of {fmt(totalGoal)} goal
                      {students.length > 0 && (
                        <> · {fmt(c.targetAmountPerStudent)}/student</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${isComplete ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {Math.round(percent)}%
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 justify-end">
                      <Users size={11} />
                      {paidCount}/{students.length} paid
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CampaignModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data) => addCampaign(currentClassroom.id, data)}
      />
      <CampaignModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={(data) => updateCampaign(editTarget.id, data)}
        initial={editTarget}
      />
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteCampaign(deleteTarget.id)}
        title={deleteTarget?.title}
      />
      <FundDetailModal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        campaign={detailTarget}
        students={students}
        transactions={transactions}
      />
    </div>
  );
}
