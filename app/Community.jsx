import React, { useState, useEffect } from "react";
import { useAppStore } from "./useAppStore.js";

function Community() {
    const [posts, setPosts] = useState([]);
    const [selectedComment, setSelectedComment] = useState(null);
    const [readCommentIds, setReadCommentIds] = useState([]);
    const [noReplyNeededCommentIds, setNoReplyNeededCommentIds] = useState([]);
    const [drafts, setDrafts] = useState({}); // Stores locally saved comment drafts
    const [lastSyncTime, setLastSyncTime] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [replyInput, setReplyInput] = useState("");
    const [submittingReply, setSubmittingReply] = useState(false);
    const [toast, setToast] = useState({ show: false, message: "", type: "success" });
    const [igUsername, setIgUsername] = useState("");
    
    // AI states
    const [generatingAi, setGeneratingAi] = useState(false);
    const [generatingFact, setGeneratingFact] = useState(false);
    const [globalAiProcessing, setGlobalAiProcessing] = useState(false);
    const [globalAiStatus, setGlobalAiStatus] = useState("");
    const [showAiMenu, setShowAiMenu] = useState(false);

    // Filters & Search
    const [currentFilter, setCurrentFilter] = useState("all"); // 'all', 'unread', 'unreplied'
    const [searchQuery, setSearchQuery] = useState("");
    const [commentsPage, setCommentsPage] = useState(1);
    const commentsPerPage = 8; // fits nicely without scrolling too much

    const setActivePage = useAppStore((state) => state.setActivePage);

    // Show toast message utility
    const showToast = (message, type = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: "", type: "success" }), 5000);
    };

    // Fetch Instagram comments, read state, and drafts
    const fetchComments = async (options = { forceRefresh: false }) => {
        setLoading(true);
        setError("");
        try {
            if (!window.api || !window.api.getIgComments || !window.api.getIgCommentsState || !window.api.getIgCommentsDrafts) {
                setError("API interface is not available in this environment.");
                setLoading(false);
                return;
            }
            
            // Fetch comments API
            const res = await window.api.getIgComments(options);
            // Fetch read state API
            const readStateRes = await window.api.getIgCommentsState();
            // Fetch drafts database
            const draftsRes = await window.api.getIgCommentsDrafts();

            if (res.success) {
                setPosts(res.data || []);
                setIgUsername(res.igUsername || "");
                if (res.lastSyncTime) {
                    setLastSyncTime(res.lastSyncTime);
                }
            } else {
                setError(res.error || "Failed to fetch comments.");
            }

            if (readStateRes && readStateRes.success) {
                setReadCommentIds(readStateRes.readCommentIds || []);
                setNoReplyNeededCommentIds(readStateRes.noReplyNeededCommentIds || []);
            }
            if (draftsRes && draftsRes.success) {
                setDrafts(draftsRes.drafts || {});
            }
        } catch (err) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments({ forceRefresh: false });
    }, []);

    // Check if a comment has been replied to by the owner
    const isRepliedTo = (comment) => {
        if (noReplyNeededCommentIds.includes(comment.id)) return true;
        return comment.isRepliedToComputed || false;
    };

    // Flatten comments from all posts and add post context
    const getFlattenedComments = () => {
        const list = [];
        posts.forEach(post => {
            const commentsData = post.comments?.data || [];
            commentsData.forEach(parentComment => {
                
                const myUsername = (igUsername || "").toLowerCase();
                const isOwner = (username) => username.toLowerCase() === myUsername || username.includes("You (Instagram Business Account)");
                
                const repliesData = [...(parentComment.replies?.data || [])];
                
                // Sort replies by timestamp ascending (oldest first)
                repliesData.sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return timeA - timeB;
                });
                
                // Add parent comment
                let parentReplied = false;
                if (repliesData.length > 0) {
                    parentReplied = repliesData.some(r => isOwner(r.username));
                }
                
                list.push({
                    ...parentComment,
                    isNested: false,
                    isRepliedToComputed: parentReplied,
                    post: {
                        id: post.id,
                        caption: post.caption,
                        permalink: post.permalink,
                        thumbnail_url: post.thumbnail_url || post.media_url,
                        media_type: post.media_type,
                        timestamp: post.timestamp
                    }
                });

                // Add nested comments
                repliesData.forEach((reply, index) => {
                    if (isOwner(reply.username)) return;

                    let replyReplied = false;
                    for (let i = index + 1; i < repliesData.length; i++) {
                        if (isOwner(repliesData[i].username)) {
                            replyReplied = true;
                            break;
                        }
                    }

                    list.push({
                        ...reply,
                        isNested: true,
                        parentCommentId: parentComment.id,
                        parentCommentUsername: parentComment.username,
                        isRepliedToComputed: replyReplied,
                        post: {
                            id: post.id,
                            caption: post.caption,
                            permalink: post.permalink,
                            thumbnail_url: post.thumbnail_url || post.media_url,
                            media_type: post.media_type,
                            timestamp: post.timestamp
                        }
                    });
                });
            });
        });
        // Sort newest comments first
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return list;
    };

    const flattenedComments = getFlattenedComments();

    // Counts for Folder Sidebar
    const totalCount = flattenedComments.length;
    const unreadCount = flattenedComments.filter(c => !readCommentIds.includes(c.id)).length;
    const unrepliedCount = flattenedComments.filter(c => !isRepliedTo(c)).length;
    const unrepliedCommentsWithDrafts = flattenedComments.filter(
        c => !isRepliedTo(c) && drafts[c.id] && drafts[c.id].trim()
    );

    // Filter and Search Comments
    const getFilteredComments = () => {
        let list = [...flattenedComments];

        // 1. Search Query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(c => 
                c.username.toLowerCase().includes(q) ||
                c.text.toLowerCase().includes(q)
            );
        }

        // 2. Folder Tab filter
        if (currentFilter === "unread") {
            list = list.filter(c => !readCommentIds.includes(c.id));
        } else if (currentFilter === "unreplied") {
            list = list.filter(c => !isRepliedTo(c));
        }

        return list;
    };

    const filteredComments = getFilteredComments();

    // Pagination
    const totalComments = filteredComments.length;
    const totalPages = Math.ceil(totalComments / commentsPerPage) || 1;
    const startIndex = (commentsPage - 1) * commentsPerPage;
    const paginatedComments = filteredComments.slice(startIndex, startIndex + commentsPerPage);

    // Reset page if filters or search changes
    useEffect(() => {
        setCommentsPage(1);
    }, [currentFilter, searchQuery]);

    // Handle clicking a comment in Middle Feed
    const handleSelectComment = async (comment) => {
        setSelectedComment(comment);
        // Load local draft if available, otherwise empty
        setReplyInput(drafts[comment.id] || "");
        
        // Mark as read if not already read
        if (!readCommentIds.includes(comment.id)) {
            const updated = [...readCommentIds, comment.id];
            setReadCommentIds(updated);
            try {
                await window.api.markIgCommentsRead([comment.id]);
            } catch (err) {
                console.error("Error marking comment as read:", err);
            }
        }
    };

    // Toggle comment read status manually from detail pane
    const toggleReadStatus = async (comment) => {
        if (!comment) return;
        const isRead = readCommentIds.includes(comment.id);
        let updated = [];
        try {
            if (isRead) {
                updated = readCommentIds.filter(id => id !== comment.id);
                setReadCommentIds(updated);
                await window.api.markIgCommentsUnread([comment.id]);
                showToast("Marked comment as unread");
            } else {
                updated = [...readCommentIds, comment.id];
                setReadCommentIds(updated);
                await window.api.markIgCommentsRead([comment.id]);
                showToast("Marked comment as read");
            }
        } catch (err) {
            showToast("Failed to update read status", "danger");
        }
    };

    // Toggle whether a comment needs no reply manually
    const toggleNoReplyStatus = async (comment) => {
        if (!comment) return;
        const isNoReply = noReplyNeededCommentIds.includes(comment.id);
        let updated = [];
        try {
            if (isNoReply) {
                updated = noReplyNeededCommentIds.filter(id => id !== comment.id);
                setNoReplyNeededCommentIds(updated);
                await window.api.unmarkIgCommentsNoReply([comment.id]);
                showToast("Comment marked as requiring reply");
            } else {
                updated = [...noReplyNeededCommentIds, comment.id];
                setNoReplyNeededCommentIds(updated);
                await window.api.markIgCommentsNoReply([comment.id]);
                showToast("Comment marked as no reply needed");
            }
        } catch (err) {
            showToast("Failed to update status", "danger");
        }
    };

    // Mark all current visible comments as read
    const handleMarkAllAsRead = async () => {
        if (filteredComments.length === 0) return;
        const visibleCommentIds = filteredComments.map(c => c.id);
        const updated = Array.from(new Set([...readCommentIds, ...visibleCommentIds]));
        setReadCommentIds(updated);
        try {
            await window.api.markAllIgCommentsRead(updated);
            showToast("All visible comments marked as read");
        } catch (err) {
            showToast("Failed to mark comments as read", "danger");
        }
    };

    // Handle updating text inside textarea and auto-saving to local drafts
    const handleTextareaChange = async (val) => {
        setReplyInput(val);
        if (selectedComment) {
            setDrafts(prev => ({ ...prev, [selectedComment.id]: val }));
            try {
                await window.api.saveIgCommentDraft(selectedComment.id, val);
            } catch (e) {
                console.error("Error saving draft to disk:", e);
            }
        }
    };

    // Local AI Reply Generator for the selected comment
    const handleGenerateAiReply = async () => {
        if (!selectedComment) return;
        setGeneratingAi(true);
        try {
            const res = await window.api.generateIgCommentReplyAi(selectedComment.id, selectedComment.text);
            if (res.success) {
                const reply = res.reply;
                setDrafts(prev => ({ ...prev, [selectedComment.id]: reply }));
                setReplyInput(reply);
                await window.api.saveIgCommentDraft(selectedComment.id, reply);
                showToast("AI reply drafted successfully!");
            } else {
                if (res.error === "NO_API_KEY") {
                    showToast(res.message, "danger");
                } else {
                    showToast(res.error || "Failed to generate reply.", "danger");
                }
            }
        } catch (err) {
            showToast(err.message || "Error generating AI reply.", "danger");
        } finally {
            setGeneratingAi(false);
        }
    };

    // Local Useless Fact Reply Generator for the selected comment
    const handleGenerateFactReply = async () => {
        if (!selectedComment) return;
        setGeneratingFact(true);
        try {
            const res = await window.api.getUselessFact();
            if (res.success) {
                const fact = res.fact;
                setDrafts(prev => ({ ...prev, [selectedComment.id]: fact }));
                setReplyInput(fact);
                await window.api.saveIgCommentDraft(selectedComment.id, fact);
                showToast("Useless fact drafted successfully!");
            } else {
                showToast(res.error || "Failed to fetch fact.", "danger");
            }
        } catch (err) {
            showToast(err.message || "Error fetching fact.", "danger");
        } finally {
            setGeneratingFact(false);
        }
    };

    // Global Action: Generate drafts for all unreplied comments in batch
    const handleGenerateAllDrafts = async () => {
        // Get all unreplied comments
        const unrepliedComments = flattenedComments.filter(c => !isRepliedTo(c));
        if (unrepliedComments.length === 0) {
            showToast("No unreplied comments to generate drafts for.");
            setShowAiMenu(false);
            return;
        }

        setGlobalAiProcessing(true);
        setGlobalAiStatus("Generating AI drafts for all unreplied comments...");
        setShowAiMenu(false);

        try {
            const res = await window.api.generateAllUnrepliedDraftsAi(
                unrepliedComments.map(c => ({ id: c.id, text: c.text }))
            );
            if (res.success) {
                setDrafts(res.drafts || {});
                if (selectedComment && res.drafts[selectedComment.id]) {
                    setReplyInput(res.drafts[selectedComment.id]);
                }
                showToast("AI drafts successfully created for all unreplied comments!");
            } else {
                if (res.error === "NO_API_KEY") {
                    showToast("OpenAI API Key is missing. Ask Antigravity in the chat to generate replies for you!", "danger");
                } else {
                    showToast(res.error || "Failed to generate drafts.", "danger");
                }
            }
        } catch (err) {
            showToast(err.message || "Error batch generating drafts.", "danger");
        } finally {
            setGlobalAiProcessing(false);
        }
    };

    // Global Action: Generate drafts & post replies to all unreplied comments immediately
    const handleGenerateAndPostAllReplies = async () => {
        const unrepliedComments = flattenedComments.filter(c => !isRepliedTo(c));
        if (unrepliedComments.length === 0) {
            showToast("No unreplied comments to reply to.");
            setShowAiMenu(false);
            return;
        }

        const confirmAction = window.confirm(`Are you sure you want to generate and post replies to ${unrepliedComments.length} comments? This will post directly to Instagram.`);
        if (!confirmAction) {
            setShowAiMenu(false);
            return;
        }

        setGlobalAiProcessing(true);
        setGlobalAiStatus("Generating drafts and posting to Instagram...");
        setShowAiMenu(false);

        try {
            const res = await window.api.generateAndPostAllRepliesAi(
                unrepliedComments.map(c => ({ id: c.id, text: c.text, parentCommentId: c.parentCommentId, username: c.username }))
            );
            if (res.success) {
                setDrafts(res.drafts || {});
                if (selectedComment) {
                    setReplyInput(res.drafts[selectedComment.id] || "");
                }
                const successCount = res.results.filter(r => r.success).length;
                const failCount = res.results.filter(r => !r.success).length;
                
                showToast(`Finished! Replied successfully: ${successCount}. Failed: ${failCount}.`);
                
                // Fetch fresh comments feed
                await fetchComments({ forceRefresh: false });
            } else {
                showToast(res.error || "Failed batch auto-replies.", "danger");
            }
        } catch (err) {
            showToast(err.message || "Error batch auto-replying.", "danger");
        } finally {
            setGlobalAiProcessing(false);
        }
    };

    // Global Action: Post all saved drafts to Instagram for unreplied comments
    const handlePostAllSavedDrafts = async () => {
        const unrepliedCommentsWithDrafts = flattenedComments.filter(
            c => !isRepliedTo(c) && drafts[c.id] && drafts[c.id].trim()
        );

        if (unrepliedCommentsWithDrafts.length === 0) {
            showToast("No saved drafts to post.");
            setShowAiMenu(false);
            return;
        }

        const confirmAction = window.confirm(`Are you sure you want to post ${unrepliedCommentsWithDrafts.length} saved drafts to Instagram?`);
        if (!confirmAction) {
            setShowAiMenu(false);
            return;
        }

        setGlobalAiProcessing(true);
        setGlobalAiStatus("Posting all saved drafts to Instagram...");
        setShowAiMenu(false);

        try {
            const res = await window.api.postAllSavedDraftsIg(
                unrepliedCommentsWithDrafts.map(c => ({ id: c.id, text: c.text, parentCommentId: c.parentCommentId, username: c.username }))
            );
            if (res.success) {
                setDrafts(res.drafts || {});
                if (selectedComment) {
                    setReplyInput(res.drafts[selectedComment.id] || "");
                }
                const successCount = res.results.filter(r => r.success).length;
                const failCount = res.results.filter(r => !r.success).length;
                
                showToast(`Finished posting drafts! Successfully posted: ${successCount}. Failed: ${failCount}.`);
                
                // Fetch fresh comments feed
                await fetchComments({ forceRefresh: false });
            } else {
                showToast(res.error || "Failed to post drafts.", "danger");
            }
        } catch (err) {
            showToast(err.message || "Error posting drafts.", "danger");
        } finally {
            setGlobalAiProcessing(false);
        }
    };

    // Post a single saved draft to Instagram
    const handlePostSingleDraft = async (commentId, draftText, parentPostId, parentCommentId) => {
        if (!draftText || !draftText.trim()) return;
        
        setGlobalAiProcessing(true);
        setGlobalAiStatus("Posting draft to Instagram...");
        
        try {
            const res = await window.api.replyToIgComment(commentId, draftText, parentCommentId);
            if (res.success) {
                showToast("Draft posted successfully to Instagram!");
                
                // Delete local draft
                try {
                    await window.api.deleteIgCommentDraft(commentId);
                } catch (e) {}
                
                setDrafts(prev => {
                    const copy = { ...prev };
                    delete copy[commentId];
                    return copy;
                });

                // If the currently selected comment is this one, clear the textarea
                if (selectedComment && selectedComment.id === commentId) {
                    setReplyInput("");
                }

                // Refresh feed
                await fetchComments({ forceRefresh: false });
            } else {
                showToast(res.error || "Failed to publish reply.", "danger");
            }
        } catch (err) {
            showToast(err.message || "Error submitting reply.", "danger");
        } finally {
            setGlobalAiProcessing(false);
        }
    };

    // Handle posting a single reply to Instagram
    const handlePostReply = async () => {
        if (!selectedComment || !replyInput.trim()) return;

        setSubmittingReply(true);
        try {
            const res = await window.api.replyToIgComment(selectedComment.id, replyInput, selectedComment.parentCommentId);
            if (res.success) {
                showToast("Reply published successfully to Instagram!");
                setReplyInput("");

                // Delete local draft
                try {
                    await window.api.deleteIgCommentDraft(selectedComment.id);
                } catch (e) {}
                setDrafts(prev => {
                    const copy = { ...prev };
                    delete copy[selectedComment.id];
                    return copy;
                });

                const newReply = {
                    id: res.data.id || String(Date.now()),
                    text: replyInput.trim(),
                    username: igUsername || "You (Instagram Business Account)",
                    timestamp: new Date().toISOString(),
                    like_count: 0
                };

                // Update original posts list state
                setPosts(prevPosts => {
                    return prevPosts.map(post => {
                        if (post.id !== selectedComment.post.id) return post;
                        if (!post.comments?.data) return post;
                        const targetParentId = selectedComment.parentCommentId || selectedComment.id;
                        const updatedComments = post.comments.data.map(comment => {
                            if (comment.id === targetParentId) {
                                const repliesList = comment.replies?.data || [];
                                return {
                                    ...comment,
                                    replies: {
                                        data: [...repliesList, newReply]
                                    }
                                };
                            }
                            return comment;
                        });
                        return {
                            ...post,
                            comments: {
                                data: updatedComments
                            }
                        };
                    });
                });

                // Update selected comment context
                setSelectedComment(prev => {
                    if (!prev) return null;
                    const repliesList = prev.replies?.data || [];
                    return {
                        ...prev,
                        replies: {
                            data: [...repliesList, newReply]
                        }
                    };
                });
            } else {
                showToast(res.error || "Failed to publish reply.", "danger");
            }
        } catch (err) {
            showToast(err.message || "Error submitting reply.", "danger");
        } finally {
            setSubmittingReply(false);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getAvatarLetter = (username) => {
        if (!username) return "U";
        return username.charAt(0).toUpperCase();
    };

    // Generates a consistent hash number from a string
    const getHashCode = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    };

    // Generates a beautiful gradient background based on username hash
    const getAvatarGradient = (username) => {
        if (!username) return "linear-gradient(135deg, #64748b, #475569)";
        const hash = getHashCode(username);
        const hue1 = hash % 360;
        const hue2 = (hue1 + 40) % 360;
        return `linear-gradient(135deg, hsl(${hue1}, 75%, 60%), hsl(${hue2}, 85%, 50%))`;
    };

    const renderReplies = (replies) => {
        const list = replies?.data || [];
        if (list.length === 0) return null;

        return (
            <div style={{ marginLeft: "42px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px", borderLeft: "2px solid rgba(255, 255, 255, 0.05)", paddingLeft: "16px" }}>
                {list.map((reply) => {
                    const isOwner = reply.username.toLowerCase() === (igUsername || "").toLowerCase();
                    return (
                        <div key={reply.id} style={{ 
                            display: "flex", 
                            gap: "12px", 
                            background: isOwner ? "rgba(0, 255, 198, 0.02)" : "rgba(255,255,255,0.01)", 
                            padding: "12px 14px", 
                            borderRadius: "12px", 
                            border: isOwner ? "1px solid rgba(0, 255, 198, 0.05)" : "1px solid rgba(255,255,255,0.02)" 
                        }}>
                            <div style={{
                                width: "24px", height: "24px", borderRadius: "50%",
                                background: getAvatarGradient(reply.username),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "10px", fontWeight: "bold", color: "#fff"
                            }}>
                                {getAvatarLetter(reply.username)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                    <span style={{ fontWeight: "bold", fontSize: "12.5px", color: isOwner ? "var(--accent)" : "#f1f5f9" }}>
                                        @{reply.username} {isOwner && " (You)"}
                                    </span>
                                    <span style={{ color: "var(--muted)", fontSize: "11px" }}>{formatDate(reply.timestamp)}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1", lineHeight: "1.4" }}>{reply.text}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="page-panel" style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            {/* Global AI Progress Overlay */}
            {globalAiProcessing && (
                <div style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(15, 23, 42, 0.85)",
                    zIndex: 10000,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px",
                    backdropFilter: "blur(8px)"
                }}>
                    <span style={{ fontSize: "50px", display: "inline-block", animation: "spin 2s linear infinite" }}>🤖</span>
                    <h3 style={{ margin: 0, color: "#fff", fontSize: "18px" }}>{globalAiStatus}</h3>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: "13.5px" }}>
                        Please do not close the app. Calling API in progress...
                    </p>
                </div>
            )}

            {/* Toast Notifications */}
            {toast.show && (
                <div style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    zIndex: 9999,
                    padding: "12px 20px",
                    borderRadius: "12px",
                    background: toast.type === "danger" ? "rgba(239, 68, 68, 0.95)" : "rgba(16, 185, 129, 0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "14px",
                    animation: "fadeIn 0.2s ease-out"
                }}>
                    <span style={{ fontSize: "18px" }}>{toast.type === "danger" ? "⚠️" : "✨"}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header Section */}
            <div className="page-heading" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "16px", paddingBottom: "12px", marginBottom: "0", borderBottom: "1px solid var(--border)" }}>
                <div>
                    <span className="page-eyebrow">Engagement</span>
                    <h1 className="page-title" style={{ fontSize: "2rem", margin: "4px 0 0" }}>Instagram Comments Inbox</h1>
                    {lastSyncTime && (
                        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                            🕒 Last updated: {new Date(lastSyncTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(lastSyncTime).toLocaleDateString()})
                        </p>
                    )}
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                        onClick={() => fetchComments({ forceRefresh: false })}
                        disabled={loading}
                        className="console-button"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border)", color: "#fff" }}
                    >
                        {!loading && <span>⚡</span>}
                        <span>Fast Sync</span>
                    </button>
                    <button
                        onClick={() => fetchComments({ forceRefresh: true })}
                        disabled={loading}
                        className="console-button console-button-primary"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "12px" }}
                    >
                        {loading ? (
                            <span className="loading-spinner" style={{
                                width: "14px", height: "14px", border: "2px solid rgba(255, 255, 255, 0.3)",
                                borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block",
                                animation: "spin 0.8s linear infinite"
                            }} />
                        ) : (
                            <span>🔄</span>
                        )}
                        <span>Force Update All</span>
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center", gap: "20px", flex: 1 }}>
                    <div className="app-notice" style={{ maxWidth: "560px", width: "100%", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "bold" }}>Instagram API Error</h3>
                        <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>{error}</p>
                    </div>
                    {error.includes("missing") && (
                        <button
                            onClick={() => setActivePage("setup")}
                            className="console-button"
                            style={{ background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent)", fontWeight: "600", padding: "12px 24px", borderRadius: "12px" }}
                        >
                            Go to Setup Settings
                        </button>
                    )}
                </div>
            ) : loading && posts.length === 0 ? (
                /* Loading State Shimmer */
                <div style={{ display: "flex", gap: "20px", flex: 1, marginTop: "16px" }}>
                    <div style={{ width: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {[1, 2, 3].map(n => (
                            <div key={n} style={{ height: "45px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
                        ))}
                    </div>
                    <div style={{ width: "380px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} style={{ height: "85px", borderRadius: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
                        ))}
                    </div>
                    <div style={{ flex: 1, borderRadius: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
                </div>
            ) : flattenedComments.length === 0 ? (
                /* Empty State */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 20px", textAlign: "center", flex: 1 }}>
                    <span style={{ fontSize: "56px", marginBottom: "16px", filter: "drop-shadow(0 10px 15px rgba(0,255,198,0.2))" }}>💬</span>
                    <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>No Instagram Comments Found</h3>
                    <p style={{ color: "var(--muted)", maxWidth: "420px", margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
                        We couldn't find any recent comments on your Instagram Professional Account. Make sure you have uploaded videos with comments enabled.
                    </p>
                </div>
            ) : (
                /* 3-Pane Meta Business Suite Inbox Layout */
                <div style={{ display: "flex", flex: 1, gap: "20px", marginTop: "16px", height: "calc(100vh - 220px)", overflow: "hidden", minHeight: "0" }}>
                    
                    {/* Pane 1: Left Navigation Sidebar (Folders) */}
                    <div style={{ width: "200px", display: "flex", flexDirection: "column", gap: "8px", borderRight: "1px solid var(--border)", paddingRight: "16px", flexShrink: 0 }}>
                        <p style={{ margin: "0 0 10px 6px", fontSize: "11px", color: "var(--muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Folders
                        </p>
                        
                        {/* Folder: All Comments */}
                        <button
                            onClick={() => setCurrentFilter("all")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: "12px",
                                border: "1px solid " + (currentFilter === "all" ? "rgba(0, 255, 198, 0.2)" : "transparent"),
                                background: currentFilter === "all" ? "rgba(0, 255, 198, 0.06)" : "transparent",
                                color: currentFilter === "all" ? "#fff" : "var(--muted)",
                                fontSize: "13.5px",
                                fontWeight: currentFilter === "all" ? "700" : "600",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                            className="sidebar-folder-btn"
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "15px" }}>📥</span>
                                <span>All Comments</span>
                            </div>
                            <span style={{
                                fontSize: "10px",
                                fontWeight: "800",
                                padding: "2px 7px",
                                borderRadius: "10px",
                                background: currentFilter === "all" ? "rgba(0, 255, 198, 0.2)" : "rgba(255, 255, 255, 0.04)",
                                color: currentFilter === "all" ? "var(--accent)" : "var(--muted)"
                            }}>
                                {totalCount}
                            </span>
                        </button>

                        {/* Folder: Unread */}
                        <button
                            onClick={() => setCurrentFilter("unread")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: "12px",
                                border: "1px solid " + (currentFilter === "unread" ? "rgba(0, 132, 255, 0.3)" : "transparent"),
                                background: currentFilter === "unread" ? "rgba(0, 132, 255, 0.08)" : "transparent",
                                color: currentFilter === "unread" ? "#fff" : "var(--muted)",
                                fontSize: "13.5px",
                                fontWeight: currentFilter === "unread" ? "700" : "600",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                            className="sidebar-folder-btn"
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "15px", color: "#0084ff" }}>🔵</span>
                                <span>Unread</span>
                            </div>
                            {unreadCount > 0 && (
                                <span style={{
                                    fontSize: "10px",
                                    fontWeight: "800",
                                    padding: "2px 7px",
                                    borderRadius: "10px",
                                    background: "#0084ff",
                                    color: "#fff",
                                    boxShadow: "0 0 8px rgba(0, 132, 255, 0.4)"
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Folder: Not Replied */}
                        <button
                            onClick={() => setCurrentFilter("unreplied")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: "12px",
                                border: "1px solid " + (currentFilter === "unreplied" ? "rgba(245, 158, 11, 0.3)" : "transparent"),
                                background: currentFilter === "unreplied" ? "rgba(245, 158, 11, 0.08)" : "transparent",
                                color: currentFilter === "unreplied" ? "#fff" : "var(--muted)",
                                fontSize: "13.5px",
                                fontWeight: currentFilter === "unreplied" ? "700" : "600",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                            className="sidebar-folder-btn"
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "15px", color: "#fbbf24" }}>⏳</span>
                                <span>Not Replied</span>
                            </div>
                            {unrepliedCount > 0 && (
                                <span style={{
                                    fontSize: "10px",
                                    fontWeight: "800",
                                    padding: "2px 7px",
                                    borderRadius: "10px",
                                    background: "#fbbf24",
                                    color: "#0f111a",
                                    boxShadow: "0 0 8px rgba(251, 191, 36, 0.4)"
                                }}>
                                    {unrepliedCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Pane 2: Middle Inbox Feed (Comments list) */}
                    <div style={{ width: "380px", display: "flex", flexDirection: "column", gap: "12px", borderRight: "1px solid var(--border)", paddingRight: "16px", flexShrink: 0, height: "100%", minHeight: "0", position: "relative" }}>
                        
                        {/* Search Box */}
                        <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: "14px" }}>🔍</span>
                            <input
                                type="text"
                                placeholder="Search by user or content..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "10px 32px 10px 36px",
                                    borderRadius: "12px",
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px solid var(--border)",
                                    color: "#fff",
                                    fontSize: "13px",
                                    outline: "none",
                                    transition: "all 0.2s ease"
                                }}
                                className="inbox-search-input"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    style={{
                                        position: "absolute",
                                        right: "10px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        background: "none",
                                        border: "none",
                                        color: "var(--muted)",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                        padding: "4px"
                                    }}
                                >
                                    ❌
                                </button>
                            )}
                        </div>

                        {/* List Actions */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", position: "relative" }}>
                            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>
                                {totalComments} comment{totalComments !== 1 && "s"} found
                            </span>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                {/* AI Actions Dropdown Menu */}
                                <div style={{ position: "relative" }}>
                                    <button
                                        onClick={() => setShowAiMenu(!showAiMenu)}
                                        className="console-button"
                                        style={{
                                            background: "rgba(0, 255, 198, 0.05)",
                                            border: "1px solid rgba(0, 255, 198, 0.15)",
                                            color: "var(--accent)",
                                            fontSize: "11px",
                                            fontWeight: "700",
                                            padding: "4px 8px",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px"
                                        }}
                                    >
                                        <span>🤖 AI Actions</span>
                                        <span style={{ fontSize: "8px" }}>{showAiMenu ? "▲" : "▼"}</span>
                                    </button>
                                    
                                    {showAiMenu && (
                                        <div style={{
                                            position: "absolute",
                                            top: "28px",
                                            right: "0",
                                            background: "#1e293b",
                                            border: "1px solid var(--border)",
                                            borderRadius: "10px",
                                            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                                            zIndex: 100,
                                            width: "210px",
                                            display: "flex",
                                            flexDirection: "column",
                                            padding: "4px"
                                        }}>
                                            <button
                                                onClick={handleGenerateAllDrafts}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#fff",
                                                    fontSize: "12px",
                                                    textAlign: "left",
                                                    padding: "10px 12px",
                                                    borderRadius: "6px",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    width: "100%"
                                                }}
                                                className="ai-menu-item"
                                            >
                                                <span>🤖</span>
                                                <span>Generate AI Drafts (All)</span>
                                            </button>
                                            <button
                                                onClick={handleGenerateAndPostAllReplies}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#fff",
                                                    fontSize: "12px",
                                                    textAlign: "left",
                                                    padding: "10px 12px",
                                                    borderRadius: "6px",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    width: "100%"
                                                }}
                                                className="ai-menu-item"
                                            >
                                                <span>🚀</span>
                                                <span>Generate & Reply (All)</span>
                                            </button>
                                            <button
                                                onClick={handlePostAllSavedDrafts}
                                                disabled={unrepliedCommentsWithDrafts.length === 0}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#fff",
                                                    fontSize: "12px",
                                                    textAlign: "left",
                                                    padding: "10px 12px",
                                                    borderRadius: "6px",
                                                    cursor: unrepliedCommentsWithDrafts.length === 0 ? "default" : "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    width: "100%",
                                                    opacity: unrepliedCommentsWithDrafts.length === 0 ? 0.4 : 1
                                                }}
                                                className="ai-menu-item"
                                            >
                                                <span>📤</span>
                                                <span>Post All Saved Drafts ({unrepliedCommentsWithDrafts.length})</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleMarkAllAsRead}
                                    disabled={filteredComments.length === 0}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--accent)",
                                        fontSize: "11px",
                                        fontWeight: "700",
                                        cursor: filteredComments.length === 0 ? "default" : "pointer",
                                        opacity: filteredComments.length === 0 ? 0.4 : 1,
                                        padding: "4px 6px",
                                        transition: "opacity 0.2s ease"
                                    }}
                                >
                                    Mark all as read
                                </button>
                            </div>
                        </div>

                        {/* Comments List Feed */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1, paddingRight: "4px" }} className="custom-scrollbar">
                            {filteredComments.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--muted)", fontSize: "13.5px" }}>
                                    No comments match the filters.
                                </div>
                            ) : (
                                paginatedComments.map((comment) => {
                                    const isSelected = selectedComment && selectedComment.id === comment.id;
                                    const isRead = readCommentIds.includes(comment.id);
                                    const replied = isRepliedTo(comment);
                                    const hasDraft = drafts[comment.id] && drafts[comment.id].trim();
                                    return (
                                        <div
                                            key={comment.id}
                                            onClick={() => handleSelectComment(comment)}
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "8px",
                                                padding: "14px",
                                                borderRadius: "14px",
                                                cursor: "pointer",
                                                border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                                                background: isSelected
                                                    ? "linear-gradient(135deg, rgba(0, 255, 198, 0.1), rgba(0, 255, 198, 0.02))"
                                                    : isRead ? "rgba(255, 255, 255, 0.01)" : "rgba(255, 255, 255, 0.035)",
                                                boxShadow: !isRead && !isSelected ? "inset 0 0 10px rgba(0, 255, 198, 0.02)" : "none",
                                                transition: "all 0.2s ease",
                                                position: "relative"
                                            }}
                                            className="community-post-card"
                                        >
                                            <div style={{ display: "flex", gap: "10px" }}>
                                                {/* Avatar and unread badge */}
                                                <div style={{ position: "relative", flexShrink: 0 }}>
                                                    <div style={{
                                                        width: "32px", height: "32px", borderRadius: "50%",
                                                        background: getAvatarGradient(comment.username),
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontWeight: "bold", color: "#fff", fontSize: "12px"
                                                    }}>
                                                        {getAvatarLetter(comment.username)}
                                                    </div>
                                                    {!isRead && (
                                                        <span style={{
                                                            position: "absolute", top: "-2px", right: "-2px",
                                                            width: "9px", height: "9px", borderRadius: "50%",
                                                            background: "#0084ff", border: "1.5px solid var(--bg)",
                                                            boxShadow: "0 0 4px #0084ff"
                                                        }} />
                                                    )}
                                                </div>

                                                {/* Text detail */}
                                                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ 
                                                            fontWeight: isRead ? "600" : "800", 
                                                            fontSize: "13px", 
                                                            color: isRead ? "#cbd5e1" : "#fff" 
                                                        }}>
                                                            @{comment.username}
                                                        </span>
                                                        <span style={{ color: "var(--muted)", fontSize: "10.5px" }}>
                                                            {formatDate(comment.timestamp)}
                                                        </span>
                                                    </div>
                                                    <p style={{
                                                        margin: 0, 
                                                        fontSize: "12.5px", 
                                                        color: isRead ? "#cbd5e1" : "#fff",
                                                        fontWeight: isRead ? "normal" : "600",
                                                        whiteSpace: "nowrap", 
                                                        overflow: "hidden", 
                                                        textOverflow: "ellipsis"
                                                    }}>
                                                        {comment.isNested && <span style={{ color: "var(--accent)", marginRight: "4px" }}>@{comment.parentCommentUsername}</span>}
                                                        {comment.text}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Post Connection Context */}
                                            <div style={{ 
                                                display: "flex", 
                                                justifyContent: "space-between", 
                                                alignItems: "center", 
                                                marginTop: "4px", 
                                                background: "rgba(0,0,0,0.15)", 
                                                padding: "4px 8px", 
                                                borderRadius: "8px" 
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                                    {comment.post?.thumbnail_url ? (
                                                        <img 
                                                            src={comment.post.thumbnail_url} 
                                                            alt="" 
                                                            style={{ width: "16px", height: "16px", borderRadius: "3px", objectFit: "cover" }}
                                                        />
                                                    ) : (
                                                        <span style={{ fontSize: "10px" }}>📹</span>
                                                    )}
                                                    <span style={{ 
                                                        fontSize: "10.5px", 
                                                        color: "var(--muted)", 
                                                        whiteSpace: "nowrap", 
                                                        overflow: "hidden", 
                                                        textOverflow: "ellipsis",
                                                        maxWidth: "160px"
                                                    }}>
                                                        {comment.post?.caption || "View Clip"}
                                                    </span>
                                                </div>
                                                
                                                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                                    {hasDraft && (
                                                        <span style={{ 
                                                            fontSize: "8.5px", 
                                                            color: "#fb7185", 
                                                            background: "rgba(251,113,133,0.12)", 
                                                            padding: "1px 5px", 
                                                            borderRadius: "8px", 
                                                            fontWeight: "800",
                                                            letterSpacing: "0.02em"
                                                        }}>
                                                            🤖 DRAFT
                                                        </span>
                                                    )}
                                                    {hasDraft && !replied && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePostSingleDraft(comment.id, drafts[comment.id], comment.post?.id, comment.parentCommentId);
                                                            }}
                                                            style={{
                                                                fontSize: "9px",
                                                                color: "#0f172a",
                                                                background: "var(--accent)",
                                                                border: "none",
                                                                padding: "2px 6px",
                                                                borderRadius: "6px",
                                                                fontWeight: "800",
                                                                cursor: "pointer",
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "2px",
                                                                boxShadow: "0 2px 6px rgba(0, 255, 198, 0.3)",
                                                                transition: "all 0.2s ease"
                                                            }}
                                                            className="post-draft-card-btn"
                                                        >
                                                            🚀 Post
                                                        </button>
                                                    )}
                                                    <span style={{ 
                                                        fontSize: "9px", 
                                                        color: noReplyNeededCommentIds.includes(comment.id) ? "#94a3b8" : replied ? "#10b981" : "#fbbf24", 
                                                        background: noReplyNeededCommentIds.includes(comment.id) ? "rgba(148,163,184,0.12)" : replied ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", 
                                                        padding: "1px 6px", 
                                                        borderRadius: "10px", 
                                                        fontWeight: "800",
                                                        letterSpacing: "0.02em"
                                                    }}>
                                                        {noReplyNeededCommentIds.includes(comment.id) ? "DONE" : replied ? "REPLIED" : "UNREPLIED"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pagination controls */}
                        {totalPages > 1 && (
                            <div style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "12px 4px 0", borderTop: "1px solid var(--border)", flexShrink: 0
                            }}>
                                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                                    Page {commentsPage} of {totalPages}
                                </span>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                        disabled={commentsPage === 1}
                                        onClick={() => setCommentsPage(prev => Math.max(prev - 1, 1))}
                                        className="console-button"
                                        style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", opacity: commentsPage === 1 ? 0.4 : 1 }}
                                    >
                                        ◀ Prev
                                    </button>
                                    <button
                                        disabled={commentsPage === totalPages}
                                        onClick={() => setCommentsPage(prev => Math.min(prev + 1, totalPages))}
                                        className="console-button"
                                        style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", opacity: commentsPage === totalPages ? 0.4 : 1 }}
                                    >
                                        Next ▶
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pane 3: Right Details & Reply Panel */}
                    <div style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        border: "1px solid var(--border)",
                        borderRadius: "20px",
                        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.005))",
                        overflow: "hidden",
                        height: "100%",
                        minHeight: "0"
                    }}>
                        {selectedComment ? (
                            <>
                                {/* Selected Post Context Header */}
                                <div style={{
                                    padding: "16px 20px",
                                    borderBottom: "1px solid var(--border)",
                                    background: "rgba(255,255,255,0.01)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "16px",
                                    flexShrink: 0
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                                        <div style={{
                                            width: "36px", height: "46px", borderRadius: "6px", background: "#11151d",
                                            overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center"
                                        }}>
                                            {selectedComment.post?.thumbnail_url ? (
                                                <img
                                                    src={selectedComment.post.thumbnail_url}
                                                    alt=""
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: "12px" }}>📹</span>
                                            )}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "800" }}>
                                                Parent Media Post
                                            </p>
                                            <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "#f1f5f9", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {selectedComment.post?.caption || "Untitled Instagram Post"}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedComment.post?.permalink && (
                                        <a
                                            href={selectedComment.post.permalink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="console-button"
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                fontSize: "12px",
                                                padding: "6px 12px",
                                                borderRadius: "8px",
                                                textDecoration: "none",
                                                color: "#cbd4e3",
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            View Post ↗
                                        </a>
                                    )}
                                </div>

                                {/* Thread Action Header */}
                                <div style={{
                                    padding: "10px 20px",
                                    background: "rgba(255,255,255,0.005)",
                                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexShrink: 0
                                }}>
                                    <span style={{ fontWeight: "700", fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Conversation Thread
                                    </span>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => toggleNoReplyStatus(selectedComment)}
                                            style={{
                                                background: "rgba(255,255,255,0.02)",
                                                border: "1px solid var(--border)",
                                                color: noReplyNeededCommentIds.includes(selectedComment.id) ? "var(--accent)" : "#cbd5e1",
                                                fontSize: "11.5px",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                cursor: "pointer",
                                                fontWeight: "600",
                                                transition: "all 0.15s ease"
                                            }}
                                            className="console-button"
                                        >
                                            {noReplyNeededCommentIds.includes(selectedComment.id) ? "Require Reply ⏳" : "No Reply Needed ✓"}
                                        </button>
                                        <button
                                            onClick={() => toggleReadStatus(selectedComment)}
                                            style={{
                                                background: "rgba(255,255,255,0.02)",
                                                border: "1px solid var(--border)",
                                                color: "#cbd5e1",
                                                fontSize: "11.5px",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                cursor: "pointer",
                                                fontWeight: "600",
                                                transition: "all 0.15s ease"
                                            }}
                                            className="console-button"
                                        >
                                            {readCommentIds.includes(selectedComment.id) ? "Mark as Unread 🔵" : "Mark as Read ✅"}
                                        </button>
                                    </div>
                                </div>

                                {/* Conversation History (Scroll Area) */}
                                <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }} className="custom-scrollbar">
                                    {(() => {
                                        const activeParentComment = selectedComment.isNested 
                                            ? (() => {
                                                for (const p of posts) {
                                                    if (p.comments && p.comments.data) {
                                                        const found = p.comments.data.find(c => c.id === selectedComment.parentCommentId);
                                                        if (found) return found;
                                                    }
                                                }
                                                return selectedComment;
                                            })()
                                            : selectedComment;
                                        
                                        return (
                                            <>
                                                {/* Parent Comment Card */}
                                                <div style={{
                                                    display: "flex", gap: "12px", padding: "16px", borderRadius: "16px",
                                                    background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)"
                                                }}>
                                                    <div style={{
                                                        width: "36px", height: "36px", borderRadius: "50%",
                                                        background: getAvatarGradient(activeParentComment.username),
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontWeight: "bold", color: "#fff", fontSize: "14px", flexShrink: 0
                                                    }}>
                                                        {getAvatarLetter(activeParentComment.username)}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                                            <span style={{ fontWeight: "800", fontSize: "13.5px", color: "#fff" }}>
                                                                @{activeParentComment.username}
                                                            </span>
                                                            <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                                                                {formatDate(activeParentComment.timestamp)}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: "0 0 10px", fontSize: "14px", color: "#f1f5f9", lineHeight: "1.5", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                                                            {activeParentComment.text}
                                                        </p>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--muted)" }}>
                                                            ❤️ {activeParentComment.like_count || 0}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Thread Line separator */}
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 4px" }}>
                                                    <span style={{ fontWeight: "700", fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                        Replies ({activeParentComment.replies?.data?.length || 0})
                                                    </span>
                                                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
                                                </div>

                                                {/* Nested Replies */}
                                                {(!activeParentComment.replies || !activeParentComment.replies.data || activeParentComment.replies.data.length === 0) ? (
                                                    <div style={{ padding: "12px 6px", color: "var(--muted)", fontSize: "13px", fontStyle: "italic" }}>
                                                        No replies in this thread yet. Write a response below.
                                                    </div>
                                                ) : (
                                                    renderReplies(activeParentComment.replies)
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Inbox Thread Footer Reply form */}
                                <div style={{
                                    padding: "16px 20px",
                                    borderTop: "1px solid var(--border)",
                                    background: "rgba(255,255,255,0.015)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                    flexShrink: 0
                                }}>
                                    <textarea
                                        placeholder={`Reply to @${selectedComment.username}...`}
                                        value={replyInput}
                                        onChange={(e) => handleTextareaChange(e.target.value)}
                                        style={{
                                            width: "100%",
                                            minHeight: "60px",
                                            maxHeight: "120px",
                                            background: "var(--panel-alt)",
                                            color: "#fff",
                                            border: "1px solid var(--border)",
                                            borderRadius: "10px",
                                            padding: "10px 14px",
                                            fontSize: "13.5px",
                                            outline: "none",
                                            resize: "vertical",
                                            lineHeight: "1.4",
                                            transition: "border-color 0.2s"
                                        }}
                                        className="reply-textarea"
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <button
                                                disabled={generatingAi || generatingFact}
                                                onClick={handleGenerateAiReply}
                                                className="console-button"
                                                style={{
                                                    padding: "6px 12px",
                                                    borderRadius: "8px",
                                                    fontSize: "11px",
                                                    fontWeight: "700",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    background: "rgba(0, 255, 198, 0.05)",
                                                    border: "1px solid rgba(0, 255, 198, 0.2)",
                                                    color: "var(--accent)",
                                                    cursor: "pointer"
                                                }}
                                            >
                                                {generatingAi ? "🤖 Gen..." : "🤖 AI Reply"}
                                            </button>
                                            <button
                                                disabled={generatingAi || generatingFact}
                                                onClick={handleGenerateFactReply}
                                                className="console-button"
                                                style={{
                                                    padding: "6px 12px",
                                                    borderRadius: "8px",
                                                    fontSize: "11px",
                                                    fontWeight: "700",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    background: "rgba(245, 158, 11, 0.05)",
                                                    border: "1px solid rgba(245, 158, 11, 0.2)",
                                                    color: "#fbbf24",
                                                    cursor: "pointer"
                                                }}
                                            >
                                                {generatingFact ? "💡 Fact..." : "💡 Useless Fact"}
                                            </button>
                                            <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                                                as <strong style={{ color: "var(--accent)" }}>@{igUsername || "Instagram"}</strong>
                                            </span>
                                        </div>
                                        
                                        <button
                                            disabled={submittingReply || !replyInput.trim()}
                                            onClick={handlePostReply}
                                            className="console-button console-button-primary"
                                            style={{
                                                padding: "8px 18px",
                                                borderRadius: "10px",
                                                fontSize: "12px",
                                                fontWeight: "700",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px"
                                            }}
                                        >
                                            {submittingReply ? (
                                                <span className="loading-spinner" style={{
                                                    width: "12px", height: "12px", border: "1.5px solid rgba(255, 255, 255, 0.3)",
                                                    borderTop: "1.5px solid #fff", borderRadius: "50%", display: "inline-block",
                                                    animation: "spin 0.8s linear infinite"
                                                }} />
                                            ) : null}
                                            <span>
                                                {drafts[selectedComment.id] && replyInput === drafts[selectedComment.id] ? "🚀 Post Draft" : "Send Reply"}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", padding: "40px", textAlign: "center", gap: "16px" }}>
                                <span style={{ fontSize: "64px", filter: "drop-shadow(0 10px 15px rgba(0,255,198,0.15))" }}>📥</span>
                                <div>
                                    <h3 style={{ color: "#fff", margin: "0 0 4px", fontSize: "16px" }}>Inbox Open</h3>
                                    <p style={{ margin: 0, fontSize: "14px", maxWidth: "280px", lineHeight: "1.4" }}>
                                        Select any comment from the feed to view its post context and post a reply.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* Custom styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .sidebar-folder-btn:hover {
                    background: rgba(255, 255, 255, 0.02) !important;
                    color: #fff !important;
                }
                .community-post-card:hover {
                    background: rgba(255, 255, 255, 0.05) !important;
                    transform: translateX(2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                }
                .inbox-search-input:focus {
                    border-color: var(--accent) !important;
                    background: rgba(255,255,255,0.03) !important;
                    box-shadow: 0 0 8px rgba(0, 255, 198, 0.1);
                }
                .reply-textarea:focus {
                    border-color: var(--accent) !important;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                .ai-menu-item:hover {
                    background: rgba(255, 255, 255, 0.05) !important;
                }
                .post-draft-card-btn:hover {
                    background: #00ffc6 !important;
                    transform: scale(1.05);
                }
            `}} />
        </div>
    );
}

export default Community;
