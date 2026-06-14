import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClassroom } from '../contexts/ClassroomContext';
import Modal from './Modal';
import {
  LayoutDashboard, Users, Target, BookOpen,
  LogOut, Menu, X, ChevronDown, School, Plus, Trash2,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/students',  icon: Users,           label: 'Students'  },
  { to: '/campaigns', icon: Target,          label: 'Funds'     },
  { to: '/ledger',    icon: BookOpen,        label: 'Ledger'    },
];

function CreateClassroomModal({ isOpen, onClose, onCreate }) {
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!className.trim() || !academicYear.trim()) {
      setError('Both fields are required.');
      return;
    }
    setLoading(true);
    try {
      await onCreate({ className: className.trim(), academicYear: academicYear.trim() });
      setClassName('');
      setAcademicYear('');
      setError('');
    } catch {
      setError('Failed to create classroom. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Your Classroom" size="sm">
      <div className="mb-4">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mx-auto mb-3">
          <School size={22} className="text-blue-600" />
        </div>
        <p className="text-center text-sm text-slate-500">
          Set up your classroom to start tracking funds.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Class Name</label>
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="e.g. Grade 4 – Beryl"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Academic Year</label>
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="e.g. 2025–2026"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Classroom'}
        </button>
      </form>
    </Modal>
  );
}

export default function Layout() {
  const { user, profile, logout } = useAuth();
  const {
    classrooms, currentClassroom, showCreateModal, setShowCreateModal,
    selectClassroom, handleCreateClassroom, handleDeleteClassroom,
  } = useClassroom();
  const navigate = useNavigate();

  // ── All useState declarations together ───────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [classroomDropdown, setClassroomDropdown] = useState(false);
  const [deleteClassroomTarget, setDeleteClassroomTarget] = useState(null);
  const [deletingClassroom, setDeletingClassroom] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/auth'); };

  const SidebarContent = ({ onNavClick }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="bg-blue-500/30 rounded-lg p-2">
          <BookOpen size={18} className="text-blue-200" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">ClassLedger</p>
          <p className="text-blue-300 text-[10px] font-medium tracking-wide">FINANCE TRACKER</p>
        </div>
      </div>

      {/* Classroom Selector */}
      <div className="px-3 pt-3 pb-1 relative">
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider px-2 mb-1.5">
          Classroom
        </p>
        <button
          onClick={() => setClassroomDropdown((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
        >
          <span className="text-white text-sm font-medium truncate max-w-[140px]">
            {currentClassroom?.className || 'No classroom'}
          </span>
          <ChevronDown size={14} className={`text-white/60 transition-transform ${classroomDropdown ? 'rotate-180' : ''}`} />
        </button>

        {classroomDropdown && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl shadow-xl z-50 py-1 overflow-hidden">
            {classrooms.map((c) => (
              <div key={c.id} className="flex items-center group">
                <button
                  onClick={() => { selectClassroom(c); setClassroomDropdown(false); }}
                  className={`flex-1 text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                    currentClassroom?.id === c.id ? 'text-blue-600 font-medium' : 'text-slate-700'
                  }`}
                >
                  {c.className}
                  <span className="block text-xs text-slate-400">{c.academicYear}</span>
                </button>
                <button
                  onClick={() => { setDeleteClassroomTarget(c); setClassroomDropdown(false); }}
                  className="px-2 py-2 text-transparent group-hover:text-red-400 hover:!text-red-600 hover:bg-red-50 rounded-lg transition-all mr-1"
                  title="Delete classroom"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => { setShowCreateModal(true); setClassroomDropdown(false); }}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors"
              >
                <Plus size={14} /> Add classroom
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider px-2 mb-1.5 mt-2">
          Menu
        </p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/55 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-sm font-semibold truncate">{profile?.fullName || 'Teacher'}</p>
          <p className="text-white/40 text-xs truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={17} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-[#1E3A5F] fixed inset-y-0 left-0 z-40 overflow-y-auto">
        <SidebarContent onNavClick={() => {}} />
      </aside>

      {/* ── Mobile Top Bar ───────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#1E3A5F] h-14 flex items-center justify-between px-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <BookOpen size={18} className="text-blue-300" />
          <div>
            <span className="text-white font-bold text-sm">ClassLedger</span>
            {currentClassroom && (
              <span className="text-blue-300 text-[11px] ml-2">{currentClassroom.className}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* ── Mobile Drawer ────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-64 bg-[#1E3A5F] h-full flex flex-col overflow-y-auto">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent onNavClick={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 flex shadow-[0_-1px_3px_rgba(0,0,0,0.08)]">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#1E3A5F]' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-blue-50' : ''}`}>
                  <Icon size={19} />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Create Classroom Modal ───────────────────────────────────────── */}
      <CreateClassroomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateClassroom}
      />

      {/* ── Delete Classroom Confirmation ────────────────────────────────── */}
      {deleteClassroomTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deletingClassroom && setDeleteClassroomTarget(null)}
          />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-800 mb-1">Delete Classroom?</h3>
            <p className="text-slate-500 text-sm mb-3">
              You are about to permanently delete:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-red-800 font-semibold text-sm">{deleteClassroomTarget.className}</p>
              <p className="text-red-500 text-xs">{deleteClassroomTarget.academicYear}</p>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              ⚠️ This will also delete all students, campaigns, and transactions in this classroom. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteClassroomTarget(null)}
                disabled={deletingClassroom}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deletingClassroom}
                onClick={async () => {
                  setDeletingClassroom(true);
                  await handleDeleteClassroom(deleteClassroomTarget.id);
                  setDeletingClassroom(false);
                  setDeleteClassroomTarget(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {deletingClassroom ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
