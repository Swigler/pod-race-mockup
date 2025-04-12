// Server URL—points to RunPod proxy (update to your instance)
const SERVER_URL = "https://iif2rplmvljk4w-9000.proxy.runpod.net";

// Local state—tracks 3 unique user IDs and race data
const baseUserId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000); // e.g., 'user_1744250886899_663'
const userIds = [baseUserId + "_1", baseUserId + "_2", baseUserId + "_3"]; // e.g., '_1', '_2', '_3'
let clickCount = 0; // Tracks "Start Race" clicks (1→3)
let raceState = { activeUsers: [], pool: [], user_to_winner: {} }; // Syncs with server

function appendDebug(message, isError = false) {
    // Logs to #debug—tracks actions, highlights errors
    // Fix: Added error styling, auto-scrolls for visibility
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += `<span${isError ? ' class="debug-error"' : ''}>${message}</span><br>`;
        debugDiv.scrollTop = debugDiv.scrollHeight;
    } else {
        console.log("Debug (no div): " + message);
    }
}

function sendStartRequest(batchAll = false) {
    // Triggers "Start Race"—sends /start_race for 1-3 users
    // Fix: Batches requests, supports "Start All" for tight joins
    clickCount = batchAll ? 3 : Math.min(clickCount + 1, 3);
    appendDebug(`Starting race for ${clickCount} user(s)`);
    
    const promises = userIds.slice(0, clickCount).map(userId => {
        if (!raceState.activeUsers.includes(userId)) {
            appendDebug("Starting race for: " + userId);
            return fetch(SERVER_URL + "/start_race", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: "generate@123" })
            })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                return response.json();
            })
            .then(data => {
                appendDebug("Start response for: " + userId);
                raceState.activeUsers = data.active_users;
                raceState.pool = data.pool;
                raceState.user_to_winner = data.user_to_winner;
                document.getElementById("failure-status").innerHTML = "No failures";
                return data;
            })
            .catch(error => {
                appendDebug("Start error for " + userId + ": " + error.message, true);
                document.getElementById("failure-status").innerHTML = `Failure: ${error.message}`;
                throw error;
            });
        }
        return Promise.resolve(null);
    });
    
    Promise.all(promises).then(() => updateStatus());
}

function sendCloseRequest() {
    // Triggers "Close"—sends /close for active users
    // Fix: Logs all closes, resets UI cleanly
    appendDebug("Racers before close: " + raceState.activeUsers.join(", "));
    raceState.activeUsers.forEach(userId => {
        if (userIds.includes(userId)) {
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
                raceState.activeUsers = raceState.activeUsers.filter(id => id !== userId);
                raceState.pool = data.pool;
                if (userId in raceState.user_to_winner) delete raceState.user_to_winner[userId];
                updateStatus();
            })
            .catch(error => {
                appendDebug("Close error for " + userId + ": " + error.message, true);
            });
        }
    });
    clickCount = 0;
}

function setCredits(userIndex) {
    // Sets credits—unblocks users if credits > 0
    // Fix: Validates input, logs changes
    const creditsInput = document.getElementById(`credits${userIndex + 1}`);
    const userId = userIds[userIndex];
    const credits = parseInt(creditsInput.value, 10);
    if (isNaN(credits) || credits < 0) {
        appendDebug(`Invalid credits for ${userId}: ${creditsInput.value}`, true);
        return;
    }
    
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
        appendDebug(`Set credits error for ${userId}: ${error.message}`, true);
    });
}

function pollCredits() {
    // Polls real-time credits—updates UI
    // Fix: New function for live credit display
    userIds.forEach((userId, index) => {
        fetch(SERVER_URL + "/get_credits/" + userId)
            .then(response => response.json())
            .then(data => {
                document.getElementById(`user${index + 1}-credits`).innerHTML = `Credits: ${data.credits}s`;
            })
            .catch(error => {
                appendDebug(`Poll credits error for ${userId}: ${error.message}`, true);
            });
    });
    setTimeout(pollCredits, 1000);
}

function updateStatus() {
    // Updates UI—shows user states, race, and pods
    // Fix: Accurate idle pod count, clear racing status
    const userStatuses = [
        document.getElementById("user1-status"), 
        document.getElementById("user2-status"), 
        document.getElementById("user3-status")
    ];
    const raceStatus = document.getElementById("race-status");
    const idlePods = document.getElementById("idle-pods");

    userStatuses.forEach((statusDiv, index) => {
        const userId = userIds[index];
        statusDiv.innerHTML = raceState.activeUsers.includes(userId) ? 
            `${userId}: ${raceState.user_to_winner[userId] || "Racing"}` : "Idle";
    });

    const racingPods = raceState.pool.filter(pt => !Object.values(raceState.user_to_winner).includes(pt));
    raceStatus.innerHTML = raceState.activeUsers.length > 0 ? 
        `Active Pods: ${racingPods.join(", ") || "None"}` : "No race active";

    const idleCount = raceState.pool.length - Object.keys(raceState.user_to_winner).length;
    idlePods.innerHTML = `Idle: ${idleCount} - ${raceState.pool.filter(pt => 
        !Object.values(raceState.user_to_winner).includes(pt)).join(", ") || "None"}`;
}

// Hook up buttons—start, close, credits
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", () => sendStartRequest(false));
    document.getElementById("startAllButton").addEventListener("click", () => sendStartRequest(true));
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
    document.getElementById("setCredits1").addEventListener("click", () => setCredits(0));
    document.getElementById("setCredits2").addEventListener("click", () => setCredits(1));
    document.getElementById("setCredits3").addEventListener("click", () => setCredits(2));
    pollCredits(); // Start credit polling
});
