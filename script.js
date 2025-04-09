// Server URL—matches your Runpod proxy (e.g., 16:07:00 requests)
const SERVER_URL = "https://iif2rplmvljk4w-9000.proxy.runpod.net";

// Local state—tracks this user’s ID, shared race data from server
let localUserId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 1000); // Unique per client (e.g., 'user_1743955620330_512')
let raceState = { activeUsers: [], pool: [] }; // Holds server response—e.g., { activeUsers: ['user1', 'user2'], pool: ['A', 'A2', 'C', 'D', 'E'] }

function appendDebug(message) {
    // Logs to #debug—same as before, tracks all actions (e.g., 16:07:00 "Starting race")
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
    } else {
        console.log("Debug (no div): " + message); // Fallback—keeps us sane if HTML’s off
    }
}

function sendStartRequest() {
    // Triggers "Start Race"—joins or starts the shared race via /start_race
    // Called on #startButton click (e.g., 16:07:00 for User1)
    appendDebug("Starting race for: " + localUserId);
    fetch(SERVER_URL + "/start_race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: localUserId, key: "generate@123" }) // Matches SECRET_KEY
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`); // E.g., 500 at 16:07:25—catches fails
        return response.json();
    })
    .then(data => {
        // Server response—e.g., 16:07:08, { user_id, race_start, replacement_type }
        appendDebug("Start response received for: " + localUserId);
        raceState.activeUsers = pod_handler.activeUsers; // Sync with server’s active users (e.g., ['user1', 'user2'])
        raceState.pool = data.pool; // Update local pool—e.g., ['A', 'A2', 'C', 'D', 'E']
        if (data.user_id === localUserId && data.replacement_type) {
            appendDebug("Race started for: " + localUserId + " with replacement: " + data.replacement_type);
        }
        updateStatus(); // Refresh UI—shows all users and pods (e.g., "User1: B racing")
    })
    .catch(error => {
        appendDebug("Start error: " + error.message); // Logs fails—e.g., 16:07:25, "HTTP error: 500"
        document.getElementById("status").innerHTML = "Error starting race: " + error.message;
    });
}

function sendCloseRequest() {
    // Triggers "Close"—leaves the shared race via /close
    // Called on #removeOnButton click (e.g., 16:07:12 for User1)
    appendDebug("Racers before close: " + raceState.activeUsers.join(", "));
    if (raceState.activeUsers.includes(localUserId)) {
        appendDebug("Closing race for: " + localUserId);
        fetch(SERVER_URL + "/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: localUserId, key: "generate@123" })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`); // Catches 500s—e.g., 16:07:25
            return response.json();
        })
        .then(data => {
            // Server response—e.g., 16:07:12, { user_id, status: "closed", pool }
            appendDebug("Race closed for: " + localUserId);
            raceState.activeUsers = raceState.activeUsers.filter(id => id !== localUserId); // Remove local user
            raceState.pool = data.pool; // Update pool—e.g., 16:07:14, 5 idle
            updateStatus(); // Refresh UI—e.g., "User1 left, 5 pods idle"
        })
        .catch(error => {
            appendDebug("Close error: " + error.message); // Logs fails—e.g., 16:07:25
            document.getElementById("status").innerHTML = "Error closing race: " + error.message;
        });
    } else {
        appendDebug("No race to close for: " + localUserId); // User not in race—e.g., post-bail
    }
}

function updateStatus() {
    // Updates UI—shows all active users, their pods, race state, and idle pods
    // Called after start/close responses—e.g., 16:07:00, 16:07:12
    const user1Status = document.getElementById("user1-status");
    const user2Status = document.getElementById("user2-status");
    const user3Status = document.getElementById("user3-status");
    const raceStatus = document.getElementById("race-status");
    const idlePods = document.getElementById("idle-pods");

    // Update each user’s status—e.g., "User1: B (Winner)"
    user1Status.innerHTML = raceState.activeUsers[0] ? 
        `${raceState.activeUsers[0]}: ${pod_handler.user_to_winner[raceState.activeUsers[0]] || "Racing"}` : "Idle";
    user2Status.innerHTML = raceState.activeUsers[1] ? 
        `${raceState.activeUsers[1]}: ${pod_handler.user_to_winner[raceState.activeUsers[1]] || "Racing"}` : "Idle";
    user3Status.innerHTML = raceState.activeUsers[2] ? 
        `${raceState.activeUsers[2]}: ${pod_handler.user_to_winner[raceState.activeUsers[2]] || "Racing"}` : "Idle";

    // Show racing pods—e.g., "Active Pods: A, B, C" (16:07:00)
    const racingPods = raceState.pool.filter(pt => pt in pod_handler.spawned_pods && 
        !Object.values(pod_handler.user_to_winner).includes(pt));
    raceStatus.innerHTML = raceState.activeUsers.length > 0 ? 
        `Active Pods: ${racingPods.join(", ") || "None"}` : "No race active";

    // Show idle pods—e.g., "Idle: 5 - A2, B2, C2, D, E" (16:07:14)
    const idleCount = raceState.pool.length - Object.keys(pod_handler.user_to_winner).length;
    idlePods.innerHTML = `Idle: ${idleCount} - ${raceState.pool.filter(pt => 
        !Object.values(pod_handler.user_to_winner).includes(pt)).join(", ")}`;
}

// Hook up buttons—same IDs as before, now drive shared race
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("startButton").addEventListener("click", sendStartRequest);
    document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
});
