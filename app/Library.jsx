import { useEffect } from "react";
import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge.jsx";
import { useAppStore } from "./useAppStore.js";

function Library()
{
    const videoList = useAppStore(function selectVideoList(state)
    {
        return state.videoList;
    });
    const videoFilter = useAppStore(function selectVideoFilter(state)
    {
        return state.videoFilter;
    });
    const filteredVideoList = useAppStore(function selectFilteredVideoList(state)
    {
        return state.getFilteredVideos();
    });
    const setVideoFilter = useAppStore(function selectSetVideoFilter(state)
    {
        return state.setVideoFilter;
    });
    const fetchVideoList = useAppStore(function selectFetchVideoList(state)
    {
        return state.fetchVideoList;
    });

    useEffect(function loadVideoList()
    {
        fetchVideoList();
    }, [fetchVideoList]);

    return (
        <section className="library-page page-panel">
            <div className="library-toolbar">
                <div className="page-heading">
                    <span className="page-eyebrow">Asset Library</span>
                    <h1 className="page-title">Video Inventory</h1>
                    <p className="page-placeholder">{videoList.length} assets available in the mock catalog.</p>
                </div>
                <label className="library-filter">
                    <span className="library-filter-label">Platform</span>
                    <select
                        className="library-filter-select"
                        value={videoFilter}
                        onChange={function handleChange(event)
                        {
                            setVideoFilter(event.target.value);
                        }}
                    >
                        <option value="ALL">All</option>
                        <option value="YT">YouTube</option>
                        <option value="IG">Instagram</option>
                        <option value="FB">Facebook</option>
                    </select>
                </label>
            </div>
            <div className="library-grid">
                {filteredVideoList.map(function mapVideo(item)
                {
                    return (
                        <motion.article
                            key={item.id}
                            className="library-card"
                            whileHover={{ y: -6, scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                            <div className="library-card-media">
                                <span>{item.thumbnail}</span>
                                <strong>{item.duration}</strong>
                            </div>
                            <div className="library-card-body">
                                <h3 className="library-card-title">{item.title}</h3>
                                <p className="library-card-subtitle">{item.statusText}</p>
                                <div className="library-card-statuses">
                                    {item.statuses.map(function mapStatus(status)
                                    {
                                        return <StatusBadge key={status} status={status} />;
                                    })}
                                </div>
                            </div>
                        </motion.article>
                    );
                })}
            </div>
        </section>
    );
}

export default Library;
