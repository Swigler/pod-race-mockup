// Server URL—update to your RunPod proxy (e.g., https://your-pod-id-9000.proxy.runpod.net)
const SERVER_URL = "https://iif2rplmvljk4w-9000.proxy.runpod.net"; // Replace with your actual proxy URL

// Local state—manages 3 unique users and race data
const baseUserId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
const userIds = [baseUserId + "_1", baseUserId + "_2", baseUserId + "_3"];
let clickCount = 0; // Tracks "Start Race" clicks
let raceState = { activeUsers: [], pool: [], user_to_winner: {} }; // Mirrors server state

function appendDebug(message, isError = false) {
    // Logs messages to #debug with auto-scroll
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += `<span${isError ? ' class="debug-error"' : ''}>[${new Date().toLocaleTimeString()}] ${message}</span><br>`;
        debugDiv.scrollTop = debugDiv.scrollHeight;
    } else {
        console.log(`Debug: ${message}`);
    }
}

async function sendStartRequest(batchAll = false) {
    // Initiates races for 1-3 users
    clickCount = batchAll ? 3 : Math.min(clickCount + 1, 3);
    appendDebug(`Initiating race for ${clickCount} user(s)`);
    
    const promises = userIds.slice(0, clickCount).map(async userId => {
        if (!raceState.activeUsers.includes(userId)) {
            appendDebug(`Sending /start_race for ${userId}`);
            try {
                const response = await fetch(`${SERVER_URL}/start_race`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: userId, key: "generate@123" })
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const data = await response.json();
                appendDebug(`Race started for ${userId}`);
                raceState.activeUsers = data.active_users;
                raceState.pool = data.pool;
                raceState.user_to_winner = data.user_to_winner;
                document.getElementById("failure-status").innerHTML = "No failures";
                return data;
            } catch (error) {
                appendDebug(`Start error for ${userId}: ${error.message}`, true);
                document.getElementById("failure-status").innerHTML = `Failure: ${error.message}`;
                return null;
            }
        }
        return null;
    });
    
    await Promise.all(promises);
    updateStatus();
}

async function sendCloseRequest() {
    // Closes races for all active users
    appendDebug(`Closing races for: ${raceState.activeUsers.join(", ")}`);
    const promises = raceState.activeUsers.map(async userId => {
        if (userIds.includes(userId)) {
            appendDebug(`Sending /close for ${userId}`);
            try {
                const response = await fetch(`${SERVER_URL}/close`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: userId, key: "generate@123" })
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const data = await response.json();
                appendDebug(`Race closed for ${userId}`);
                raceState.activeUsers = raceState.activeUsers.filter(id => id !== userId);
                raceState.pool = data.pool;
                if (userId in raceState.user_to_winner) {
                    delete raceState.user_to_winner[userId];
                }
                return data;
            } catch (error) {
                appendDebug(`Close error for ${userId}: ${error.message}`, true);
                return null;
            }
        }
        return null;
    });
    
    await Promise.all(promises);
    clickCount = 0;
    updateStatus();
}

async function setCredits(userIndex) {
    // Updates user credits via /set_credits
    const creditsInput = document.getElementById(`credits${userIndex + 1}`);
    const userId = userIds[userIndex];
    const credits = parseInt(creditsInput.value, 10);
    if (isNaN(credits) || credits < 0) {
        appendDebug(`Invalid credits for ${userId}: ${creditsInput.value}`, true);
        return;
    }
    
    appendDebug(`Setting credits for ${userId} to ${credits}s`);
    try {
        const response = await fetch(`${SERVER_URL}/set_credits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, credits: credits, key: "generate@123" })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const data = await response.json();
        appendDebug(`Credits set for ${userId}: ${data.credits}s`);
    } catch (error) {
        appendDebug(`Set credits error for ${userId}: ${error.message}`, true);
    }
}

async function pollCredits() {
    // Polls /get_credits for real-time credit updates
    for (let i = 0; i < userIds.length; i++) {
        try {
            const response = await fetch(`${SERVER_URL}/get_credits/${userIds[i]}`);
            const data = await response.json();
            document.getElementById(`user${i + 1}-credits`).innerHTML = `Credits: ${data.credits}s`;
        } catch (error) {
            appendDebug(`Poll credits error for ${userIds[i]}: ${error.message}`, true);
        }
    }
    setTimeout(pollCredits, 1000);
}

function updateStatus() {
    // Refreshes UI with race and pod states
    const userStatuses = [
        document.getElementById("user1-status"),
        document.getElementById("user2-status"),
        document.getElementById("user3-status")
    ];
    const raceStatus = document.getElementById("race-status");
    const idlePods = document.getElementById("idle-pods");

    userStatuses.forEach((statusDiv, index) => {
        const userId = userIds[index];
        statusDiv.innerHTML = raceState.activeUsers.includes(userId)
            ? `${userId}: ${raceState.user_to_winner[userId] || "Racing"}`
            : "Idle";
    });

    const racingPods = raceState.pool.filter(pt => !Object.values(raceState.user_to_winner).includes(pt));
    raceStatus.innerHTML = raceState.activeUsers.length > 0
        ? `Active Pods: ${racingPods.join(", ") || "None"}`
        : "No race active";

    const idleCount = raceState.pool.length - Object.keys(raceState.user_to_winner).length;
    idlePods.innerHTML = `Idle: ${idleCount} - ${raceState.pool.filter(pt =>
        !Object.values(raceState.user_to_winner).includes(pt)).join(", ") || "None"}`;
}

// Attach event listeners
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("startButton").addEventListener("click", () => sendStartRequest(false));
    document.getElementById("startAllButton").addEventListener("click", () => sendStartRequest(true));
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
    document.getElementById("setCredits1").addEventListener("click", () => setCredits(0));
    document.getElementById("setCredits2").addEventListener("click", () => setCredits(1));
    document.getElementById("setCredits3").addEventListener("click", () => setCredits(2));
    pollCredits();
});
