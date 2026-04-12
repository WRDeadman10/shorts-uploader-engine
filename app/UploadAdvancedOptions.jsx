import React from 'react';
import ToggleSwitch from './ToggleSwitch.jsx';

const UploadAdvancedOptions = ({ options, setUploadOption }) => {
  return (
    <React.Fragment>
      <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>Binary Paths</span>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <input
            type="text"
            value={options.ffmpegBin}
            onChange={(e) => setUploadOption('ffmpegBin', e.target.value)}
          />
          <input
            type="text"
            value={options.ffprobeBin}
            onChange={(e) => setUploadOption('ffprobeBin', e.target.value)}
          />
          <input
            type="text"
            value={options.excludeFiles}
            onChange={(e) => setUploadOption('excludeFiles', e.target.value)}
          />
        </div>
      </div>
      <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>Meta Credentials</span>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <input
            type="text"
            value={options.metaAccessToken}
            onChange={(e) => setUploadOption('metaAccessToken', e.target.value)}
          />
          <input
            type="text"
            value={options.igUserId}
            onChange={(e) => setUploadOption('igUserId', e.target.value)}
          />
          <input
            type="text"
            value={options.fbPageId}
            onChange={(e) => setUploadOption('fbPageId', e.target.value)}
          />
        </div>
      </div>
      <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>AI Metadata</span>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <input
            type="text"
            value={options.openaiModel || 'gpt-4.1-mini'}
            onChange={(e) => setUploadOption('openaiModel', e.target.value)}
          />
          <input
            type="text"
            value={options.channelName}
            onChange={(e) => setUploadOption('channelName', e.target.value)}
          />
          <input
            type="text"
            value={options.extraKeywords}
            onChange={(e) => setUploadOption('extraKeywords', e.target.value)}
          />
          <input
            type="text"
            value={options.language}
            onChange={(e) => setUploadOption('language', e.target.value)}
          />
          <input
            type="text"
            value={options.categoryId}
            onChange={(e) => setUploadOption('categoryId', e.target.value)}
          />
        </div>
      </div>
      <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>Music</span>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <input
            type="text"
            value={options.musicDir}
            onChange={(e) => setUploadOption('musicDir', e.target.value)}
          />
          <input
            type="text"
            value={options.musicInventory}
            onChange={(e) => setUploadOption('musicInventory', e.target.value)}
          />
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={options.musicVolume || 0.5}
            onChange={(e) => setUploadOption('musicVolume', parseFloat(e.target.value))}
          />
        </div>
      </div>
      <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>Meta Advanced</span>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <input
            type="text"
            value={options.metaGraphVersion}
            onChange={(e) => setUploadOption('metaGraphVersion', e.target.value)}
          />
          <input
            type="number"
            value={options.metaPollAttempts || 5}
            onChange={(e) => setUploadOption('metaPollAttempts', parseInt(e.target.value))}
          />
          <input
            type="number"
            value={options.metaPollInterval || 1000}
            onChange={(e) => setUploadOption('metaPollInterval', parseInt(e.target.value))}
          />
          <input
            type="number"
            value={options.metaRequestTimeout || 30000}
            onChange={(e) => setUploadOption('metaRequestTimeout', parseInt(e.target.value))}
          />
          <ToggleSwitch
            label="Skip Uploaded"
            checked={options.metaSkipUploaded !== false}
            onChange={(checked) => setUploadOption('metaSkipUploaded', checked)}
          />
          <ToggleSwitch
            label="Delete Converted"
            checked={options.metaDeleteConverted !== false}
            onChange={(checked) => setUploadOption('metaDeleteConverted', checked)}
          />
        </div>
      </div>
    </React.Fragment>
  );
};

export default UploadAdvancedOptions;
