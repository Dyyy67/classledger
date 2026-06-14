import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp,
  getDoc, setDoc, getDocs,
} from 'firebase/firestore';

// ─── Users / Profiles ────────────────────────────────────────────────────────

export const createUserProfile = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};

// ─── Classrooms ───────────────────────────────────────────────────────────────

export const createClassroom = async (teacherId, data) => {
  return await addDoc(collection(db, 'classrooms'), {
    teacherId,
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const updateClassroom = async (classroomId, data) => {
  await updateDoc(doc(db, 'classrooms', classroomId), data);
};

export const subscribeToClassrooms = (teacherId, callback) => {
  const q = query(
    collection(db, 'classrooms'),
    where('teacherId', '==', teacherId)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    callback(docs);
  });
};

export const deleteClassroomWithData = async (classroomId) => {
  // Delete all students
  const studentsSnap = await getDocs(
    query(collection(db, 'students'), where('classroomId', '==', classroomId))
  );
  for (const d of studentsSnap.docs) await deleteDoc(d.ref);

  // Delete all campaigns
  const campaignsSnap = await getDocs(
    query(collection(db, 'campaigns'), where('classroomId', '==', classroomId))
  );
  for (const d of campaignsSnap.docs) await deleteDoc(d.ref);

  // Delete all transactions
  const transactionsSnap = await getDocs(
    query(collection(db, 'transactions'), where('classroomId', '==', classroomId))
  );
  for (const d of transactionsSnap.docs) await deleteDoc(d.ref);

  // Delete the classroom itself
  await deleteDoc(doc(db, 'classrooms', classroomId));
};

// ─── Students ─────────────────────────────────────────────────────────────────

export const addStudent = async (classroomId, data) => {
  return await addDoc(collection(db, 'students'), {
    classroomId,
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const updateStudent = async (studentId, data) => {
  await updateDoc(doc(db, 'students', studentId), data);
};

export const deleteStudent = async (studentId) => {
  await deleteDoc(doc(db, 'students', studentId));
};

export const subscribeToStudents = (classroomId, callback) => {
  const q = query(
    collection(db, 'students'),
    where('classroomId', '==', classroomId)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => a.studentName.localeCompare(b.studentName));
    callback(docs);
  });
};

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const addCampaign = async (classroomId, data) => {
  return await addDoc(collection(db, 'campaigns'), {
    classroomId,
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const updateCampaign = async (campaignId, data) => {
  await updateDoc(doc(db, 'campaigns', campaignId), data);
};

export const deleteCampaign = async (campaignId) => {
  await deleteDoc(doc(db, 'campaigns', campaignId));
};

export const subscribeToCampaigns = (classroomId, callback) => {
  const q = query(
    collection(db, 'campaigns'),
    where('classroomId', '==', classroomId)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(docs);
  });
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const addTransaction = async (data) => {
  return await addDoc(collection(db, 'transactions'), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const deleteTransaction = async (transactionId) => {
  await deleteDoc(doc(db, 'transactions', transactionId));
};

export const subscribeToTransactions = (classroomId, callback) => {
  const q = query(
    collection(db, 'transactions'),
    where('classroomId', '==', classroomId)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(docs);
  });
};
