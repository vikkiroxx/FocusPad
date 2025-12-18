import { useState, useEffect, useRef } from 'react';
import { updateNote } from '../services/db';
import styles from './EditNoteModal.module.css';

const EditNoteModal = ({ note, onClose }) => {
    const [content, setContent] = useState(note.content);
    const editorRef = useRef(null);
    const contentRef = useRef(note.content); // Keep track of latest content for auto-save
    const [showTools, setShowTools] = useState(false);
    const [title, setTitle] = useState(note.title || "");
    const titleRef = useRef(note.title || "");
    const selectionRef = useRef(null); // Store the cursor position/selection

    // Initial render of content
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = note.content || "";
        }
    }, []);

    // Save selection on every mouse/key event in editor to capture latest state
    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            selectionRef.current = selection.getRangeAt(0);
        }
    };

    // Auto-save logic
    useEffect(() => {
        const intervalId = setInterval(() => {
            const currentContent = contentRef.current;
            const currentTitle = titleRef.current;

            if (currentContent !== note.content || currentTitle !== note.title) {
                updateNote(note.id, {
                    content: currentContent,
                    title: currentTitle
                });
            }
        }, 2000);

        return () => clearInterval(intervalId);
    }, [note]);

    const handleInput = (e) => {
        const html = e.target.innerHTML;
        contentRef.current = html;
        setContent(html);
        saveSelection();
    };

    const handleTitleChange = (e) => {
        const newTitle = e.target.value;
        titleRef.current = newTitle;
        setTitle(newTitle);
    };

    const handleClose = () => {
        if (contentRef.current !== note.content || titleRef.current !== note.title) {
            updateNote(note.id, {
                content: contentRef.current,
                title: titleRef.current
            });
        }
        onClose();
    };

    const execCmd = (command, value = null) => {
        // Restore selection if we have one
        if (selectionRef.current) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(selectionRef.current);
        }

        document.execCommand(command, false, value);

        // Update content ref and save selection, but DO NOT force focus back
        // to avoid bringing up keyboard on mobile
        if (editorRef.current) {
            contentRef.current = editorRef.current.innerHTML;
            saveSelection();
        }
    };

    const handleToolSelect = (e, tool, value = null) => {
        e.preventDefault(); // Prevent button click from capturing focus or triggering defaults
        e.stopPropagation();

        setShowTools(false);
        switch (tool) {
            case 'bold':
                execCmd('bold');
                break;
            case 'italic':
                execCmd('italic');
                break;
            case 'underline':
                execCmd('underline');
                break;
            case 'fontSize':
                execCmd('fontSize', value);
                break;
            case 'highlight':
                execCmd('hiliteColor', '#fff59d'); // Yellow highlight
                break;
            case 'checkbox':
                const checkboxHtml = '&nbsp;<input type="checkbox" style="transform: scale(1.2); margin-right: 8px;">&nbsp;';
                execCmd('insertHTML', checkboxHtml);
                break;
            case 'drawing':
                alert('Drawing tool coming soon!');
                break;
            case 'image':
                alert('Image upload coming soon!');
                break;
            default:
                break;
        }
    };

    // Handle checkbox toggling with strikethrough
    const handleEditorClick = (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
            const checkbox = e.target;

            // Toggle the attribute for persistence
            if (checkbox.checked) {
                checkbox.setAttribute('checked', 'true');
            } else {
                checkbox.removeAttribute('checked');
            }

            // Find the immediate next text node or element to strike through
            let nextNode = checkbox.nextSibling;

            // Skip empty text nodes (like just spaces if any)
            while (nextNode && nextNode.nodeType === 3 && nextNode.textContent.trim().length === 0) {
                nextNode = nextNode.nextSibling;
            }

            if (nextNode) {
                // If it's a text node, wrap it in a span to apply style
                if (nextNode.nodeType === 3) {
                    const span = document.createElement('span');
                    span.textContent = nextNode.textContent;

                    if (checkbox.checked) {
                        span.style.textDecoration = 'line-through';
                        span.style.color = 'var(--secondary-text)';
                    }

                    nextNode.parentNode.replaceChild(span, nextNode);
                }
                // If it's already an element (like our span from before)
                else if (nextNode.nodeType === 1) {
                    if (checkbox.checked) {
                        nextNode.style.textDecoration = 'line-through';
                        nextNode.style.color = 'var(--secondary-text)';
                    } else {
                        nextNode.style.textDecoration = 'none';
                        nextNode.style.color = 'var(--text-color)';
                    }
                }
            }

            // Trigger auto-save immediately
            contentRef.current = editorRef.current.innerHTML;
            setContent(contentRef.current);
            updateNote(note.id, {
                content: contentRef.current,
                title: titleRef.current
            });
        }
    };

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

                <input
                    type="text"
                    className={styles.titleInput}
                    placeholder="Title"
                    value={title}
                    onChange={handleTitleChange}
                />

                <div className={styles.toolbar}>
                    <div className={styles.formatGroup}>
                        <button onMouseDown={(e) => handleToolSelect(e, 'bold')} className={styles.toolBtn} title="Bold">
                            <b>B</b>
                        </button>
                        <button onMouseDown={(e) => handleToolSelect(e, 'italic')} className={styles.toolBtn} title="Italic">
                            <i>I</i>
                        </button>
                        <button onMouseDown={(e) => handleToolSelect(e, 'underline')} className={styles.toolBtn} title="Underline">
                            <u>U</u>
                        </button>
                        <select
                            className={styles.fontSizeSelect}
                            onChange={(e) => handleToolSelect(e, 'fontSize', e.target.value)}
                            title="Font Size"
                            defaultValue="3"
                        >
                            <option value="1">Small</option>
                            <option value="3">Normal</option>
                            <option value="5">Large</option>
                            <option value="7">Huge</option>
                        </select>
                    </div>
                    <div className={styles.divider}></div>
                    <button onMouseDown={(e) => handleToolSelect(e, 'highlight')} className={styles.toolBtn} title="Highlight">
                        🖊️
                    </button>
                    <button onMouseDown={(e) => handleToolSelect(e, 'checkbox')} className={styles.toolBtn} title="Checklist">
                        ☑️
                    </button>
                    <div className={styles.dropdown}>
                        <button onMouseDown={(e) => { e.preventDefault(); setShowTools(!showTools); }} className={styles.addBtn} title="More Tools">
                            +
                        </button>
                        {showTools && (
                            <div className={styles.toolsMenu}>
                                <div className={styles.menuItem} onMouseDown={(e) => handleToolSelect(e, 'drawing')}>
                                    <span>🎨</span> Drawing
                                </div>
                                <div className={styles.menuItem} onMouseDown={(e) => handleToolSelect(e, 'image')}>
                                    <span>🖼️</span> Add Image
                                </div>
                                <div className={styles.menuItem} onMouseDown={(e) => handleToolSelect(e, 'photo')}>
                                    <span>📷</span> Take Photo
                                </div>
                                <div className={styles.menuItem}>
                                    <span>🎤</span> Recording
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    ref={editorRef}
                    className={styles.editor}
                    contentEditable
                    onInput={handleInput}
                    onClick={handleEditorClick}
                    onMouseUp={saveSelection}
                    onKeyUp={saveSelection}
                    suppressContentEditableWarning={true}
                />

                <button className={styles.closeBtn} onClick={handleClose}>Done</button>
            </div>
        </div>
    );
};

export default EditNoteModal;
