import React from 'react';

const btnStyle = {
    padding: '2px 4px',
    borderRadius: 4,
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    height: 24,
    width: 24,
    transition: 'background 0.2s, border-color 0.2s',
    outline: 'none',
};

export function ActionInput({ value, style, onChange, ...props }) {
    const handleCopy = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(value || "");
        } catch (err) {
            console.error("Failed to copy: ", err);
        }
    };

    const handlePaste = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const text = await navigator.clipboard.readText();
            if (onChange) {
                onChange({ target: { value: text } });
            }
        } catch (err) {
            console.error("Failed to paste: ", err);
        }
    };

    const inputWidth = style?.width;
    let wrapperWidth = '100%';

    if (inputWidth !== undefined) {
        if (typeof inputWidth === 'number') {
            wrapperWidth = inputWidth + 56;
        } else if (typeof inputWidth === 'string' && inputWidth.endsWith('px')) {
            wrapperWidth = parseInt(inputWidth, 10) + 56;
        } else {
            wrapperWidth = inputWidth;
        }
    } else {
        wrapperWidth = 'auto';
    }

    return (
        <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 4, 
            width: wrapperWidth, 
            flex: inputWidth !== undefined ? 'none' : 1,
            minWidth: 0 
        }}>
            <input
                value={value || ""}
                onChange={onChange}
                style={{ ...style, width: '100%', flex: 1, minWidth: 0 }}
                {...props}
            />
            <button
                type="button"
                onClick={handleCopy}
                title="Copy value"
                style={btnStyle}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#334155';
                    e.currentTarget.style.borderColor = '#4f46e5';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1e293b';
                    e.currentTarget.style.borderColor = '#334155';
                }}
            >
                📋
            </button>
            <button
                type="button"
                onClick={handlePaste}
                title="Paste value"
                style={btnStyle}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#334155';
                    e.currentTarget.style.borderColor = '#4f46e5';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1e293b';
                    e.currentTarget.style.borderColor = '#334155';
                }}
            >
                📥
            </button>
        </div>
    );
}

export default ActionInput;
