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
    const [error, setError] = useState(null);
    const [newNoteTitle, setNewNoteTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Derive selected note from URL
    const noteId = searchParams.get("note");
    const selectedNote = notes.find(n => n.id === noteId) || null;

    useEffect(() => {
        // Reset state on user change
        setLoading(true);
        setError(null);

        // Safety timeout: stop loading after 10 seconds
        const timeoutId = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    setError(new Error("Request timed out. Please check your connection."));
                    return false;
                }
                return prev;
            });
        }, 10000);

        const unsubscribe = subscribeToNotes(
            (fetchedNotes) => {
                setNotes(fetchedNotes);
                setLoading(false);
                clearTimeout(timeoutId);
            },
            (err) => {
                console.error("Subscription error:", err);
                setError(err);
                setLoading(false);
                clearTimeout(timeoutId);
            }
        );

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
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
        if (!newNoteTitle.trim()) return;

        try {
            await createNote("", newNoteTitle); // Pass as Title, empty content
            setNewNoteTitle("");
            setIsCreating(false);
        } catch (err) {
            alert("Failed to create note. Please try again.");
        }
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
                            <input
                                type="text"
                                className={styles.createInput}
                                placeholder="Title"
                                autoFocus
                                value={newNoteTitle}
                                onChange={(e) => setNewNoteTitle(e.target.value)}
                                onBlur={() => {
                                    // Optional: Auto-save on blur if content exists
                                    if (!newNoteTitle.trim()) setIsCreating(false);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateNote(e);
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

                {error && (
                    <div className={styles.errorBanner} style={{ color: 'red', textAlign: 'center', margin: '20px 0' }}>
                        Error loading notes: {error.message}
                    </div>
                )}

                <div className={styles.grid}>
                    {notes.map(note => (
                        <div
                            key={note.id}
                            className={styles.noteCard}
                            onClick={() => handleNoteClick(note)}
                        >
                            <div
                                className={styles.noteTitle}
                                dangerouslySetInnerHTML={{ __html: note.title || '<em style="opacity: 0.6">Untitled Note</em>' }}
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

                <footer className={styles.footer}>
                    FocusPad v{__APP_VERSION__}
                </footer>

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
