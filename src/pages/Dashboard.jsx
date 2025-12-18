import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { logout } from "../services/firebase";
import { subscribeToNotes, createNote, deleteNote } from "../services/db";
import styles from "./Dashboard.module.css";
import EditNoteModal from "../components/EditNoteModal";
import { useTheme } from "../context/ThemeContext";

const Dashboard = () => {
    const { currentUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();

    // State
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newNoteContent, setNewNoteContent] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Derive selected note from URL
    const noteId = searchParams.get("note");
    const selectedNote = notes.find(n => n.id === noteId) || null;

    useEffect(() => {
        const unsubscribe = subscribeToNotes((fetchedNotes) => {
            setNotes(fetchedNotes);
            setLoading(false);
        });
        return unsubscribe;
    }, [currentUser]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Failed to logout", error);
        }
    };

    const handleCreateNote = async (e) => {
        e.preventDefault();
        if (!newNoteContent.trim()) return;

        await createNote(newNoteContent);
        setNewNoteContent("");
        setIsCreating(false);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (confirm("Delete this note?")) {
            await deleteNote(id);
            // If the deleted note was open, close it
            if (noteId === id) {
                setSearchParams({});
            }
        }
    };

    const handleNoteClick = (note) => {
        setSearchParams({ note: note.id });
    };

    const handleCloseModal = () => {
        setSearchParams({});
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.logo}>FocusPad</div>
                <div className={styles.userControls}>
                    <button onClick={toggleTheme} className={styles.iconBtn} title="Toggle Theme">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <span className={styles.userName}>{currentUser.displayName}</span>
                    <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
                </div>
            </header>

            <main className={styles.main}>
                {/* Create Note Area */}
                <div className={styles.createArea} onClick={() => setIsCreating(true)}>
                    {isCreating ? (
                        <div className={styles.createForm}>
                            <textarea
                                className={styles.createInput}
                                placeholder="Take a note..."
                                autoFocus
                                value={newNoteContent}
                                onChange={(e) => setNewNoteContent(e.target.value)}
                                onBlur={() => {
                                    // Optional: Auto-save on blur if content exists
                                    if (!newNoteContent.trim()) setIsCreating(false);
                                }}
                            />
                            <div className={styles.createActions}>
                                <button onMouseDown={handleCreateNote}>Close</button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.createPlaceholder}>
                            Take a note...
                        </div>
                    )}
                </div>

                <div className={styles.grid}>
                    {notes.map(note => (
                        <div
                            key={note.id}
                            className={styles.noteCard}
                            onClick={() => handleNoteClick(note)}
                        >
                            {note.title && <div className={styles.noteTitle}>{note.title}</div>}
                            <div
                                className={styles.noteContent}
                                dangerouslySetInnerHTML={{ __html: note.content || '' }}
                            />
                            <div className={styles.noteActions}>
                                <button onClick={(e) => handleDelete(e, note.id)} className={styles.iconBtn}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {loading && <p>Loading notes...</p>}
                {!loading && notes.length === 0 && <p className={styles.emptyState}>No notes yet. Add one!</p>}

                {selectedNote && (
                    <EditNoteModal
                        note={selectedNote}
                        onClose={handleCloseModal}
                    />
                )}
            </main>
        </div>
    );
};

export default Dashboard;
