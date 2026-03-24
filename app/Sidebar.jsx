import { motion } from "framer-motion";
import { pageOrder, useAppStore } from "./useAppStore.js";

function Sidebar()
{
    const activePage = useAppStore(function selectActivePage(state)
    {
        return state.activePage;
    });
    const setActivePage = useAppStore(function selectSetActivePage(state)
    {
        return state.setActivePage;
    });

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <span className="sidebar-brand-mark">CCC</span>
                <div>
                    <p className="sidebar-brand-name">Content</p>
                    <p className="sidebar-brand-name">Command Center</p>
                </div>
            </div>
            <nav className="sidebar-nav" aria-label="Primary">
                {pageOrder.map(function mapItem(item)
                {
                    const isActive = item.id === activePage;
                    const buttonClassName = isActive ? "sidebar-link sidebar-link-active" : "sidebar-link";

                    return (
                        <motion.button
                            key={item.id}
                            type="button"
                            className={buttonClassName}
                            onClick={function handleClick()
                            {
                                setActivePage(item.id);
                            }}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {item.label}
                        </motion.button>
                    );
                })}
            </nav>
        </aside>
    );
}

export default Sidebar;
