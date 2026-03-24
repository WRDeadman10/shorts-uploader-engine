import { motion } from "framer-motion";

function ProgressBar(props)
{
    const { value, label } = props;

    return (
        <div className="progress-bar">
            <div className="progress-bar-track">
                <motion.div
                    className="progress-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: value + "%" }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                />
            </div>
            <span className="progress-bar-label">{label}</span>
        </div>
    );
}

export default ProgressBar;
