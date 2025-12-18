import { db, auth } from "./firebase";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy,
    onSnapshot
} from "firebase/firestore";

const getNotesCollection = () => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    return collection(db, "users", user.uid, "notes");
};

export const createNote = async (content = "", title = "") => {
    try {
        const notesRef = getNotesCollection();
        await addDoc(notesRef, {
            content,
            title,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error creating note:", error);
        throw error;
    }
};

export const deleteNote = async (noteId) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");
        const noteRef = doc(db, "users", user.uid, "notes", noteId);
        await deleteDoc(noteRef);
    } catch (error) {
        console.error("Error deleting note:", error);
        throw error;
    }
};

export const updateNote = async (noteId, data) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");
        const noteRef = doc(db, "users", user.uid, "notes", noteId);

        // Handle both string (legacy) and object updates
        const updateData = typeof data === 'string'
            ? { content: data }
            : data;

        await updateDoc(noteRef, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating note:", error);
        throw error;
    }
};

export const subscribeToNotes = (callback) => {
    const user = auth.currentUser;
    if (!user) return () => { };

    const notesRef = getNotesCollection();
    const q = query(notesRef, orderBy("createdAt", "desc"));

    return onSnapshot(q, (snapshot) => {
        const notes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(notes);
    });
};
