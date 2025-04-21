/**
 * Client-Side Logic for Pod Racer
 *
 * Handles pod assignment requests, status polling, and UI updates for multiple users.
 */
const SERVER_URL = "https://u962699roq0mvb-9000.proxy.runpod.net";
let users = {};

function appendDebug(message) {
    /**
     * Append a debug message to the UI or console.
     */
    const debugDiv = document.getElementById("debug");
    if (debugDiv) {
        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        const formattedMessage = `<div><span class="timestamp">[${timestamp}]</span> ${message}</div>`;
        debugDiv.innerHTML = formattedMessage + debugDiv.innerHTML;
        if (debugDiv.innerHTML.split('</div>').length > 100) {
            const lines = debugDiv.innerHTML.split('</div>');
            debugDiv.innerHTML = lines.slice(0, 100).join('</div>') + (lines.length > 100 ? '</div>' : '');
        }
    } else {
        console.log("Debug: " + message);
    }
}

async function pollPodStatus(userId) {
    /**
     * Poll the server for pod status until assigned or failed.
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
                appendDebug(`Pod assigned for: ${userId}, Pod Type: ${data.pod_type}`);
                users[userId] = {
                    pod_start: Date.now(),
                    pod_type: data.pod_type,
                    pending: false,
                    credits: data.credits_remaining || 3600
                };
                appendDebug(`Remaining credits: ${data.credits_remaining || 3600}s`);
                updateUserCards();
                return true;
            } else if (data.status === "no_pod_assigned") {
                appendDebug(`No pod available for: ${userId}`);
                delete users[userId];
                return false;
            }
            if (data.credits_remaining !== undefined && users[userId]) {
                users[userId].credits = data.credits_remaining;
                updateUserCards();
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            appendDebug(`Status poll error (attempt ${attempt}): ${error.message}`);
            if (attempt === 30) {
                appendDebug(`Failed to get pod status for: ${userId}`);
                delete users[userId];
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    return false;
}

async function createUser() {
    /**
     * Create a new user without starting a pod.
     */
    const userIdInput = document.getElementById("createUserId").value.trim();
    try {
        const response = await fetch(SERVER_URL + "/create_user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key: "generate@123",
                user_id: userIdInput || undefined
            })
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        appendDebug(`User created: ${data.user_id} with ${data.credits}s credits`);
        document.getElementById("creditUserId").value = data.user_id;
        document.getElementById("podUserId").value = data.user_id;
        return data.user_id;
    } catch (error) {
        appendDebug(`Error creating user: ${error.message}`);
        return null;
    }
}

async function startPod() {
    /**
     * Send a pod assignment request and poll for status.
     */
    const userIdInput = document.getElementById("podUserId").value.trim();
    if (!userIdInput) {
        appendDebug("Please enter a User ID or create a user first");
        return;
    }
    const userId = userIdInput;
    appendDebug(`Starting pod assignment for: ${userId}`);
    users[userId] = { pod_start: null, pending: true, credits: 3600 };
    updateStatus();
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(SERVER_URL + "/start_pod", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: "generate@123" })
            });
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            appendDebug("Pod assignment request received");
            if (data.status === "assigned") {
                if (data.credits && users[userId]) {
                    users[userId].credits = data.credits;
                    appendDebug(`Credits assigned: ${data.credits}s`);
                }
                await pollPodStatus(userId);
            } else {
                appendDebug(`Unexpected status for ${userId}: ${data.status}`);
                delete users[userId];
            }
            break;
        } catch (error) {
            appendDebug(`Start error (attempt ${attempt}): ${error.message}`);
            if (attempt === 3) {
                document.getElementById("status").innerHTML = `Error starting pod: ${error.message}`;
                delete users[userId];
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    updateStatus();
    updateUserCards();
}

async function closePod(userId) {
    /**
     * Send a pod close request for a specific user.
     */
    if (!users[userId]) {
        appendDebug(`No pod to close for: ${userId}`);
        return;
    }
    appendDebug(`Closing pod for: ${userId}`);
    let success = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = await fetch(SERVER_URL + "/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: "generate@123" })
            });
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            appendDebug(`Pod closed for: ${userId}`);
            delete users[userId];
            success = true;
            break;
        } catch (error) {
            appendDebug(`Close error (attempt ${attempt}): ${error.message}`);
            const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
    }
    if (!success) {
        appendDebug(`All close attempts failed for ${userId}. Assuming pod closed.`);
        delete users[userId];
    }
    updateStatus();
    updateUserCards();
}

