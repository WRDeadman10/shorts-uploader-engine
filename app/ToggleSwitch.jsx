import { motion } from "framer-motion";

function ToggleSwitch(props)
{
    const { label, checked, onChange, disabled = false } = props;
    const trackClassName = checked ? "toggle-switch-track toggle-switch-track-active" : "toggle-switch-track";
    const thumbClassName = checked ? "toggle-switch-thumb toggle-switch-thumb-active" : "toggle-switch-thumb";

    return (
        <motion.button
            type="button"
            className="toggle-switch"
            aria-pressed={checked}
            disabled={disabled}
            onClick={function handleClick()
            {
                if (disabled) return;
                onChange(!checked);
            }}
            whileTap={{ scale: 0.98 }}
            style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
        >
            <span className="toggle-switch-label">{label}</span>
            <span className={trackClassName}>
                <span className={thumbClassName} />
            </span>
        </motion.button>
    );
}

export default ToggleSwitch;
