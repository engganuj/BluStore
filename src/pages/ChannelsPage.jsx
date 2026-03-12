import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useChannels,
  useAvailableChannels,
  useStartGoogleAuth,
  useSyncChannel,
  useDisconnectChannel,
  useConfigureChannel,
  useStartMetaAuth,
  useStartEtsyAuth,
  useStartTikTokAuth,
  useChannelStatus,
} from '../hooks/useAPI';
import { channelsAPI, productsAPI } from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingSpinner, Badge, StatusBadge, Card } from '../components/shared';

// Channel icons
const ChannelIcon = ({ type, className = "w-8 h-8" }) => {
  switch (type) {
    case 'google_merchant':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case 'meta_commerce':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'etsy':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#F1641E">
          <path d="M8.559 3.576c0-.381.076-.609.533-.609h5.469c.381 0 .609.076.609.533v2.438c0 .381-.076.609-.533.609H8.559V3.576zM5.121 1.138c-.381 0-.609.228-.609.609v20.506c0 .381.228.609.609.609h2.438c.381 0 .609-.228.609-.609V8.576h6.469l.076 3.469c0 .381.228.609.609.609h2.362c.381 0 .609-.228.609-.609V8.576h1.586c.381 0 .609-.228.609-.609V5.529c0-.381-.228-.609-.609-.609h-1.586V1.748c0-.381-.228-.609-.609-.609H5.121z"/>
        </svg>
      );
    case 'tiktok_shop':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#000000">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
        </svg>
      );
    case 'pinterest':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#E60023">
          <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
        </svg>
      );
    default:
      return (
        <div className={`${className} bg-gray-200 rounded-lg flex items-center justify-center`}>
          <span className="text-gray-500 text-xs">?</span>
        </div>
      );
  }
};

// StatusBadge is imported from shared components
// Channel status map for the shared StatusBadge
const CHANNEL_STATUS_MAP = {
  connected:    { bg: 'bg-success-100',  text: 'text-success-800' },
  pending:      { bg: 'bg-warning-100', text: 'text-warning-800' },
  error:        { bg: 'bg-red-100',    text: 'text-red-800' },
  disconnected: { bg: 'bg-gray-100',   text: 'text-gray-800' },
};