function updateStatus() {
    /**
     * Update the status div with active users.
     */
    const userIds = Object.keys(users);
    document.getElementById("status").innerHTML = userIds.length > 0 ?
        `${userIds.length} active user(s)` :
        "No active users";
}

function updateUserCards() {
    /**
     * Update the user cards with detailed information.
     */
    const userCardsDiv = document.getElementById("userCards");
    const userIds = Object.keys(users);
    if (userIds.length === 0) {
        userCardsDiv.innerHTML = "<p>No active users</p>";
        return;
    }
    let cardsHtml = "";
    userIds.forEach(userId => {
        const user = users[userId];
        const elapsedTime = user.pod_start ? Math.floor((Date.now() - user.pod_start) / 1000) : 0;
        const remainingCredits = user.credits ? user.credits - elapsedTime : "Unknown";
        const statusClass = user.pending ? "status-pending" : "status-assigned";
        let timeDisplay = "";
        if (typeof remainingCredits === "number") {
            const hours = Math.floor(remainingCredits / 3600);
            const minutes = Math.floor((remainingCredits % 3600) / 60);
            const seconds = remainingCredits % 60;
            timeDisplay = `${hours}h ${minutes}m ${seconds}s`;
        } else {
            timeDisplay = remainingCredits;
        }
        cardsHtml += `
            <div class="user-card">
                <h3>User: ${userId}</h3>
                <p>Status: <span class="${statusClass}">${user.pending ? "Pending" : "Assigned"}</span></p>
                <p>Pod started: ${user.pod_start ? new Date(user.pod_start).toLocaleTimeString() : "Pending"}</p>
                <p>Elapsed time: ${elapsedTime} seconds</p>
                <p>Remaining credits: ${timeDisplay}</p>
                ${!user.pending ? `
                <div class="pod-info">
                    <h4>Pod Information</h4>
                    <p><strong>Pod type:</strong> ${user.pod_type || "Not assigned yet"}</p>
                    <p><small>This pod will be automatically released when your credits expire or when you close it.</small></p>
                    <button onclick="closePod('${userId}')">Close Pod</button>
                </div>
                ` : `
                <div class="pod-info">
                    <h4>Pod Status</h4>
                    <p>Waiting for pod assignment...</p>
                    <p><small>The system is assigning a pod from the pool. This usually takes a few seconds.</small></p>
                </div>
                `}
            </div>
        `;
    });
    userCardsDiv.innerHTML = cardsHtml;
}

// Update user cards every second to show elapsed time and remaining credits
setInterval(() => {
    if (Object.keys(users).length > 0) {
        updateUserCards();
    }
}, 1000);

document.addEventListener("DOMContentLoaded", function() {
    /**
     * Initialize event listeners for buttons.
     */
    document.getElementById("createUserButton").addEventListener("click", createUser);
    document.getElementById("startButton").addEventListener("click", startPod);
    document.getElementById("assignCreditsButton").addEventListener("click", assignCredits);
    updateUserCards();
    document.getElementById("createUserId").addEventListener("keypress", function(e) {
        if (e.key === "Enter") createUser();
    });
    document.getElementById("podUserId").addEventListener("keypress", function(e) {
        if (e.key === "Enter") startPod();
    });
    document.getElementById("creditUserId").addEventListener("keypress", function(e) {
        if (e.key === "Enter") document.getElementById("creditAmount").focus();
    });
    document.getElementById("creditAmount").addEventListener("keypress", function(e) {
        if (e.key === "Enter") assignCredits();
    });
});

async function assignCredits() {
    /**
     * Assign credits to a specific user.
     */
    const userId = document.getElementById("creditUserId").value.trim();
    const credits = parseInt(document.getElementById("creditAmount").value);
    if (!userId) {
        appendDebug("Please enter a valid User ID");
        return;
    }
    if (isNaN(credits) || credits <= 0) {
        appendDebug("Please enter a valid credit amount");
        return;
    }
    appendDebug(`Assigning ${credits} credits to user: ${userId}`);
    try {
        const response = await fetch(`${SERVER_URL}/assign_credits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                credits: credits,
                key: "generate@123"
            })
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        appendDebug(`Credits assigned: ${data.status}`);
        if (userId in users) {
            users[userId].credits = credits;
            updateUserCards();
        }
    } catch (error) {
        appendDebug(`Error assigning credits: ${error.message}`);
    }
}
