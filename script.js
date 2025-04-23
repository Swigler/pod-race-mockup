/**
 * Client-Side Logic for Pod Racer
 *
 * Handles pod assignment requests, status polling, and UI updates for multiple users.
 */
const SERVER_URL = window.location.hostname === "localhost" ? "http://localhost:9000" : "https://u962699roq0mvb-9000.proxy.runpod.net";
const API_KEY = "generate@123"; // Move to config or proxy in production
let users = {};

function appendDebug(message) {
    const debugDiv = document.getElementById("debug");
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    const formattedMessage = `<div><span class="timestamp">[${timestamp}]</span> ${message}</div>`;
    debugDiv.innerHTML = formattedMessage + debugDiv.innerHTML;
    if (debugDiv.innerHTML.split('</div>').length > 100) {
        const lines = debugDiv.innerHTML.split('</div>');
        debugDiv.innerHTML = lines.slice(0, 100).join('</div>') + (lines.length > 100 ? '</div>' : '');
    }
}

function showError(message) {
    const statusDiv = document.getElementById("status");
    statusDiv.innerHTML = `<span style="color: red;">Error: ${message}</span>`;
    setTimeout(() => updateStatus(), 5000);
}

async function pollPodStatus(userId) {
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
                updateUserCards();
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            appendDebug(`Status poll error (attempt ${attempt}): ${error.message}`);
            if (attempt === 30) {
                appendDebug(`Failed to get pod status for: ${userId}`);
                showError(`Failed to get pod status for ${userId}`);
                delete users[userId];
                updateUserCards();
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    return false;
}

async function periodicStatusPoll() {
    const userIds = Object.keys(users);
    for (const userId of userIds) {
        try {
            const response = await fetch(`${SERVER_URL}/status?user_id=${userId}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            if (data.status === "assigned" && users[userId]) {
                users[userId].credits = data.credits_remaining || users[userId].credits;
                users[userId].pod_type = data.pod_type || users[userId].pod_type;
            } else if (data.status === "no_pod_assigned") {
                appendDebug(`Pod terminated for: ${userId} (likely credits expired)`);
                delete users[userId];
            }
            updateUserCards();
        } catch (error) {
            appendDebug(`Periodic status poll error for ${userId}: ${error.message}`);
        }
    }
}

async function createUser() {
    const userIdInput = document.getElementById("createUserId").value.trim();
    try {
        const response = await fetch(`${SERVER_URL}/create_user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key: API_KEY,
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
        showError(`Failed to create user: ${error.message}`);
        return null;
    }
}

async function startPod() {
    const userIdInput = document.getElementById("podUserId").value.trim();
    if (!userIdInput) {
        appendDebug("Please enter a User ID or create a user first");
        showError("Please enter a User ID or create a user first");
        return;
    }
    const userId = userIdInput;
    appendDebug(`Starting pod assignment for: ${userId}`);
    users[userId] = { pod_start: null, pending: true, credits: 3600 };
    updateStatus();
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(`${SERVER_URL}/start_pod`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: API_KEY })
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
                showError(`Failed to start pod: ${error.message}`);
                delete users[userId];
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    updateStatus();
    updateUserCards();
}

async function closePod(userId) {
    if (!users[userId]) {
        appendDebug(`No pod to close for: ${userId}`);
        return;
    }
    appendDebug(`Closing pod for: ${userId}`);
    let success = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = await fetch(`${SERVER_URL}/close`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, key: API_KEY })
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
    const userIds = Object.keys(users);
    document.getElementById("status").innerHTML = userIds.length > 0 ?
        `${userIds.length} active user(s)` :
        "No active users";
}

function updateUserCards() {
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
        const remainingCredits = user.credits !== undefined ? user.credits : "Unknown";
        const statusClass = user.pending ? "status-pending" : "status-assigned";
        let timeDisplay = "";
        if (typeof remainingCredits === "number") {
            const hours = Math.floor(remainingCredits / 3600);
            const minutes = Math.floor((remainingCredits % 3600) / 60);
            const seconds = Math.floor(remainingCredits % 60);
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
                <div class="pod-info">
                    <h4>Pod ${user.pending ? "Status" : "Information"}</h4>
                    ${user.pending ? `
                        <p>Waiting for pod assignment...</p>
                        <p><small>The system is assigning a pod from the pool. This usually takes a few seconds.</small></p>
                        <button onclick="closePod('${userId}')">Cancel Assignment</button>
                    ` : `
                        <p><strong>Pod type:</strong> ${user.pod_type || "Not assigned yet"}</p>
                        <p><small>This pod will be automatically released when your credits expire or when you close it.</small></p>
                        <button onclick="closePod('${userId}')">Close Pod</button>
                    `}
                </div>
            </div>
        `;
    });
    userCardsDiv.innerHTML = cardsHtml;
}

// Update user cards every second
setInterval(() => {
    if (Object.keys(users).length > 0) {
        updateUserCards();
        periodicStatusPoll();
    }
}, 1000);

document.addEventListener("DOMContentLoaded", function() {
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
    const userId = document.getElementById("creditUserId").value.trim();
    const credits = parseInt(document.getElementById("creditAmount").value);
    if (!userId) {
        appendDebug("Please enter a valid User ID");
        showError("Please enter a valid User ID");
        return;
    }
    if (isNaN(credits) || credits <= 0) {
        appendDebug("Please enter a valid credit amount");
        showError("Please enter a valid credit amount");
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
                key: API_KEY
            })
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        appendDebug(`Credits assigned: ${data.status}`);
        if (userId in users) {
            users[userId].credits = data.credits;
            updateUserCards();
        }
    } catch (error) {
        appendDebug(`Error assigning credits: ${error.message}`);
        showError(`Failed to assign credits: ${error.message}`);
    }
}
