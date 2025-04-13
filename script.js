/**
 * Client-Side Logic for Pod Racer
 *
 * Handles race start/close requests and UI updates, polling for race status.
 */
const SERVER_URL = "https://u962699roq0mvb-9000.proxy.runpod.net";
let racers = {};

function appendDebug(message) {
    /**
     * Append a debug message to the UI or console.
     */
    const debugDiv = document.getElementById("debug");
    if (debugDiv) debugDiv.innerHTML += message + "<br>";
    else console.log("Debug: " + message);
}

async function poll_race_status(userId) {
    /**
     * Poll the server for race status until assigned or failed.
     */
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            const response = await fetch(`${SERVER_URL}/status?user_id=${userId}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            if (data.status === "assigned") {
                // Ensure pods_raced is an array to avoid 'Cannot read properties' error
                const pods_raced = Array.isArray(data.pods_raced) ? data.pods_raced : [];
                appendDebug(`Race started for: ${userId}, Winner: ${data.winner}, Pods: ${pods_raced.join(", ") || "unknown"}`);
                racers[userId] = { 
                    race_start: Date.now(), 
                    winner: data.winner, 
                    pods_raced: pods_raced, 
                    pending: false 
                };
                return true;
            } else if (data.status === "no_pods_available") {
                appendDebug(`No pods available for: ${userId}`);
                delete racers[userId];
                return false;
            }
            // Still pending, continue polling
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            appendDebug(`Status poll error (attempt ${attempt}): ${error.message}`);
            if (attempt === 30) {
                appendDebug(`Failed to get race status for: ${userId}`);
                delete racers[userId];
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    return false;
}

async function sendStartRequest() {
    /**
     * Send a race start request and poll for status.
     */
    const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    appendDebug("Starting race for: " + userId);
    racers[userId] = { race_start: null, pending: true };
    updateStatus();
    updateButtonState();
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(SERVER_URL + "/start_race", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: "generate@123" })
            });
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            appendDebug("Start response received");
            if (data.status === "queued") {
                await poll_race_status(userId);
            } else {
                appendDebug(`Unexpected status for ${userId}: ${data.status}`);
                delete racers[userId];
            }
            break;
        } catch (error) {
            appendDebug(`Start error (attempt ${attempt}): ${error.message}`);
            if (attempt === 3) {
                document.getElementById("status").innerHTML = `Error starting race: ${error.message}`;
                delete racers[userId];
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    updateStatus();
    updateButtonState();
}

async function sendCloseRequest() {
    /**
     * Send a race close request.
     */
    const userIds = Object.keys(racers);
    appendDebug("Racers before close: " + userIds.join(", "));
    if (userIds.length > 0) {
        const userId = userIds[0];
        appendDebug("Closing race for: " + userId);
        document.getElementById("removeOnButton").disabled = true;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(SERVER_URL + "/close", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: userId, key: "generate@123" })
                });
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                appendDebug("Race closed for: " + userId);
                delete racers[userId];
                break;
            } catch (error) {
                appendDebug(`Close error (attempt ${attempt}): ${error.message}`);
                if (attempt === 3) {
                    document.getElementById("status").innerHTML = "Error closing race: " + error.message;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        updateStatus();
        updateButtonState();
    } else {
        appendDebug("No race to close");
        document.getElementById("status").innerHTML = "No active races";
        updateButtonState();
    }
}

function updateStatus() {
    /**
     * Update the status div with active races.
     */
    const userIds = Object.keys(racers);
    document.getElementById("status").innerHTML = userIds.length > 0 ? userIds.join("<br>") : "No active races";
}

function updateButtonState() {
    /**
     * Enable/disable the Close button based on active races.
     */
    document.getElementById("removeOnButton").disabled = Object.keys(racers).length === 0;
}

document.addEventListener("DOMContentLoaded", function() {
    /**
     * Initialize event listeners for buttons.
     */
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
    updateButtonState();
});
