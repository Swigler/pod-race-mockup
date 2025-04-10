// Server URL—points to your Runpod proxy (e.g., matches 16:07:00 requests)
const SERVER_URL = "https://jz8iuuveunfnjy-9000.proxy.runpod.net";

// Local state—tracks 3 distinct user IDs and race data
const baseUserId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000); // Base ID per load (e.g., 'user_1744250886899_663')
const userIds = [baseUserId + "_1", baseUserId + "_2", baseUserId + "_3"]; // 3 unique IDs (e.g., '_1', '_2', '_3')
let clickCount = 0; // Tracks "Start Race" clicks to add users (1→3)
let raceState = { activeUsers: [], pool: [], user_to_winner: {} }; // Syncs with server (e.g., { activeUsers: ['user_1', 'user_2'], pool: ['A', 'A2'] })

function appendDebug(message) {
    // Logs to #debug—tracks all actions (e.g., "Starting race for: user_1744250886899_663_1")
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
        debugDiv.scrollTop = debugDiv.scrollHeight; // Auto-scrolls to latest
    } else {
        console.log("Debug (no div): " + message); // Fallback if UI fails
    }
}

function sendStartRequest() {
    // Triggers "Start Race"—sends /start_race for 1-3 users based on clicks
    clickCount = Math.min(clickCount + 1, 3); // Increments up to 3 users
    appendDebug(`Starting race for ${clickCount} user(s)`);
    
    // Send requests for active users (e.g., 1st click: user_1, 2nd: user_1+2, 3rd: user_1+2+3)
    userIds.slice(0, clickCount).forEach(userId => {
        if (!raceState.activeUsers.includes(userId)) { // Avoid re-sending for already active users
            appendDebug("Starting race for: " + userId);
            fetch(SERVER_URL + "/start_race", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: "generate@123" }) // Matches SECRET_KEY in server.py
            })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`); // Catches server errors (e.g., 500)
                return response.json();
            })
            .then(data => {
                appendDebug("Start response for: " + userId);
                raceState.activeUsers = data.active_users; // Sync active users from server
                raceState.pool = data.pool; // Update pool (e.g., ['A', 'A2', 'C', 'D', 'E'])
                raceState.user_to_winner = data.user_to_winner; // Sync winners (e.g., { 'user_1': 'A' })
                updateStatus(); // Refresh UI with latest state
            })
            .catch(error => {
                appendDebug("Start error for " + userId + ": " + error.message); // Logs failures (e.g., "Failed to fetch")
            });
        }
    });
}

function sendCloseRequest() {
    // Triggers "Close"—sends /close for all active local users
    appendDebug("Racers before close: " + raceState.activeUsers.join(", "));
    raceState.activeUsers.forEach(userId => {
        if (userIds.includes(userId)) { // Only close users from this client
            appendDebug("Closing race for: " + userId);
            fetch(SERVER_URL + "/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: "generate@123" })
            })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                return response.json();
            })
            .then(data => {
                appendDebug("Race closed for: " + userId);
                raceState.activeUsers = raceState.activeUsers.filter(id => id !== userId); // Remove locally
                raceState.pool = data.pool; // Update pool from server
                if (userId in raceState.user_to_winner) delete raceState.user_to_winner[userId]; // Clear winner
                updateStatus(); // Refresh UI
            })
            .catch(error => {
                appendDebug("Close error for " + userId + ": " + error.message);
            });
        }
    });
    clickCount = 0; // Reset for next race cycle
}

function setCredits(userIndex) {
    // Sets credits for a user—new, allows testing stop behavior
    const creditsInput = document.getElementById(`credits${userIndex + 1}`);
    const userId = userIds[userIndex];
    const credits = parseInt(creditsInput.value, 10);
    if (isNaN(credits) || credits < 0) {
        appendDebug(`Invalid credits for ${userId}: ${creditsInput.value}`);
        return;
    }
    
    // Send custom credits to server via a new /set_credits endpoint
    appendDebug(`Setting credits for ${userId} to ${credits}s`);
    fetch(SERVER_URL + "/set_credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, credits: credits, key: "generate@123" })
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        appendDebug(`Credits set for ${userId}: ${data.credits}s`);
    })
    .catch(error => {
        appendDebug(`Set credits error for ${userId}: ${error.message}`);
    });
}

function updateStatus() {
    // Updates UI—reflects 3 users, race state, and idle pods
    const userStatuses = [document.getElementById("user1-status"), 
                          document.getElementById("user2-status"), 
                          document.getElementById("user3-status")];
    const raceStatus = document.getElementById("race-status");
    const idlePods = document.getElementById("idle-pods");

    // Update each user’s status—shows "Idle" or their winner/racing state
    userStatuses.forEach((statusDiv, index) => {
        const userId = userIds[index];
        statusDiv.innerHTML = raceState.activeUsers.includes(userId) ? 
            `${userId}: ${raceState.user_to_winner[userId] || "Racing"}` : "Idle";
    });

    // Show racing pods—excludes winners (e.g., "Active Pods: D, E" while A, B, C are winners)
    const racingPods = raceState.pool.filter(pt => !Object.values(raceState.user_to_winner).includes(pt));
    raceStatus.innerHTML = raceState.activeUsers.length > 0 ? 
        `Active Pods: ${racingPods.join(", ") || "None"}` : "No race active";

    // Show idle pods—count and list of paused pods (e.g., "Idle: 5 - D, E, A2, B2, C2")
    const idleCount = raceState.pool.length - Object.keys(raceState.user_to_winner).length;
    idlePods.innerHTML = `Idle: ${idleCount} - ${raceState.pool.filter(pt => 
        !Object.values(raceState.user_to_winner).includes(pt)).join(", ") || "None"}`;
}

// Hook up buttons—start/close and set credits for testing
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
    document.getElementById("setCredits1").addEventListener("click", () => setCredits(0));
    document.getElementById("setCredits2").addEventListener("click", () => setCredits(1));
    document.getElementById("setCredits3").addEventListener("click", () => setCredits(2));
});
