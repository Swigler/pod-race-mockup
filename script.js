// Server URL—new Runpod proxy for your updated pod (19:21:06 requests expected)
const SERVER_URL = "https://iif2rplmvljk4w-9000.proxy.runpod.net";

// Local state—tracks user ID, race data from server (19:21:06–19:21:28)
let localUserId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000); // Unique client ID—e.g., 'user_1744140065039_565'
let raceState = { activeUsers: [], pool: [], userToWinner: {} }; // Holds server response—e.g., { activeUsers: ['user1'], pool: ['A', 'B', 'C', 'D', 'E'], userToWinner: {'user1': 'A'} }

function appendDebug(message) {
    // Logs to #debug—tracks all actions (e.g., 19:21:06 "Starting race")
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
    } else {
        console.log("Debug (no div): " + message); // Fallback if HTML’s off—keeps us sane
    }
}

function sendStartRequest() {
    // Triggers "Start Race"—joins or starts race via /start_race (19:21:06)
    // Called on #startButton click
    appendDebug("Starting race for: " + localUserId);
    fetch(SERVER_URL + "/start_race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: localUserId, key: "generate@123" }) // Matches SECRET_KEY from website_connector
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`); // Catches fails—e.g., 404 or 500
        return response.json();
    })
    .then(data => {
        // Server response—e.g., 19:21:28, { user_id, race_start, replacement_type, active_users, user_to_winner }
        appendDebug("Start response received for: " + localUserId);
        raceState.activeUsers = data.active_users || []; // Sync active users from server—e.g., ['user_1744140065039_565']
        raceState.pool = data.pool || []; // Update pool—e.g., ['A', 'B', 'C', 'D', 'E']
        raceState.userToWinner = data.user_to_winner || {}; // Map winners—e.g., {'user_1744140065039_565': 'A'}
        if (data.user_id === localUserId && data.replacement_type) {
            appendDebug("Race started for: " + localUserId + " with replacement: " + data.replacement_type);
        }
        updateStatus(); // Refresh UI—shows race state (e.g., "User1: A (Winner)")
    })
    .catch(error => {
        appendDebug("Start error: " + error.message); // Logs errors—e.g., "HTTP error: 404"
        document.getElementById("status").innerHTML = "Error starting race: " + error.message;
    });
}

function sendCloseRequest() {
    // Triggers "Close"—leaves race via /close (19:21:19 cleanup expected)
    // Called on #removeOnButton click
    appendDebug("Racers before close: " + raceState.activeUsers.join(", "));
    if (raceState.activeUsers.includes(localUserId)) {
        appendDebug("Closing race for: " + localUserId);
        fetch(SERVER_URL + "/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: localUserId, key: "generate@123" })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`); // Catches fails
            return response.json();
        })
        .then(data => {
            // Server response—e.g., 19:21:28 cleanup, { user_id, status: "closed", pool }
            appendDebug("Race closed for: " + localUserId);
            raceState.activeUsers = raceState.activeUsers.filter(id => id !== localUserId); // Remove local user
            raceState.pool = data.pool || []; // Update pool—e.g., 5 idle
            if (raceState.userToWinner[localUserId]) {
                delete raceState.userToWinner[localUserId]; // Clear winner if closed
            }
            updateStatus(); // Refresh UI—e.g., "User1 left, 5 pods idle"
        })
        .catch(error => {
            appendDebug("Close error: " + error.message);
            document.getElementById("status").innerHTML = "Error closing race: " + error.message;
        });
    } else {
        appendDebug("No race to close for: " + localUserId); // User not in race—post-bail
    }
}

function updateStatus() {
    // Updates UI—shows users, pods, race state, idle count (19:21:19–19:21:28)
    const user1Status = document.getElementById("user1-status");
    const user2Status = document.getElementById("user2-status");
    const user3Status = document.getElementById("user3-status");
    const raceStatus = document.getElementById("race-status");
    const idlePods = document.getElementById("idle-pods");

    // Update user statuses—e.g., "User1: A (Winner)" (19:21:19)
    user1Status.innerHTML = raceState.activeUsers[0] ? 
        `${raceState.activeUsers[0]}: ${raceState.userToWinner[raceState.activeUsers[0]] || "Racing"}` : "Idle";
    user2Status.innerHTML = raceState.activeUsers[1] ? 
        `${raceState.activeUsers[1]}: ${raceState.userToWinner[raceState.activeUsers[1]] || "Racing"}` : "Idle";
    user3Status.innerHTML = raceState.activeUsers[2] ? 
        `${raceState.activeUsers[2]}: ${raceState.userToWinner[raceState.activeUsers[2]] || "Racing"}` : "Idle";

    // Show racing pods—e.g., "Active Pods: B, C" (19:21:06)
    const racingPods = raceState.pool.filter(pt => !Object.values(raceState.userToWinner).includes(pt));
    raceStatus.innerHTML = raceState.activeUsers.length > 0 ? 
        `Active Pods: ${racingPods.join(", ") || "None"}` : "No race active";

    // Show idle pods—e.g., "Idle: 4 - B, C, D, E" (19:21:28)
    const idleCount = raceState.pool.length - Object.keys(raceState.userToWinner).length;
    idlePods.innerHTML = `Idle: ${idleCount} - ${raceState.pool.filter(pt => 
        !Object.values(raceState.userToWinner).includes(pt)).join(", ")}`;
}

// Hook up buttons—drives shared race (19:21:06 triggers)
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
});