// Issue fix suggestions based on Google Merchant error codes
const getIssueFix = (code, description, productId) => {
  const codeLower = (code || '').toLowerCase();
  const descLower = (description || '').toLowerCase();
  
  if (descLower.includes('age group')) {
    return {
      suggestion: 'Set age group to "adult"',
      action: 'auto_fix',
      field: 'attributes.age_group',
      autoFixValue: 'adult',
      options: ['adult', 'kids', 'toddler', 'infant', 'newborn'],
      productId
    };
  }
  
  if (descLower.includes('gender')) {
    return {
      suggestion: 'Set gender to "unisex"',
      action: 'auto_fix',
      field: 'attributes.gender',
      autoFixValue: 'unisex',
      options: ['unisex', 'male', 'female'],
      productId
    };
  }
  
  if (descLower.includes('color')) {
    return {
      suggestion: 'Add a color',
      action: 'input_fix',
      field: 'attributes.color',
      inputType: 'text',
      placeholder: 'e.g., Black, Navy Blue, Forest Green',
      productId
    };
  }
  
  if (descLower.includes('size')) {
    return {
      suggestion: 'Add a size',
      action: 'input_fix',
      field: 'attributes.size',
      inputType: 'select',
      options: ['One Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      productId
    };
  }
  
  if (codeLower.includes('item_missing_required_attribute') || descLower.includes('missing product image')) {
    return {
      suggestion: 'Add a product image',
      action: 'upload_image',
      field: 'images',
      productId
    };
  }
  
  if (codeLower.includes('image_link_broken')) {
    return {
      suggestion: 'Fix image URL - use JPG, PNG, or GIF format',
      action: 'upload_image',
      field: 'images',
      productId
    };
  }
  
  if (codeLower.includes('shipping')) {
    return {
      suggestion: 'Configure shipping in Google Merchant Center',
      action: 'external_link',
      link: 'https://merchants.google.com/mc/shipping/settings',
      productId
    };
  }
  
  if (codeLower.includes('url_does_not_match') || descLower.includes('mismatched')) {
    return {
      suggestion: 'Verify your store domain in Google Merchant Center',
      action: 'external_link', 
      link: 'https://merchants.google.com/mc/settings/website',
      productId
    };
  }
  
  if (codeLower.includes('landing_page_error')) {
    return {
      suggestion: 'Product page must be accessible - check your store is live and not password protected',
      action: 'external_link',
      link: 'https://merchants.google.com',
      productId
    };
  }
  
  if (codeLower.includes('pending_initial_policy_review')) {
    return {
      suggestion: 'Wait 1-3 business days for Google\'s initial review',
      action: 'wait',
      productId
    };
  }
  
  return { 
    suggestion: 'Review this issue in Google Merchant Center', 
    action: 'external_link', 
    link: 'https://merchants.google.com',
    productId 
  };
};

// Connected channel card with status checking
const ConnectedChannelCard = ({ channel, onSync, onDisconnect, onReconnect, onCheckStatus, onApplyFix, isSyncing, isConnecting, statusData, isCheckingStatus, applyingFixes }) => {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [inputValues, setInputValues] = useState({});
  const isDemo = channel.config?.demo_mode === true;
  const isDisconnected = channel.status === 'disconnected';
  
  const stats = statusData?.summary || {
    approved: channel.products_approved || 0,
    pending: channel.products_pending || 0,
    disapproved: channel.products_disapproved || 0,
    total: channel.products_synced || 0
  };
  const issues = statusData?.issues || [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ChannelIcon type={channel.type} className="w-10 h-10" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{channel.name}</h3>
              {isDemo && (
                <span className="px-2 py-0.5 bg-navy-100 text-navy-700 text-xs font-medium rounded-full">
                  Demo
                </span>
              )}
            </div>
            <StatusBadge status={channel.status} map={CHANNEL_STATUS_MAP} />
          </div>
        </div>
        {!isDisconnected && !isDemo && (
          <button
            onClick={() => onCheckStatus(channel.id)}
            disabled={isCheckingStatus}
            className="text-xs px-2 py-1 text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
          >
            {isCheckingStatus ? 'Checking...' : '↻ Refresh Status'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Synced</p>
        </div>
        <div className="bg-success-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success-600">{stats.approved}</p>
          <p className="text-xs text-gray-500">Approved</p>
        </div>
        <div className="bg-warning-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-warning-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div 
          className={`bg-red-50 rounded-lg p-3 text-center ${issues.length > 0 ? 'cursor-pointer hover:bg-red-100 transition-colors' : ''}`}
          onClick={() => issues.length > 0 && setShowIssues(!showIssues)}
        >
          <p className="text-2xl font-bold text-red-600">{stats.disapproved}</p>
          <p className="text-xs text-gray-500">
            {issues.length > 0 ? `Issues ${showIssues ? '▼' : '▶'}` : 'Issues'}
          </p>
        </div>
      </div>

      {/* Issues Panel */}
      {showIssues && issues.length > 0 && (
        <div className="mb-4 border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-3 py-2 border-b border-red-200 flex items-center justify-between">
            <p className="text-sm font-medium text-red-800">Product Issues ({issues.length})</p>
            {issues.some(i => getIssueFix(i.code, i.description, i.product_id).action === 'auto_fix') && (
              <button
                onClick={() => {
                  const autoFixable = issues.filter(i => getIssueFix(i.code, i.description, i.product_id).action === 'auto_fix');
                  autoFixable.forEach(issue => {
                    const fix = getIssueFix(issue.code, issue.description, issue.product_id);
                    onApplyFix(issue.product_id, fix.field, fix.autoFixValue);
                  });
                }}
                disabled={applyingFixes}
                className="text-xs px-2 py-1 bg-success-600 text-white rounded hover:bg-success-700 disabled:opacity-50 transition-colors"
              >
                ✨ Fix All Auto-Fixable
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {issues.map((issue, idx) => {
              const fix = getIssueFix(issue.code, issue.description, issue.product_id);
              const issueKey = `${issue.product_id}-${issue.code}`;
              const isApplying = applyingFixes?.[issueKey];
              
              return (
                <div key={idx} className="px-3 py-3 border-b border-red-100 last:border-0 bg-white">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {issue.product_id?.split(':').pop() || 'Unknown Product'}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">{issue.description || issue.code}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-2 mt-2">
                    <p className="text-xs text-gray-600 mb-2">💡 {fix.suggestion}</p>
                    
                    {fix.action === 'auto_fix' && (
                      <div className="flex items-center gap-2">
                        <select
                          value={inputValues[issueKey] || fix.autoFixValue}
                          onChange={(e) => setInputValues(prev => ({ ...prev, [issueKey]: e.target.value }))}
                          className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-success-500 focus:border-transparent"
                        >
                          {fix.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => onApplyFix(issue.product_id, fix.field, inputValues[issueKey] || fix.autoFixValue)}
                          disabled={isApplying}
                          className="text-xs px-3 py-1.5 bg-success-600 text-white rounded hover:bg-success-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {isApplying ? '...' : 'Apply'}
                        </button>
                      </div>
                    )}
                    
                    {fix.action === 'input_fix' && fix.inputType === 'text' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={inputValues[issueKey] || ''}
                          onChange={(e) => setInputValues(prev => ({ ...prev, [issueKey]: e.target.value }))}
                          placeholder={fix.placeholder}
                          className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-success-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => onApplyFix(issue.product_id, fix.field, inputValues[issueKey])}
                          disabled={isApplying || !inputValues[issueKey]}
                          className="text-xs px-3 py-1.5 bg-success-600 text-white rounded hover:bg-success-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {isApplying ? '...' : 'Apply'}
                        </button>
                      </div>
                    )}

                    {fix.action === 'input_fix' && fix.inputType === 'select' && (
                      <div className="flex items-center gap-2">
                        <select
                          value={inputValues[issueKey] || ''}
                          onChange={(e) => setInputValues(prev => ({ ...prev, [issueKey]: e.target.value }))}
                          className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-success-500 focus:border-transparent"
                        >
                          <option value="">Select {fix.field.split('.').pop()}...</option>
                          {fix.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => onApplyFix(issue.product_id, fix.field, inputValues[issueKey])}
                          disabled={isApplying || !inputValues[issueKey]}
                          className="text-xs px-3 py-1.5 bg-success-600 text-white rounded hover:bg-success-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {isApplying ? '...' : 'Apply'}
                        </button>
                      </div>
                    )}

                    {fix.action === 'external_link' && (
                      <a
                        href={fix.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
                      >
                        Open in Merchant Center →
                      </a>
                    )}
                    
                    {fix.action === 'navigate' && (
                      <a
                        href={fix.link}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
                      >
                        Go to Settings →
                      </a>
                    )}
                    
                    {fix.action === 'upload_image' && (
                      <a
                        href={`/products/${issue.product_id?.split(':').pop()}`}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-navy-100 text-navy-700 rounded hover:bg-navy-200 transition-colors"
                      >
                        📷 Add Image in Product Editor →
                      </a>
                    )}
                    
                    {fix.action === 'wait' && (
                      <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded">
                        ⏳ No action needed - just wait
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="bg-warning-50 px-3 py-2 border-t border-warning-200">
            <p className="text-xs text-warning-800">After applying fixes, click <strong>Sync Products</strong> to update Google Merchant Center.</p>
          </div>
        </div>
      )}

      {/* Last sync */}
      {channel.last_sync_at && (
        <p className="text-xs text-gray-500 mb-4">
          Last synced: {new Date(channel.last_sync_at).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isDisconnected ? (
          <button
            onClick={() => onReconnect(channel.type)}
            disabled={isConnecting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg font-medium hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Reconnect
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => onSync(channel.id)}
            disabled={isSyncing || channel.status !== 'connected'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSyncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Products
              </>
            )}
          </button>
        )}

        {showDisconnectConfirm ? (
          <div className="flex gap-2">
            <button
              onClick={() => { onDisconnect(channel.id); setShowDisconnectConfirm(false); }}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowDisconnectConfirm(false)}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDisconnectConfirm(true)}
            className="px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Disconnect channel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>

      {/* Error message */}
      {channel.last_error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{channel.last_error}</p>
        </div>
      )}
    </div>
  );
};

// Available channel card
const AvailableChannelCard = ({ channel, onConnect, isConnecting }) => {
  const isComingSoon = channel.status === 'coming_soon';

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${isComingSoon ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4 mb-4">
        <ChannelIcon type={channel.type} className="w-12 h-12" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{channel.name}</h3>
            {isComingSoon && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{channel.description}</p>
        </div>
      </div>

      {/* Features */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {channel.features?.map((feature, i) => (
            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* Connect button */}
      <button
        onClick={() => onConnect(channel.type)}
        disabled={isComingSoon || isConnecting}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
          isComingSoon
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'
        }`}
      >
        {isConnecting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Connecting...
          </>
        ) : isComingSoon ? (
          'Coming Soon'
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Connect Channel
          </>
        )}
      </button>
    </div>
  );
};

function ChannelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusData, setStatusData] = useState({});
  const [checkingStatus, setCheckingStatus] = useState({});
  const [applyingFixes, setApplyingFixes] = useState({});
  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const { data: availableChannels = [], isLoading: availableLoading } = useAvailableChannels();
  const startGoogleAuth = useStartGoogleAuth();
  const startMetaAuth = useStartMetaAuth();
  const startEtsyAuth = useStartEtsyAuth();
  const startTikTokAuth = useStartTikTokAuth();
  const syncChannel = useSyncChannel();
  const disconnectChannel = useDisconnectChannel();

  // Handle OAuth callback messages
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const setup = searchParams.get('setup');

    if (connected) {
      if (setup === 'needs_merchant_account') {
        toast.success(
          'Google account connected! You\'ll need a Merchant Center account to sync products.',
          { duration: 6000 }
        );
        setTimeout(() => {
          toast(
            (t) => (
              <div>
                <p className="font-medium">Create a Merchant Center account</p>
                <p className="text-sm text-gray-600 mt-1">Visit merchants.google.com to set up your free account, then reconnect.</p>
                <a 
                  href="https://merchants.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:underline mt-2 inline-block"
                >
                  Open Merchant Center →
                </a>
              </div>
            ),
            { duration: 10000 }
          );
        }, 1000);
        searchParams.delete('setup');
      } else {
        toast.success(`${connected.replace('_', ' ')} connected successfully!`);
      }
      searchParams.delete('connected');
      setSearchParams(searchParams);
    }

    if (error) {
      const errorMessages = {
        'missing_params': 'Missing required parameters',
        'auth_failed': 'Authentication failed',
      };
      toast.error(errorMessages[error] || `Connection failed: ${error}`);
      searchParams.delete('error');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const handleConnect = (channelType) => {
    if (channelType === 'google_merchant') {
      startGoogleAuth.mutate();
    } else if (channelType === 'meta_commerce') {
      startMetaAuth.mutate({});
    } else if (channelType === 'etsy') {
      startEtsyAuth.mutate({ who_made: 'i_did', when_made: 'made_to_order' });
    } else if (channelType === 'tiktok_shop') {
      startTikTokAuth.mutate({ region: 'US' });
    } else {
      toast.error(`${channelType} connection not yet implemented`);
    }
  };

  const handleSync = (channelId) => {
    syncChannel.mutate({ id: channelId });
  };

  const handleDisconnect = (channelId) => {
    disconnectChannel.mutate(channelId);
  };

  const handleCheckStatus = async (channelId) => {
    setCheckingStatus(prev => ({ ...prev, [channelId]: true }));
    try {
      const response = await channelsAPI.getStatus(channelId);
      setStatusData(prev => ({ ...prev, [channelId]: response.data }));
      toast.success('Status refreshed from Google Merchant Center');
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Failed to fetch status');
    } finally {
      setCheckingStatus(prev => ({ ...prev, [channelId]: false }));
    }
  };

  // Apply a fix to a product, then user can resync
  const handleApplyFix = async (googleProductId, field, value) => {
    const sku = googleProductId?.split(':').pop();
    if (!sku) {
      toast.error('Could not identify product');
      return;
    }
    
    const issueKey = `${googleProductId}-${field}`;
    setApplyingFixes(prev => ({ ...prev, [issueKey]: true }));
    
    try {
      const productsRes = await productsAPI.getAll();
      const product = productsRes.data.products?.find(p => p.sku === sku);
      
      if (!product) {
        toast.error(`Product not found: ${sku}`);
        return;
      }
      
      let updateData = {};
      
      if (field.startsWith('attributes.')) {
        const attrKey = field.replace('attributes.', '');
        const currentAttrs = product.attributes || {};
        updateData.attributes = { ...currentAttrs, [attrKey]: value };
      } else {
        updateData[field] = value;
      }
      
      await productsAPI.update(product.id, updateData);
      
      toast.success(`Updated ${field.split('.').pop()} for ${product.name}`);
      
    } catch (error) {
      console.error('Error applying fix:', error);
      toast.error('Failed to apply fix');
    } finally {
      setApplyingFixes(prev => ({ ...prev, [issueKey]: false }));
    }
  };

  // Filter out connected channel types from available
  const connectedTypes = channels.map(c => c.type);
  const unconnectedChannels = availableChannels.filter(c => !connectedTypes.includes(c.type));

  const isLoading = channelsLoading || availableLoading;

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-4 sm:p-6">
        <Card>
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sales Channels</h1>
        <p className="text-gray-500 mt-1">
          Connect your store to marketplaces and shopping platforms to reach more customers
        </p>
      </div>

      {/* Connected Channels */}
      {channels.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Channels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {channels.map((channel) => (
              <ConnectedChannelCard
                key={channel.id}
                channel={channel}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onReconnect={handleConnect}
                onCheckStatus={handleCheckStatus}
                onApplyFix={handleApplyFix}
                isSyncing={syncChannel.isPending}
                isConnecting={startGoogleAuth.isPending || startMetaAuth.isPending || startEtsyAuth.isPending || startTikTokAuth.isPending}
                statusData={statusData[channel.id]}
                isCheckingStatus={checkingStatus[channel.id]}
                applyingFixes={applyingFixes}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Channels */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {channels.length > 0 ? 'Add More Channels' : 'Available Channels'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {unconnectedChannels.map((channel) => (
            <AvailableChannelCard
              key={channel.type}
              channel={channel}
              onConnect={handleConnect}
              isConnecting={startGoogleAuth.isPending || startMetaAuth.isPending || startEtsyAuth.isPending || startTikTokAuth.isPending}
            />
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="mt-8 p-4 bg-primary-50 border border-primary-200 rounded-xl">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-primary-900 font-medium">About Sales Channels</p>
            <p className="text-sm text-primary-700 mt-1">
              Sales channels sync your products to external platforms like Google Shopping and Facebook Shops. 
              Products are automatically formatted for each platform's requirements and kept in sync as you make changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChannelsPage;
