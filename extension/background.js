// Enhanced background script with better error handling and progress tracking

const CONFIG = {
    BACKEND_URL: 'http://localhost:8090',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT: 30000,
    MAX_HISTORY_ITEMS: 1000,
    EXCLUDED_DOMAINS: [
        'google.com', 'google.co.in', 'bing.com', 'duckduckgo.com',
        'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 
        'linkedin.com', 'tiktok.com', 'reddit.com'
    ],
    EXCLUDED_PATTERNS: [
        /\/search\?/, /\/results\?/, /\/feed/, /\/login/, /\/signup/,
        /\/cart/, /\/checkout/, /\.pdf$/, /\.(jpg|png|gif|mp4)$/
    ]
};

/**
 * Fetch browsing history from the last 24 hours
 */
async function fetchHistory() {
    const oneDayAgo = new Date().getTime() - 24 * 60 * 60 * 1000;
    
    return new Promise((resolve, reject) => {
        try {
            chrome.history.search({
                text: '',
                startTime: oneDayAgo,
                maxResults: CONFIG.MAX_HISTORY_ITEMS,
            }, (results) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                const historyItems = results
                    .filter(isValidHistoryItem)
                    .map(formatHistoryItem)
                    .slice(0, CONFIG.MAX_HISTORY_ITEMS); // Safety limit

                console.log(`Filtered ${historyItems.length} valid URLs from ${results.length} total`);
                resolve(historyItems);
            });
        } catch (error) {
            reject(new Error(`History fetch failed: ${error.message}`));
        }
    });
}

/**
 * Validate if history item should be processed
 */
function isValidHistoryItem(item) {
    if (!item.url || !item.title) return false;
    
    try {
        const url = new URL(item.url);
        const domain = url.hostname.toLowerCase().replace(/^www\./, '');
        
        // Check excluded domains
        if (CONFIG.EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded))) {
            return false;
        }
        
        // Check excluded patterns
        if (CONFIG.EXCLUDED_PATTERNS.some(pattern => pattern.test(item.url))) {
            return false;
        }
        
        // Only allow http/https
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.warn(`Invalid URL: ${item.url}`);
        return false;
    }
}

/**
 * Format history item for backend
 */
function formatHistoryItem(item) {
    return {
        url: item.url.trim(),
        title: (item.title || 'Untitled').trim(),
        lastVisitTime: item.lastVisitTime || Date.now()
    };
}

/**
 * Send history data to backend with retry logic
 */
async function sendToBackend(historyItems, retryCount = 0) {
    try {
        console.log(`Sending ${historyItems.length} URLs to backend (attempt ${retryCount + 1})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
        
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(historyItems),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Backend response:', result);
        
        return {
            status: 'success',
            data: result,
            message: result.message || 'History sent successfully'
        };
        
    } catch (error) {
        console.error(`Backend request failed (attempt ${retryCount + 1}):`, error);
        
        // Retry logic for specific errors
        if (retryCount < CONFIG.MAX_RETRIES && shouldRetry(error)) {
            console.log(`Retrying in ${CONFIG.RETRY_DELAY}ms...`);
            await sleep(CONFIG.RETRY_DELAY * (retryCount + 1)); // Exponential backoff
            return sendToBackend(historyItems, retryCount + 1);
        }
        
        // Final failure
        throw new Error(getErrorMessage(error));
    }
}

/**
 * Determine if error should trigger a retry
 */
function shouldRetry(error) {
    const retryableErrors = [
        'Failed to fetch',
        'NetworkError',
        'AbortError',
        'HTTP 500',
        'HTTP 502',
        'HTTP 503',
        'HTTP 504'
    ];
    
    return retryableErrors.some(retryable => 
        error.message.includes(retryable)
    );
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
    if (error.name === 'AbortError') {
        return 'Request timed out. Backend may be slow or unavailable.';
    }
    
    if (error.message.includes('Failed to fetch')) {
        return 'Cannot connect to backend. Please ensure the server is running on port 8090.';
    }
    
    if (error.message.includes('HTTP 400')) {
        return 'Invalid data sent to backend.';
    }
    
    if (error.message.includes('HTTP 500')) {
        return 'Backend server error. Please check server logs.';
    }
    
    return error.message || 'Unknown error occurred';
}

/**
 * Utility function for delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main export function
 */
async function exportHistory() {
    try {
        console.log('Starting history export...');
        
        // Fetch history
        const historyItems = await fetchHistory();
        
        if (historyItems.length === 0) {
            return {
                status: 'success',
                message: 'No valid URLs found in last 24 hours',
                data: { processed: 0, total: 0 }
            };
        }
        
        // Send to backend
        const result = await sendToBackend(historyItems);
        
        console.log('Export completed successfully:', result);
        return result;
        
    } catch (error) {
        console.error('Export failed:', error);
        return {
            status: 'error',
            error: error.message,
            message: `Export failed: ${error.message}`
        };
    }
}

/**
 * Message listener for popup communication
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    if (message.action === 'exportHistory') {
        // Handle async operation
        exportHistory()
            .then(result => {
                console.log('Sending response:', result);
                sendResponse(result);
            })
            .catch(error => {
                console.error('Export error:', error);
                sendResponse({
                    status: 'error',
                    error: error.message,
                    message: `Export failed: ${error.message}`
                });
            });
        
        // Keep message channel open for async response
        return true;
    }
    
    // Handle unknown messages
    sendResponse({
        status: 'error',
        error: 'Unknown action',
        message: `Unknown action: ${message.action}`
    });
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
    console.log('MindCanvas extension started');
});

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('MindCanvas extension installed:', details);
});

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchHistory,
        sendToBackend,
        isValidHistoryItem,
        formatHistoryItem
    };
}

export {};