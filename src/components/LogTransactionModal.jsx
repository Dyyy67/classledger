import { useState, useEffect } from 'react';
import Modal from './Modal';
import { addTransaction, updateTransaction } from '../api/firestore';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Share2, Copy, MessageCircle, ShieldAlert } from 'lucide-react';

const fmt = (n) =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ScaryWarning({ type, studentName, campaignTitle, targetAmount, alreadyPaid, newAmount, onProceed, onCancel }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown === 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const isOverpay = type === 'OVERPAY';
  const isFullyPaid = type === 'FULLY_PAID';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <ShieldAlert size={28} className="text-white flex-shrink-0" />
          <div>
            <p className="text-white font-bold text-base">
              {isFullyPaid ? '⚠️ Already Fully Paid!' : '⚠️ Exceeds Target Amount!'}
            </p>
            <p className="text-red-200 text-xs">Action requires your confirmation</p>
          </div>
        </div>

        <div className="p-5">
          {isFullyPaid && (
            <>
              <p className="text-slate-700 text-sm mb-3">
                <strong className="text-red-600">{studentName}</strong> has already been marked as{' '}
                <strong>FULLY PAID</strong> for{' '}
                <strong className="text-slate-800">{campaignTitle}</strong>.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Target amount</span>
                  <span className="font-semibold text-slate-700">{fmt(targetAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Already paid</span>
                  <span className="font-bold text-emerald-600">{fmt(alreadyPaid)} ✓</span>
                </div>
                <div className="flex justify-between text-xs border-t border-red-200 pt-1 mt-1">
                  <span className="text-slate-500">You're trying to log</span>
                  <span className="font-bold text-red-600">{fmt(newAmount)}</span>
                </div>
              </div>
              <p className="text-xs text-red-600 font-medium bg-red-50 rounded-lg px-3 py-2 mb-4">
                🚨 Logging this will create a DUPLICATE payment record. Are you absolutely sure this is intentional?
              </p>
            </>
          )}

          {isOverpay && (
            <>
              <p className="text-slate-700 text-sm mb-3">
                The amount you're logging for{' '}
                <strong className="text-red-600">{studentName}</strong> will{' '}
                <strong>EXCEED the target</strong> for{' '}
                <strong className="text-slate-800">{campaignTitle}</strong>.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Target amount</span>
                  <span className="font-semibold text-slate-700">{fmt(targetAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Already paid</span>
                  <span className="font-semibold text-slate-700">{fmt(alreadyPaid)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">New payment</span>
                  <span className="font-semibold text-slate-700">{fmt(newAmount)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-red-200 pt-1 mt-1">
                  <span className="text-slate-500">Total will be</span>
                  <span className="font-bold text-red-600">
                    {fmt(alreadyPaid + newAmount)} (over by {fmt((alreadyPaid + newAmount) - targetAmount)})
                  </span>
                </div>
              </div>
              <p className="text-xs text-red-600 font-medium bg-red-50 rounded-lg px-3 py-2 mb-4">
                🚨 This exceeds the required amount. Double-check before proceeding!
              </p>
            </>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              disabled={countdown > 0}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-sm font-bold transition-colors"
            >
              {countdown > 0 ? `Proceed (${countdown}s)` : 'Proceed Anyway'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogTransactionModal({
  isOpen, onClose, classroomId, students, campaigns, transactions = [],
}) {
  const { profile } = useAuth();
  const [type, setType] = useState('INCOME');
  const [amount, setAmount] = useState('');
  const [studentId, setStudentId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [warning, setWarning] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // No amount param — just check existing transactions
  const getPaymentStatus = (sId, cId) => {
    if (!sId || !cId) return null;
    const campaign = campaigns.find((c) => c.id === cId);
    if (!campaign?.targetAmountPerStudent) return null;
    const target = campaign.targetAmountPerStudent;

    const existing = transactions.filter(
      (t) => t.studentId === sId && t.campaignId === cId && t.type === 'INCOME'
    );
    const alreadyPaid = existing.reduce((s, t) => s + Number(t.amount), 0);
    const remaining = target - alreadyPaid;

    return { target, alreadyPaid, remaining, existing, campaign };
  };

  // Status badge — no amount needed
  const paymentStatus = type === 'INCOME' && studentId && campaignId
    ? getPaymentStatus(studentId, campaignId)
    : null;

  const reset = () => {
    setType('INCOME');
    setAmount('');
    setStudentId('');
    setCampaignId('');
    setNotes('');
    setError('');
    setReceipt(null);
    setWarning(null);
    setFieldErrors({});
  };

  const handleClose = () => { reset(); onClose(); };

  const doSave = async () => {
    setWarning(null);
    setLoading(true);
    try {
      const status = getPaymentStatus(studentId, campaignId);
      const student = students.find((s) => s.id === studentId);
      const campaign = campaigns.find((c) => c.id === campaignId);

      if (status && status.existing.length > 0 && status.alreadyPaid < status.target) {
        // Partial payment exists — update the first existing transaction's amount
        const firstTx = [...status.existing].sort(
          (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        )[0];
        const newTotal = status.alreadyPaid + Number(amount);
        await updateTransaction(firstTx.id, { amount: newTotal });
      } else {
        // No existing or fully paid override — add new transaction
        await addTransaction({
          classroomId,
          type,
          amount: Number(amount),
          studentId: studentId || null,
          campaignId: campaignId || null,
          notes: notes.trim(),
        });
      }

      if (type === 'INCOME') {
        const dateStr = new Date().toLocaleDateString('en-PH', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

        const totalPaid = status
          ? (status.existing.length > 0 && status.alreadyPaid < status.target
              ? status.alreadyPaid + Number(amount)
              : Number(amount))
          : Number(amount);

        const isFullyPaid = status && totalPaid >= status.target;

        const receiptText =
          `📋 *Payment Receipt*\n` +
          `─────────────────\n` +
          `Student: ${student?.studentName || 'N/A'}\n` +
          `Amount Paid: ${fmt(Number(amount))}\n` +
          (status ? `Total Paid: ${fmt(totalPaid)} / ${fmt(status.target)}\n` : '') +
          `For: ${campaign?.title || 'General'}\n` +
          `Date: ${dateStr}\n` +
          `Received by: ${profile?.fullName || 'Teacher'}\n` +
          (isFullyPaid ? `\n✅ FULLY PAID\n` : status ? `\n⏳ Remaining: ${fmt(status.target - totalPaid)}\n` : '') +
          `\nThank you! 🙏\n— ${profile?.fullName || 'Teacher'}\nClassLedger`;

        setReceipt({
          text: receiptText,
          studentName: student?.studentName,
          campaignTitle: campaign?.title,
          amount: Number(amount),
          isFullyPaid,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const missing = {};
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) missing.amount = true;
    if (type === 'INCOME' && !studentId) missing.studentId = true;
    if (type === 'INCOME' && !campaignId) missing.campaignId = true;

    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      const labels = [];
      if (missing.amount) labels.push('Amount');
      if (missing.studentId) labels.push('Student');
      if (missing.campaignId) labels.push('Fund / Campaign');
      setError(`Please fill in the required field(s): ${labels.join(', ')}.`);
      return;
    }

    if (type === 'INCOME' && campaignId) {
      const status = getPaymentStatus(studentId, campaignId);
      if (status) {
        const student = students.find((s) => s.id === studentId);
        const newTotal = status.alreadyPaid + Number(amount);

        if (status.alreadyPaid >= status.target) {
          setWarning({
            type: 'FULLY_PAID',
            studentName: student?.studentName,
            campaignTitle: status.campaign.title,
            targetAmount: status.target,
            alreadyPaid: status.alreadyPaid,
            newAmount: Number(amount),
          });
          return;
        }

        if (newTotal > status.target) {
          setWarning({
            type: 'OVERPAY',
            studentName: student?.studentName,
            campaignTitle: status.campaign.title,
            targetAmount: status.target,
            alreadyPaid: status.alreadyPaid,
            newAmount: Number(amount),
          });
          return;
        }
      }
    }

    await doSave();
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

  // ── Receipt screen ───────────────────────────────────────────────────────
  if (receipt) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Receipt Ready" size="sm">
        <div className="text-center mb-4">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${receipt.isFullyPaid ? 'bg-emerald-100' : 'bg-blue-100'}`}>
            <CheckCircle size={28} className={receipt.isFullyPaid ? 'text-emerald-600' : 'text-blue-600'} />
          </div>
          <p className="text-slate-700 font-semibold">
            {receipt.isFullyPaid ? '✅ Fully Paid!' : '⏳ Partial Payment Logged'}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {fmt(receipt.amount)} from {receipt.studentName}
            {receipt.campaignTitle ? ` for ${receipt.campaignTitle}` : ''}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          {receipt.text}
        </div>

        <p className="text-xs text-slate-500 text-center mb-3">Send this receipt to the guardian:</p>

        <div className="flex flex-col gap-2">
          <button
            onClick={shareWhatsApp}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-xl font-medium text-sm transition-colors"
          >
            <MessageCircle size={16} /> Send via WhatsApp
          </button>
          {navigator.share && (
            <button
              onClick={shareNative}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
            >
              <Share2 size={16} /> Share…
            </button>
          )}
          <button
            onClick={copyReceipt}
            className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-sm transition-colors"
          >
            <Copy size={16} /> Copy Receipt Text
          </button>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-sm py-1.5 transition-colors">
            Done
          </button>
        </div>
      </Modal>
    );
  }

  // ── Log Transaction form ─────────────────────────────────────────────────
  return (
    <>
      {warning && (
        <ScaryWarning
          {...warning}
          onProceed={doSave}
          onCancel={() => setWarning(null)}
        />
      )}

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
                onChange={(e) => { setAmount(e.target.value); setFieldErrors((f) => ({ ...f, amount: false })); }}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                className={`w-full pl-8 pr-4 py-2.5 border rounded-xl text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                    fieldErrors.amount ? 'border-red-400 bg-red-50' : 'border-slate-200'
                  }`}
              />
              {fieldErrors.amount && <p className="text-red-500 text-[11px] mt-1">Amount is required.</p>}
            </div>
          </div>

          {/* Student (Income only) */}
          {type === 'INCOME' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Student *</label>
              <select
                value={studentId}
                onChange={(e) => { setStudentId(e.target.value); setFieldErrors((f) => ({ ...f, studentId: false })); }}
                required
                className={`w-full px-3 py-2.5 border rounded-xl text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${
                    fieldErrors.studentId ? 'border-red-400 bg-red-50' : 'border-slate-200'
                  }`}
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.studentName}</option>
                ))}
              </select>
              {fieldErrors.studentId && <p className="text-red-500 text-[11px] mt-1">Please select a student.</p>}
            </div>
          )}

          {/* Campaign */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Fund / Campaign {type === 'INCOME' ? <span className="text-red-500">*</span> : <span className="text-slate-400">(optional)</span>}
            </label>
            <select
              value={campaignId}
              onChange={(e) => { setCampaignId(e.target.value); setFieldErrors((f) => ({ ...f, campaignId: false })); }}
              className={`w-full px-3 py-2.5 border rounded-xl text-slate-800
                focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${
                  fieldErrors.campaignId ? 'border-red-400 bg-red-50' : 'border-slate-200'
                }`}
            >
              <option value="">None / General</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            {fieldErrors.campaignId && <p className="text-red-500 text-[11px] mt-1">Please select a fund for this payment.</p>}
          </div>

          {/* Payment status badge */}
          {paymentStatus && (
            <div className={`rounded-xl px-3 py-2.5 text-xs space-y-1 border ${
              paymentStatus.alreadyPaid >= paymentStatus.target
                ? 'bg-red-50 border-red-200'
                : paymentStatus.alreadyPaid > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex justify-between">
                <span className="text-slate-500">Target</span>
                <span className="font-semibold text-slate-700">{fmt(paymentStatus.target)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already paid</span>
                <span className={`font-semibold ${paymentStatus.alreadyPaid >= paymentStatus.target ? 'text-red-600' : 'text-emerald-600'}`}>
                  {fmt(paymentStatus.alreadyPaid)}
                  {paymentStatus.alreadyPaid >= paymentStatus.target && ' ✓ FULLY PAID'}
                </span>
              </div>
              {paymentStatus.alreadyPaid < paymentStatus.target && (
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-500">Remaining</span>
                  <span className="font-bold text-amber-600">{fmt(paymentStatus.remaining)}</span>
                </div>
              )}
            </div>
          )}

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
    </>
  );
}