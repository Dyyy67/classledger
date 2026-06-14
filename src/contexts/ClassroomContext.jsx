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
    const unsubscribe = subscribeToClassrooms(user.uid, (rooms) => {
      setClassrooms(rooms);
      if (rooms.length === 0) {
        setShowCreateModal(true);
        setCurrentClassroom(null);
      } else {
        const savedId = localStorage.getItem('cl_currentClassroomId');
        const saved = rooms.find((r) => r.id === savedId);
        setCurrentClassroom((prev) => {
          // keep current selection if still valid
          if (prev && rooms.find((r) => r.id === prev.id)) return prev;
          return saved || rooms[0];
        });
        setShowCreateModal(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const selectClassroom = (classroom) => {
    setCurrentClassroom(classroom);
    localStorage.setItem('cl_currentClassroomId', classroom.id);
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
