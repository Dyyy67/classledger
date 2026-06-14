import { useState } from 'react';
import Modal from './Modal';
import { addTransaction } from '../api/firestore';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Share2, Copy, MessageCircle } from 'lucide-react';

const fmt = (n) =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LogTransactionModal({
  isOpen, onClose, classroomId, students, campaigns,
}) {
  const { profile } = useAuth();
  const [type, setType] = useState('INCOME');
  const [amount, setAmount] = useState('');
  const [studentId, setStudentId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null); // { text, studentName, campaignTitle, amount }

  const reset = () => {
    setType('INCOME');
    setAmount('');
    setStudentId('');
    setCampaignId('');
    setNotes('');
    setError('');
    setReceipt(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (type === 'INCOME' && !studentId) {
      setError('Please select a student for income.');
      return;
    }
    setLoading(true);
    try {
      await addTransaction({
        classroomId,
        type,
        amount: Number(amount),
        studentId: studentId || null,
        campaignId: campaignId || null,
        notes: notes.trim(),
      });

      if (type === 'INCOME') {
        const student = students.find((s) => s.id === studentId);
        const campaign = campaigns.find((c) => c.id === campaignId);
        const dateStr = new Date().toLocaleDateString('en-PH', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        const receiptText =
          `📋 *Payment Receipt*\n` +
          `─────────────────\n` +
          `Student: ${student?.studentName || 'N/A'}\n` +
          `Amount: ${fmt(amount)}\n` +
          `For: ${campaign?.title || 'General'}\n` +
          `Date: ${dateStr}\n` +
          `Received by: ${profile?.fullName || 'Teacher'}\n\n` +
          `Thank you! 🙏\n— ${profile?.fullName || 'Teacher'}\nClassLedger`;

        setReceipt({
          text: receiptText,
          studentName: student?.studentName,
          campaignTitle: campaign?.title,
          amount: Number(amount),
        });
      } else {
        handleClose();
      }
    } catch (err) {
      setError('Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(receipt.text);
      alert('Receipt copied to clipboard!');
    } catch {
      alert('Could not copy. Please copy the text manually.');
    }
  };

  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(receipt.text)}`;
    window.open(url, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Payment Receipt', text: receipt.text });
      } catch {}
    }
  };

  // ── Receipt screen after income logged ──────────────────────────────────
  if (receipt) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Receipt Ready" size="sm">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full mb-3">
            <CheckCircle size={28} className="text-emerald-600" />
          </div>
          <p className="text-slate-700 font-semibold">Payment logged!</p>
          <p className="text-slate-500 text-sm mt-1">
            {fmt(receipt.amount)} from {receipt.studentName}
            {receipt.campaignTitle ? ` for ${receipt.campaignTitle}` : ''}
          </p>
        </div>

        {/* Receipt preview */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          {receipt.text}
        </div>

        <p className="text-xs text-slate-500 text-center mb-3">
          Send this receipt to the guardian:
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={shareWhatsApp}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-xl font-medium text-sm transition-colors"
          >
            <MessageCircle size={16} />
            Send via WhatsApp
          </button>
          {navigator.share && (
            <button
              onClick={shareNative}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
            >
              <Share2 size={16} />
              Share…
            </button>
          )}
          <button
            onClick={copyReceipt}
            className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-sm transition-colors"
          >
            <Copy size={16} />
            Copy Receipt Text
          </button>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 text-sm py-1.5 transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  // ── Log Transaction form ─────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Log Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {['INCOME', 'EXPENSE'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  type === t
                    ? t === 'INCOME'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'bg-red-50 border-red-500 text-red-700'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
              >
                {t === 'INCOME' ? '💰 Income' : '💸 Expense'}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Amount (₱)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Student (Income only) */}
        {type === 'INCOME' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Student *</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-slate-800
                focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentName}</option>
              ))}
            </select>
          </div>
        )}

        {/* Campaign */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Fund / Campaign <span className="text-slate-400">(optional)</span>
          </label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-slate-800
              focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="">None / General</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Notes <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes…"
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-slate-800
              focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
          />
        </div>

        {error && (
          <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            type === 'INCOME'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Saving…' : `Log ${type === 'INCOME' ? 'Payment' : 'Expense'}`}
        </button>
      </form>
    </Modal>
  );
}
