// Force refresh script - paste in browser console
console.clear();

// 1. Clear all storages
localStorage.clear();
sessionStorage.clear();

// 2. Clear service workers
if ('caches' in window) {
    caches.keys().then(function(names) {
        names.forEach(function(name) {
            caches.delete(name);
        });
        console.log('✅ All caches cleared');
    });
}

// 3. Force reload with timestamp
const timestamp = new Date().getTime();
console.log('🔄 Force reloading with timestamp:', timestamp);

// Add timestamp to current URL to force refresh
const currentUrl = new URL(window.location.href);
currentUrl.searchParams.set('v', timestamp);
window.location.href = currentUrl.toString();

// Alternative: Hard refresh
// window.location.reload(true);
