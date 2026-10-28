import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { logout } from "../services/firebase";
import { subscribeToNotes, createNote, deleteNote, updateNotesOrder } from "../services/db";
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

    // Drag and Drop States
    const [draggableNoteId, setDraggableNoteId] = useState(null);
    const [draggedNoteId, setDraggedNoteId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [, setIsDragging] = useState(false);

    // Delete Confirmation State
    const [noteToDelete, setNoteToDelete] = useState(null);

    // Refs for interaction detection
    const clickTimerRef = useRef(null);
    const lastTapRef = useRef({ time: 0, id: null });
    const touchDraggedId = useRef(null);

    // Derive selected note from URL
    const noteId = searchParams.get("note");
    const selectedNote = notes.find(n => n.id === noteId) || null;

    // Sort notes respecting custom order or createdAt
    const applyOrder = (fetchedNotes) => {
        const userId = currentUser?.uid;
        const savedOrderJson = userId ? localStorage.getItem(`focuspad_order_${userId}`) : null;
        let savedOrder = null;
        if (savedOrderJson) {
            try { savedOrder = JSON.parse(savedOrderJson); } catch (e) { console.error(e); }
        }

        return [...fetchedNotes].sort((a, b) => {
            if (typeof a.order === 'number' && typeof b.order === 'number') {
                return a.order - b.order;
            }
            if (typeof a.order === 'number') return -1;
            if (typeof b.order === 'number') return 1;

            if (savedOrder && Array.isArray(savedOrder)) {
                const idxA = savedOrder.indexOf(a.id);
                const idxB = savedOrder.indexOf(b.id);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
            }

            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    };

    useEffect(() => {
        setLoading(true);
        setError(null);

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
                setNotes(applyOrder(fetchedNotes));
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
            await createNote("", newNoteTitle);
            setNewNoteTitle("");
            setIsCreating(false);
        } catch (err) {
            alert("Failed to create note. Please try again.");
        }
    };

    // Prompt deletion dialog
    const promptDelete = (e, note) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setNoteToDelete(note);
    };

    // Execute confirmed deletion
    const handleConfirmDelete = async () => {
        if (!noteToDelete) return;
        const targetId = noteToDelete.id;
        const targetNote = noteToDelete;

        // Dismiss dialog
        setNoteToDelete(null);

        // Optimistic delete: immediately remove from UI
        setNotes(prevNotes => prevNotes.filter(n => n.id !== targetId));

        // Close modal if deleted note was open
        if (noteId === targetId) {
            setSearchParams({});
        }

        // Clean up cached order
        const userId = currentUser?.uid;
        if (userId) {
            try {
                const saved = localStorage.getItem(`focuspad_order_${userId}`);
                if (saved) {
                    const ids = JSON.parse(saved).filter(nId => nId !== targetId);
                    localStorage.setItem(`focuspad_order_${userId}`, JSON.stringify(ids));
                }
            } catch (err) {
                console.warn(err);
            }
        }

        try {
            await deleteNote(targetId);
        } catch (error) {
            console.error("Failed to delete note:", error);
            // Revert state if server deletion fails
            if (targetNote) {
                setNotes(prev => [targetNote, ...prev]);
            }
            alert("Failed to delete note. Please try again.");
        }
    };

    // Close confirmation dialog on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && noteToDelete) {
                setNoteToDelete(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [noteToDelete]);

    // Reorder helper
    const reorderNotes = (sourceId, targetId) => {
        setNotes(prevNotes => {
            const sourceIdx = prevNotes.findIndex(n => n.id === sourceId);
            const targetIdx = prevNotes.findIndex(n => n.id === targetId);
            if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return prevNotes;

            const newNotes = [...prevNotes];
            const [movedNote] = newNotes.splice(sourceIdx, 1);
            newNotes.splice(targetIdx, 0, movedNote);

            // Persist order in Firestore and local storage
            updateNotesOrder(newNotes);

            return newNotes;
        });
    };

    // Double tap / Single click detection
    const handleNoteInteraction = (note) => {
        const now = Date.now();
        const isDoubleTap = (now - lastTapRef.current.time < 300) && (lastTapRef.current.id === note.id);
        lastTapRef.current = { time: now, id: note.id };

        if (isDoubleTap) {
            // Cancel single click open modal
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
            }
            // Toggle draggable mode for this note
            setDraggableNoteId(prev => (prev === note.id ? null : note.id));
        } else {
            // Delay single-click action to check for double-tap
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
                clickTimerRef.current = null;
                if (draggableNoteId === note.id) {
                    setDraggableNoteId(null);
                } else {
                    setSearchParams({ note: note.id });
                }
            }, 250);
        }
    };

    // HTML5 Drag & Drop handlers (Desktop)
    const handleDragStart = (e, noteId) => {
        setDraggedNoteId(noteId);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', noteId);
    };

    const handleDragOver = (e, noteId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverId !== noteId) {
            setDragOverId(noteId);
        }
    };

    const handleDragLeave = (e, noteId) => {
        if (dragOverId === noteId) {
            setDragOverId(null);
        }
    };

    const handleDrop = (e, targetNoteId) => {
        e.preventDefault();
        const sourceNoteId = draggedNoteId || e.dataTransfer.getData('text/plain');
        if (sourceNoteId && targetNoteId && sourceNoteId !== targetNoteId) {
            reorderNotes(sourceNoteId, targetNoteId);
        }
        setDraggedNoteId(null);
        setDragOverId(null);
        setIsDragging(false);
        setDraggableNoteId(null);
    };

    const handleDragEnd = () => {
        setDraggedNoteId(null);
        setDragOverId(null);
        setIsDragging(false);
        setDraggableNoteId(null);
    };

    // Touch Drag & Drop handlers (Mobile)
    const handleTouchStart = (e, noteId) => {
        if (draggableNoteId === noteId) {
            touchDraggedId.current = noteId;
            setDraggedNoteId(noteId);
            setIsDragging(true);
        }
    };

    const handleTouchMove = (e, noteId) => {
        if (!touchDraggedId.current || touchDraggedId.current !== noteId) return;
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCard = element?.closest('[data-note-id]');
        if (targetCard) {
            const targetId = targetCard.getAttribute('data-note-id');
            if (targetId && targetId !== noteId) {
                setDragOverId(targetId);
            }
        }
    };

    const handleTouchEnd = () => {
        if (touchDraggedId.current && dragOverId) {
            reorderNotes(touchDraggedId.current, dragOverId);
        }
        touchDraggedId.current = null;
        setDraggedNoteId(null);
        setDragOverId(null);
        setIsDragging(false);
        setDraggableNoteId(null);
    };

    const handleCloseModal = () => {
        setSearchParams({});
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.logo}>
                    FocusPad <span className={styles.logoDot}></span>
                </div>
                <div className={styles.userControls}>
                    <button onClick={toggleTheme} className={styles.themeBtn} title="Toggle Theme" aria-label="Toggle Theme">
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
                                placeholder="Take a note..."
                                autoFocus
                                value={newNoteTitle}
                                onChange={(e) => setNewNoteTitle(e.target.value)}
                                onBlur={() => {
                                    if (!newNoteTitle.trim()) setIsCreating(false);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateNote(e);
                                }}
                            />
                            <div className={styles.createActions}>
                                <button className={styles.createDoneBtn} onMouseDown={handleCreateNote}>Done</button>
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

                {/* Helpful reorder hint */}
                {notes.length > 1 && (
                    <div className={styles.reorderHint}>
                        <span className={styles.reorderHintIcon}>✨</span> Double tap any note to drag and move
                    </div>
                )}

                <div className={styles.grid}>
                    {notes.map(note => {
                        const isCardDraggable = draggableNoteId === note.id;
                        const isCardDragging = draggedNoteId === note.id;
                        const isCardDragOver = dragOverId === note.id;

                        return (
                            <div
                                key={note.id}
                                data-note-id={note.id}
                                draggable={isCardDraggable}
                                className={`${styles.noteCard} ${isCardDraggable ? styles.isDraggable : ''} ${isCardDragging ? styles.isDragging : ''} ${isCardDragOver ? styles.dragOver : ''}`}
                                onClick={() => handleNoteInteraction(note)}
                                onDoubleClick={() => setDraggableNoteId(note.id)}
                                onDragStart={(e) => handleDragStart(e, note.id)}
                                onDragOver={(e) => handleDragOver(e, note.id)}
                                onDragLeave={(e) => handleDragLeave(e, note.id)}
                                onDrop={(e) => handleDrop(e, note.id)}
                                onDragEnd={handleDragEnd}
                                onTouchStart={(e) => handleTouchStart(e, note.id)}
                                onTouchMove={(e) => handleTouchMove(e, note.id)}
                                onTouchEnd={handleTouchEnd}
                            >
                                {isCardDraggable && (
                                    <div className={styles.dragBadge}>
                                        <span>⠿</span> Move
                                    </div>
                                )}

                                <div
                                    className={styles.noteTitle}
                                    dangerouslySetInnerHTML={{ __html: note.title || '<em style="opacity: 0.6">Untitled Note</em>' }}
                                />

                                <div className={styles.noteActions}>
                                    <button
                                        type="button"
                                        onClick={(e) => promptDelete(e, note)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        className={styles.iconBtn}
                                        title="Delete Note"
                                        aria-label="Delete Note"
                                    >
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            <line x1="10" y1="11" x2="10" y2="17" />
                                            <line x1="14" y1="11" x2="14" y2="17" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {loading && <p style={{ textAlign: 'center', color: 'var(--secondary-text)' }}>Loading notes...</p>}
                {!loading && notes.length === 0 && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>⚡</div>
                        <p>No notes yet. Capture your thoughts above!</p>
                    </div>
                )}

                <footer className={styles.footer}>
                    FocusPad v{__APP_VERSION__} <span className={styles.footerDot}></span> Modern Palette
                </footer>

                {selectedNote && (
                    <EditNoteModal
                        note={selectedNote}
                        onClose={handleCloseModal}
                    />
                )}

                {noteToDelete && (
                    <div className={styles.confirmOverlay} onClick={() => setNoteToDelete(null)}>
                        <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.confirmIconWrapper}>
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </div>
                            <h3 className={styles.confirmTitle}>Delete note?</h3>
                            <p className={styles.confirmMessage}>
                                Are you sure you want to permanently delete:
                                <span
                                    className={styles.confirmNotePreview}
                                    dangerouslySetInnerHTML={{ __html: noteToDelete.title || '<em>Untitled Note</em>' }}
                                />
                                This action cannot be undone.
                            </p>
                            <div className={styles.confirmActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => setNoteToDelete(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className={styles.deleteConfirmBtn}
                                    onClick={handleConfirmDelete}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
