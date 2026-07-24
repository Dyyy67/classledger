import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToClassrooms, createClassroom, deleteClassroomWithData } from '../api/firestore';

const ClassroomContext = createContext(null);
export const useClassroom = () => useContext(ClassroomContext);

export function ClassroomProvider({ children }) {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [currentClassroom, setCurrentClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!user) {
      setClassrooms([]);
      setCurrentClassroom(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Safety net: if Firestore doesn't respond in 5s (offline), stop loading
    const offlineTimer = setTimeout(() => {
      setLoading(false);
      // Try to restore last known classroom from localStorage
      const savedId = localStorage.getItem('cl_currentClassroomId');
      const savedName = localStorage.getItem('cl_currentClassroomName');
      const savedYear = localStorage.getItem('cl_currentClassroomYear');
      if (savedId && savedName) {
        setCurrentClassroom({ id: savedId, className: savedName, academicYear: savedYear || '' });
      }
    }, 5000);

    const unsubscribe = subscribeToClassrooms(user.uid, (rooms) => {
      clearTimeout(offlineTimer); // Firestore responded, cancel the timer
      setClassrooms(rooms);
      if (rooms.length === 0) {
        setShowCreateModal(true);
        setCurrentClassroom(null);
      } else {
        const savedId = localStorage.getItem('cl_currentClassroomId');
        const saved = rooms.find((r) => r.id === savedId);
        setCurrentClassroom((prev) => {
          if (prev && rooms.find((r) => r.id === prev.id)) return prev;
          return saved || rooms[0];
        });
        setShowCreateModal(false);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(offlineTimer);
      unsubscribe();
    };
  }, [user]);

  const selectClassroom = (classroom) => {
    setCurrentClassroom(classroom);
    localStorage.setItem('cl_currentClassroomId', classroom.id);
    localStorage.setItem('cl_currentClassroomName', classroom.className);
    localStorage.setItem('cl_currentClassroomYear', classroom.academicYear);
  };

  const handleCreateClassroom = async (data) => {
    const ref = await createClassroom(user.uid, data);
    setShowCreateModal(false);
    return ref;
  };

  const handleDeleteClassroom = async (classroomId) => {
    await deleteClassroomWithData(classroomId);
    if (currentClassroom?.id === classroomId) {
      setCurrentClassroom(null);
      localStorage.removeItem('cl_currentClassroomId');
      localStorage.removeItem('cl_currentClassroomName');
      localStorage.removeItem('cl_currentClassroomYear');
    }
  };

  return (
    <ClassroomContext.Provider
      value={{
        classrooms,
        currentClassroom,
        loading,
        showCreateModal,
        setShowCreateModal,
        selectClassroom,
        handleCreateClassroom,
        handleDeleteClassroom,
      }}
    >
      {children}
    </ClassroomContext.Provider>
  );
}