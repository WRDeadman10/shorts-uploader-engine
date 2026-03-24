import { useAppStore } from "./useAppStore.js";

function Metadata()
{
    const title = useAppStore(function selectTitle(state)
    {
        return state.metadata.title;
    });
    const description = useAppStore(function selectDescription(state)
    {
        return state.metadata.description;
    });
    const musicTrack = useAppStore(function selectMusicTrack(state)
    {
        return state.metadata.musicTrack;
    });
    const musicOptions = useAppStore(function selectMusicOptions(state)
    {
        return state.musicOptions;
    });
    const setMetadataField = useAppStore(function selectSetMetadataField(state)
    {
        return state.setMetadataField;
    });

    return (
        <section className="metadata-page page-panel">
            <div className="page-heading">
                <span className="page-eyebrow">Metadata Builder</span>
                <h1 className="page-title">Content Packaging</h1>
                <p className="page-placeholder">Editing metadata updates the preview immediately.</p>
            </div>
            <div className="metadata-grid">
                <div className="metadata-form">
                    <label className="metadata-field">
                        <span className="metadata-label">Title</span>
                        <input
                            type="text"
                            className="metadata-input"
                            value={title}
                            onChange={function handleTitleChange(event)
                            {
                                setMetadataField("title", event.target.value);
                            }}
                        />
                    </label>
                    <label className="metadata-field">
                        <span className="metadata-label">Description</span>
                        <textarea
                            className="metadata-textarea"
                            rows="6"
                            value={description}
                            onChange={function handleDescriptionChange(event)
                            {
                                setMetadataField("description", event.target.value);
                            }}
                        />
                    </label>
                    <label className="metadata-field">
                        <span className="metadata-label">Music</span>
                        <select
                            className="metadata-select"
                            value={musicTrack}
                            onChange={function handleMusicChange(event)
                            {
                                setMetadataField("musicTrack", event.target.value);
                            }}
                        >
                            {musicOptions.map(function mapOption(option)
                            {
                                return (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                </div>
                <div className="metadata-preview">
                    <span className="metadata-label">Preview</span>
                    <div className="metadata-preview-card">
                        <p className="metadata-preview-title">{title || "Untitled Video"}</p>
                        <p className="metadata-preview-description">{description || "Description preview will appear here."}</p>
                        <p className="metadata-preview-music">Music: {musicTrack}</p>
                        <div className="metadata-preview-placeholder">Preview Placeholder</div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Metadata;
