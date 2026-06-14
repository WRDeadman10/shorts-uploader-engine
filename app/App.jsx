import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import Dashboard from "./Dashboard.jsx";
import Library from "./Library.jsx";
import BatchEditor from "./BatchEditor.jsx";
import Upload from "./Upload.jsx";
import Audit from "./Audit.jsx";
import Topbar from "./Topbar.jsx";
import Setup from "./Setup.jsx";
import Community from "./Community.jsx";
import { pageOrder, useAppStore } from "./useAppStore.js";
import "./global.css";

const pageComponents = {
    dashboard: Dashboard,
    library: Library,
    editor: BatchEditor,
    upload: Upload,
    audit: Audit,
    community: Community,
    setup: Setup
};

function App()
{
    const activePage = useAppStore(function selectActivePage(state)
    {
        return state.activePage;
    });
    const errorMessage = useAppStore(function selectErrorMessage(state)
    {
        return state.errorMessage;
    });
    const appendLogEntry = useAppStore(function selectAppendLogEntry(state)
    {
        return state.appendLogEntry;
    });
    const initializeApp = useAppStore(function selectInitializeApp(state)
    {
        return state.initializeApp;
    });
    const syncUploadStatus = useAppStore(function selectSyncUploadStatus(state)
    {
        return state.syncUploadStatus;
    });
    const fetchVideoList = useAppStore(function selectFetchVideoList(state)
    {
        return state.fetchVideoList;
    });
    const CurrentPageComponent = pageComponents[activePage] || Dashboard;

    useEffect(function initializeRenderer()
    {
        initializeApp();

        if (!window.api || !window.api.onLog)
        {
            return undefined;
        }

        const unsubscribe = window.api.onLog(function handleLogEntry(entry)
        {
            appendLogEntry(entry);
        });
        const pollTimerId = window.setInterval(function pollUploadStatus()
        {
            syncUploadStatus();
        }, 2000);
        const refreshTimerId = window.setInterval(function refreshVideoData()
        {
            fetchVideoList();
        }, 10000);

        return function cleanupRenderer()
        {
            window.clearInterval(pollTimerId);
            window.clearInterval(refreshTimerId);

            if (unsubscribe)
            {
                unsubscribe();
            }
        };
    }, [appendLogEntry, fetchVideoList, initializeApp, syncUploadStatus]);

    return (
        <div className="app-shell">
            <Topbar />
            <div className="app-main">
                <main className="page-shell" style={{ padding: "20px 28px" }}>
                    {errorMessage ? <div className="app-notice">{errorMessage}</div> : null}
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
