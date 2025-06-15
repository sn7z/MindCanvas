"use strict";

// UI Elements
let exportButton, dashboardButton, statusText, progressContainer, progressBar, alertContainer, statsText;

// State management
let isExporting = false;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    exportButton = document.getElementById('exportHistory');
    dashboardButton = document.getElementById('openDashboard');
    statusText = document.getElementById('statusText');
    progressContainer = document.getElementById('progressContainer');
    progressBar = document.getElementById('progressBar');
    alertContainer = document.getElementById('alertContainer');
    statsText = document.getElementById('statsText');

    // Bind event listeners
    exportButton.addEventListener('click', handleExportClick);
    dashboardButton.addEventListener('click', handleDashboardClick);

    // Check backend connectivity on load
    checkBackendStatus();
});

/**
 * Handle export button click
 */
async function handleExportClick() {
    if (isExporting) return;

    try {
        isExporting = true;
        setExportingState();
        
        // Show progress
        showProgress();
        updateProgress(10, 'Preparing to export history...');

        // Get history count first
        const historyCount = await getHistoryCount();
        updateStats(`Found ${historyCount} URLs in last 24 hours`);
        updateProgress(25, 'Fetching browsing history...');

        // Send export message to background script
        const response = await sendMessageToBackground({ action: 'exportHistory' });
        
        if (response.status === 'success') {
            updateProgress(100, 'Export completed successfully!');
            showAlert('History exported successfully! Check the dashboard to view processed content.', 'success');
            updateStats(`${historyCount} URLs sent for processing`);
            
            // Reset after success
            setTimeout(() => {
                resetToReadyState();
            }, 3000);
        } else {
            throw new Error(response.error || 'Export failed');
        }

    } catch (error) {
        console.error('Export failed:', error);
        showAlert(`Export failed: ${error.message}`, 'error');
        updateProgress(0, 'Export failed');
        resetToReadyState();
    }
}

/**
 * Handle dashboard button click
 */
function handleDashboardClick() {
    chrome.tabs.create({ url: 'http://localhost:3000' });
}

/**
 * Get history count for stats
 */
async function getHistoryCount() {
    return new Promise((resolve) => {
        const oneDayAgo = new Date().getTime() - 24 * 60 * 60 * 1000;
        chrome.history.search({
            text: '',
            startTime: oneDayAgo,
            maxResults: 1000,
        }, (results) => {
            resolve(results.length);
        });
    });
}

/**
 * Send message to background script with timeout
 */
function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Background script timeout'));
        }, 30000); // 30 second timeout

        chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            resolve(response || { status: 'error', error: 'No response' });
        });
    });
}

/**
 * Check if backend is running
 */
async function checkBackendStatus() {
    try {
        const response = await fetch('http://localhost:8090/', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            showAlert(`Backend connected: ${data.message || 'MindCanvas Ready'}`, 'success');
            updateStats('Backend ready for processing');
        } else {
            throw new Error('Backend not responding');
        }
    } catch (error) {
        showAlert('Backend not running. Please start the server first.', 'error');
        updateStats('Backend offline');
        exportButton.disabled = true;
    }
}

/**
 * Set UI to exporting state
 */
function setExportingState() {
    exportButton.disabled = true;
    exportButton.classList.add('btn-loading');
    exportButton.textContent = 'Exporting...';
    dashboardButton.disabled = true;
}

/**
 * Reset UI to ready state
 */
function resetToReadyState() {
    isExporting = false;
    exportButton.disabled = false;
    exportButton.classList.remove('btn-loading');
    exportButton.textContent = 'Export History (24h)';
    dashboardButton.disabled = false;
    hideProgress();
    statusText.textContent = 'Ready to export your browsing history';
}

/**
 * Show progress bar
 */
function showProgress() {
    progressContainer.style.display = 'block';
}

/**
 * Hide progress bar
 */
function hideProgress() {
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
}

/**
 * Update progress bar and status
 */
function updateProgress(percentage, message) {
    progressBar.style.width = `${percentage}%`;
    statusText.textContent = message;
}

/**
 * Update stats text
 */
function updateStats(message) {
    statsText.textContent = message;
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    // Clear existing alerts
    alertContainer.innerHTML = '';
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertContainer.appendChild(alert);
    
    // Auto-remove success alerts after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }
}

// Export functions for potential future use
window.MindCanvasPopup = {
    checkBackendStatus,
    showAlert,
    updateProgress,
    updateStats
};