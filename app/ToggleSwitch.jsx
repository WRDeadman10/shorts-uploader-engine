import { motion } from "framer-motion";

function ToggleSwitch(props)
{
    const { label, checked, onChange } = props;
    const trackClassName = checked ? "toggle-switch-track toggle-switch-track-active" : "toggle-switch-track";
    const thumbClassName = checked ? "toggle-switch-thumb toggle-switch-thumb-active" : "toggle-switch-thumb";

    return (
        <motion.button
            type="button"
            className="toggle-switch"
            aria-pressed={checked}
            onClick={function handleClick()
            {
                onChange(!checked);
            }}
            whileTap={{ scale: 0.98 }}
        >
            <span className="toggle-switch-label">{label}</span>
            <span className={trackClassName}>
                <span className={thumbClassName} />
            </span>
        </motion.button>
    );
}

export default ToggleSwitch;
