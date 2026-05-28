import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge.jsx";
import { useAppStore } from "./useAppStore.js";

function Library()
{
    const selectedVideoId = useAppStore(function selectSelectedVideoId(state)
    {
        return state.selectedVideoId;
    });
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
    const selectVideo = useAppStore(function selectVideoAction(state)
    {
        return state.selectVideo;
    });
    const setActivePage = useAppStore(function selectSetActivePage(state) { return state.setActivePage; });
    const selectedVideo = useAppStore(function selectSelectedVideo(state) { return state.videoList.find(function(v) { return v.id === state.selectedVideoId; }) || null; });

    const [searchText, setSearchText] = useState("");
    const [sortOrder, setSortOrder] = useState("name-asc");

    useEffect(function loadVideoList()
    {
        fetchVideoList();
    }, [fetchVideoList]);

    // Filter by search text on top of platform filter
    var displayList = filteredVideoList;
    if (searchText) {
        var q = searchText.toLowerCase();
        displayList = displayList.filter(function matchSearch(v) {
            return (v.title || "").toLowerCase().includes(q) || (v.relativePath || "").toLowerCase().includes(q);
        });
    }
    // Sort
    displayList = displayList.slice().sort(function sortVideos(a, b) {
        if (sortOrder === "name-asc") return (a.title || "").localeCompare(b.title || "");
        if (sortOrder === "name-desc") return (b.title || "").localeCompare(a.title || "");
        return 0;
    });

    return (
        <section className="library-page page-panel">
            <div className="library-toolbar">
                <div className="page-heading">
                    <span className="page-eyebrow">Asset Library</span>
                    <h1 className="page-title">Video Inventory</h1>
                    <p className="page-placeholder">{displayList.length} / {videoList.length} videos</p>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input type="text" placeholder="Search videos..." value={searchText}
                        onChange={function handleSearch(e) { setSearchText(e.target.value); }}
                        style={{padding:"5px 10px",borderRadius:6,border:"1px solid #333",background:"#0d0d1a",color:"#ccc",fontSize:13,width:160}} />
                    <select value={sortOrder} onChange={function handleSort(e) { setSortOrder(e.target.value); }}
                        style={{padding:"5px 8px",borderRadius:6,border:"1px solid #333",background:"#0d0d1a",color:"#ccc",fontSize:13}}>
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                    </select>
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
                {displayList.map(function mapVideo(item)
                {
                    const cardClassName = item.id === selectedVideoId ? "library-card library-card-selected" : "library-card";

                    return (
                        <motion.article
                            key={item.id}
                            className={cardClassName}
                            onClick={function handleSelect()
                            {
 
                               selectVideo(item.id);
                            }}
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
                               <p className="library-card-path">{item.relativePath || "No relative path available"}</p>
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
            {selectedVideo !== null && (
                <div style={{ marginTop: 24, background: '#111827', borderRadius: 10, padding: 20 }}>
                    <h2 style={{ fontSize: 15, color: '#e2e8f0', marginBottom: 12 }}>Selected Video</h2>
                    <p style={{ fontSize: 13, color: '#e2e8f0', margin: '0 0 4px' }}>{selectedVideo.title}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px' }}>{selectedVideo.relativePath || 'No path'}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>{'Duration: ' + (selectedVideo.duration || 'Unknown')}</p>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: selectedVideo.yt ? '#4ade80' : '#6b7280' }}>{selectedVideo.yt ? 'YT: Yes' : 'YT: No'}</span>
                        <span style={{ fontSize: 12, color: selectedVideo.ig ? '#4ade80' : '#6b7280' }}>{selectedVideo.ig ? 'IG: Yes' : 'IG: No'}</span>
                        <span style={{ fontSize: 12, color: selectedVideo.fb ? '#4ade80' : '#6b7280' }}>{selectedVideo.fb ? 'FB: Yes' : 'FB: No'}</span>
                    </div>
                </div>
            )}
        </section>
    );
}

export default Library;
