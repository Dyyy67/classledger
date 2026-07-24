import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { subscribeToTransactions, subscribeToStudents, subscribeToCampaigns } from '../api/firestore';
import LogTransactionModal from '../components/LogTransactionModal';
import {
  TrendingUp, TrendingDown, Wallet, Users, Plus,
  ArrowRight, Calendar, BookOpen,
} from 'lucide-react';

const fmt = (n) =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

const formatDate = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

function StatCard({ label, value, icon: Icon, color, sub }) {
  const colorMap = {
    blue:  { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',   val: 'text-[#1E3A5F]' },
    green: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    red:   { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',     val: 'text-red-700' },
    amber: { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600', val: 'text-amber-700' },
  }[color];

  return (
    <div className={`${colorMap.bg} rounded-2xl p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <p className="text-slate-500 text-xs font-medium">{label}</p>
        <div className={`${colorMap.icon} rounded-xl p-2`}>
          <Icon size={15} />
        </div>
      </div>
      <div>
        <p className={`text-xl font-bold ${colorMap.val} leading-tight`}>{value}</p>
        {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { currentClassroom } = useClassroom();
  const [transactions, setTransactions] = useState([]);
  const [students, setStudents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (!currentClassroom) return;
    const id = currentClassroom.id;
    const u1 = subscribeToTransactions(id, setTransactions);
    const u2 = subscribeToStudents(id, setStudents);
    const u3 = subscribeToCampaigns(id, setCampaigns);
    return () => { u1(); u2(); u3(); };
  }, [currentClassroom?.id]);

  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + Number(t.amount), 0);
  const netBalance = totalIncome - totalExpense;
  const recent = transactions.slice(0, 5);

  const getStudentName = (id) => students.find((s) => s.id === id)?.studentName || '—';
  const getCampaignTitle = (id) => campaigns.find((c) => c.id === id)?.title || 'General';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!currentClassroom) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No classroom selected.</p>
          <p className="text-slate-400 text-xs mt-1">Create a classroom to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{greeting},</p>
          <h1 className="text-2xl font-bold text-slate-800">{profile?.fullName?.split(' ')[0] || 'Teacher'} 👋</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Calendar size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">{currentClassroom.className} · {currentClassroom.academicYear}</span>
          </div>
        </div>
        <button
          onClick={() => setLogOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          <Plus size={16} /> Log
        </button>
      </div>

      {/* Net Balance Hero */}
      <div className="bg-[#1E3A5F] rounded-2xl p-5 mb-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <p className="text-blue-300 text-xs font-medium mb-1">Net Balance</p>
        <p className={`text-3xl font-bold mb-0.5 ${netBalance >= 0 ? 'text-white' : 'text-red-300'}`}>
          {fmt(netBalance)}
        </p>
        <p className="text-blue-300/70 text-xs">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Income"   value={fmt(totalIncome)}  icon={TrendingUp}   color="green" />
        <StatCard label="Total Expenses" value={fmt(totalExpense)} icon={TrendingDown} color="red" />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            label="Students"
            value={students.length}
            icon={Users}
            color="blue"
            sub={`${campaigns.length} active fund${campaigns.length !== 1 ? 's' : ''}`}
          />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-800 text-sm">Recent Transactions</h2>
          <Link to="/ledger" className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-700">
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet size={32} className="text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No transactions yet.</p>
            <button
              onClick={() => setLogOpen(true)}
              className="mt-3 text-blue-600 text-xs font-medium hover:underline"
            >
              Log your first transaction →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 px-5 py-3.5 ${
                  t.type === 'INCOME' ? 'ledger-row-income' : 'ledger-row-expense'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                }`}>
                  {t.type === 'INCOME' ? '↑' : '↓'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {t.type === 'INCOME' ? getStudentName(t.studentId) : (t.notes || 'Expense')}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{getCampaignTitle(t.campaignId)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(t.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LogTransactionModal
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        classroomId={currentClassroom.id}
        students={students}
        campaigns={campaigns}
        transactions={transactions}
      />
    </div>
  );
}
