'use client';

import { UserMemory } from '@/lib/memory';

interface Props {
    open: boolean;
    onClose: () => void;
    memory: UserMemory;
    setMemory: React.Dispatch<React.SetStateAction<UserMemory>>;
    onSave: () => void;
    skillsInput: string;
    setSkillsInput: React.Dispatch<React.SetStateAction<string>>;
}

export default function SettingsModal({
    open,
    onClose,
    memory,
    setMemory,
    onSave,
    skillsInput,
    setSkillsInput,
}: Props) {
    if (!open) return null;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h2 style={{ fontSize: 24 }}>Personalization</h2>

                    <button onClick={onClose} style={closeBtn}>
                        ×
                    </button>
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                    <div>
                        <label style={labelStyle}>First Name</label>

                        <input
                            style={inputStyle}
                            value={memory.firstName || ''}
                            onChange={(e) =>
                                setMemory((prev) => ({
                                    ...prev,
                                    firstName: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Last Name</label>

                        <input
                            style={inputStyle}
                            value={memory.lastName || ''}
                            onChange={(e) =>
                                setMemory((prev) => ({
                                    ...prev,
                                    lastName: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Designation</label>

                        <input
                            style={inputStyle}
                            placeholder="Your designation (optional)"
                            value={memory.designation || ''}
                            onChange={(e) =>
                                setMemory((prev) => ({
                                    ...prev,
                                    designation: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Skills</label>

                        <input
                            style={inputStyle}
                            placeholder="Your skills (optional)"
                            value={skillsInput}
                            onChange={(e) => {
                                const value = e.target.value;

                                setSkillsInput(value);

                                setMemory((prev) => ({
                                    ...prev,
                                    skills: value
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                }));
                            }}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Interests</label>

                        <input
                            style={inputStyle}
                            placeholder="Your interests (example: english) (optional)"
                            value={memory.interests?.join(', ') || ''}
                            onChange={(e) =>
                                setMemory((prev) => ({
                                    ...prev,
                                    interests: e.target.value
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                }))
                            }
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Custom Instructions</label>

                        <textarea
                            style={{
                                ...inputStyle,
                                minHeight: 100,
                                resize: 'vertical',
                            }}
                            value={memory.customInstruction || ''}
                            placeholder="Do you want anything custom reply from AI (optional)"
                            onChange={(e) =>
                                setMemory((prev) => ({
                                    ...prev,
                                    customInstruction: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <label style={checkboxWrap}>
                        <input
                            type="checkbox"
                            checked={memory.englishLearner || false}
                            onChange={(e) =>
                                setMemory((prev) => ({
                                    ...prev,
                                    englishLearner: e.target.checked,
                                }))
                            }
                        />

                        I am learning English
                    </label>
                </div>

                <div style={footerStyle}>
                    <button onClick={onClose} style={cancelBtn}>
                        Cancel
                    </button>

                    <button onClick={onSave} style={saveBtn}>
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
};

const modalStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 620,
    background: '#141414',
    border: '1px solid #222',
    borderRadius: 18,
    padding: 24,
    color: '#fff',

    maxHeight: '90vh',
    overflowY: 'auto',

    position: 'relative',
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,

    position: 'sticky',
    top: 0,

    background: '#141414',

    paddingBottom: 12,

    zIndex: 5,
};

const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
};

const closeBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#777',
    fontSize: 24,
    cursor: 'pointer',

    position: 'sticky',
    top: 0,

    zIndex: 10,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    marginTop: 8,
    background: '#1b1b1b',
    border: '1px solid #2d2d2d',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
};

const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: '#999',
};

const checkboxWrap: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    fontSize: 14,
    color: '#ccc',
};

const cancelBtn: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: 10,
    border: '1px solid #333',
    background: 'transparent',
    color: '#bbb',
    cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: 10,
    border: 'none',
    background: '#245dff',
    color: '#fff',
    cursor: 'pointer',
};