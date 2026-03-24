import { motion } from "framer-motion";

function Card(props)
{
    const { title, value, subtitle, children } = props;

    return (
        <motion.section
            className="metric-card"
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
        >
            <div className="metric-card-header">
                <span className="metric-card-title">{title}</span>
                {value ? <strong className="metric-card-value">{value}</strong> : null}
            </div>
            {subtitle ? <p className="metric-card-subtitle">{subtitle}</p> : null}
            {children ? <div className="metric-card-content">{children}</div> : null}
        </motion.section>
    );
}

export default Card;
