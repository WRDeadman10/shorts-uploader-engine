import { AnimatePresence, motion } from "framer-motion";
import Dashboard from "./Dashboard.jsx";
import Library from "./Library.jsx";
import Upload from "./Upload.jsx";
import Console from "./Console.jsx";
import Audit from "./Audit.jsx";
import Metadata from "./Metadata.jsx";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { pageOrder, useAppStore } from "./useAppStore.js";
import "./global.css";

const pageComponents = {
    dashboard: Dashboard,
    library: Library,
    upload: Upload,
    console: Console,
    audit: Audit,
    metadata: Metadata
};

function App()
{
    const activePage = useAppStore(function selectActivePage(state)
    {
        return state.activePage;
    });
    const currentPage = pageOrder.find(function findPage(page)
    {
        return page.id === activePage;
    });
    const CurrentPageComponent = pageComponents[activePage] || Dashboard;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="app-main">
                <Topbar title={currentPage ? currentPage.label : "Dashboard"} />
                <main className="page-shell">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activePage}
                            className="page-motion-shell"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                            <CurrentPageComponent />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

export default App;
