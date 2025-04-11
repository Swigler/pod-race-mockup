const SERVER_URL = "https://iif2rplmvljk4w-9000.proxy.runpod.net";

const baseUserId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
const userIds = [baseUserId + "_1", baseUserId + "_2", baseUserId + "_3"];
let clickCount = 0;
let raceState = { activeUsers: [], pool: [], user_to_winner: {} };

function appendDebug(message) {
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
        debugDiv.scrollTop = debugDiv.scrollHeight;
    } else {
        console.log("Debug (no div): " + message);
    }
}

function sendStartRequest() {
    clickCount = Math.min(clickCount + 1, 3);
    appendDebug(`Starting race for ${clickCount} user(s)`);
    
    userIds.slice(0, clickCount).forEach(userId => {
        if (!raceState.activeUsers.includes(userId)) {
            appendDebug("Starting race for: " + userId);
            fetch(SERVER_URL + "/start_race", {
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
                raceState.activeUsers = data.active_users || [];
                raceState.pool = data.pool || [];
                raceState.user_to_winner = data.user_to_winner || {};
                updateStatus();
            })
            .catch(error => {
                appendDebug("Start error for " + userId + ": " + error.message);
            });
        }
    });
}

function sendCloseRequest() {
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
                raceState.pool = data.pool || [];
                if (userId in raceState.user_to_winner) delete raceState.user_to_winner[userId];
                updateStatus();
            })
            .catch(error => {
                appendDebug("Close error for " + userId + ": " + error.message);
            });
        }
    });
    clickCount = 0;
}

function setCredits(userIndex) {
    const creditsInput = document.getElementById(`credits${userIndex + 1}`);
    const userId = userIds[userIndex];
    const credits = parseInt(creditsInput.value, 10);
    if (isNaN(credits) || credits < 0) {
        appendDebug(`Invalid credits for ${userId}: ${creditsInput.value}`);
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
        appendDebug(`Set credits error for ${userId}: ${error.message}`);
    });
}

function updateStatus() {
    const userStatuses = [document.getElementById("user1-status"), 
                          document.getElementById("user2-status"), 
                          document.getElementById("user3-status")];
    const raceStatus = document.getElementById("race-status");
    const idlePods = document.getElementById("idle-pods");

    userStatuses.forEach((statusDiv, index) => {
        const userId = userIds[index];
        statusDiv.innerHTML = raceState.activeUsers.includes(userId) ? 
            `${userId}: ${raceState.user_to_winner[userId] || "Racing"}` : "Idle";
    });

    const racingPods = Array.isArray(raceState.pool) ? raceState.pool.filter(pt => !Object.values(raceState.user_to_winner).includes(pt)) : [];
    raceStatus.innerHTML = raceState.activeUsers.length > 0 ? 
        `Active Pods: ${racingPods.join(", ") || "None"}` : "No race active";

    const idleCount = Array.isArray(raceState.pool) ? raceState.pool.length - Object.keys(raceState.user_to_winner).length : 0;
    const idlePodsList = Array.isArray(raceState.pool) ? raceState.pool.filter(pt => !Object.values(raceState.user_to_winner).includes(pt)) : [];
    idlePods.innerHTML = `Idle: ${idleCount} - ${idlePodsList.join(", ") || "None"}`;
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
    document.getElementById("setCredits1").addEventListener("click", () => setCredits(0));
    document.getElementById("setCredits2").addEventListener("click", () => setCredits(1));
    document.getElementById("setCredits3").addEventListener("click", () => setCredits(2));
});
