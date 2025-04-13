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
    if (debugDiv) {
        const timestamp = new Date().toLocaleTimeString();
        debugDiv.innerHTML = `[${timestamp}] ${message}<br>` + debugDiv.innerHTML;
        // Limit debug messages to prevent browser slowdown
        if (debugDiv.innerHTML.split('<br>').length > 100) {
            const lines = debugDiv.innerHTML.split('<br>');
            debugDiv.innerHTML = lines.slice(0, 100).join('<br>');
        }
    } else {
        console.log("Debug: " + message);
    }
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
                     pending: false,
                     credits: data.credits_remaining || 3600 // Use server-provided credits or default
                 };
                 appendDebug(`Remaining credits: ${data.credits_remaining || 3600}s`);
                 updateUserCards();
                 return true;
             } else if (data.status === "no_pods_available") {
                 appendDebug(`No pods available for: ${userId}`);
                 delete racers[userId];
                 return false;
             }
             // Still pending, update credits if provided
             if (data.credits_remaining !== undefined && racers[userId]) {
                 racers[userId].credits = data.credits_remaining;
                 updateUserCards();
             }
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
     racers[userId] = { race_start: null, pending: true, credits: 3600 }; // Default credits
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
                 // Update credits if provided by the server
                 if (data.credits && racers[userId]) {
                     racers[userId].credits = data.credits;
                     appendDebug(`Credits assigned: ${data.credits}s`);
                 }
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
     updateUserCards();
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
         updateUserCards();
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
     document.getElementById("status").innerHTML = userIds.length > 0 ?
         `${userIds.length} active race(s)` :
         "No active races";
 }
 
 function updateUserCards() {
     /**
      * Update the user cards with detailed information.
      */
     const userCardsDiv = document.getElementById("userCards");
     const userIds = Object.keys(racers);
     
     if (userIds.length === 0) {
         userCardsDiv.innerHTML = "<p>No active races</p>";
         return;
     }
     
     let cardsHtml = "";
     
     userIds.forEach(userId => {
         const racer = racers[userId];
         const elapsedTime = racer.race_start ? Math.floor((Date.now() - racer.race_start) / 1000) : 0;
         // For display purposes, we'll show the client-side calculation
         // But the server is the source of truth for credits
         const remainingCredits = racer.credits ? racer.credits - elapsedTime : "Unknown";
         
         cardsHtml += `
             <div class="user-card">
                 <h3>User: ${userId}</h3>
                 <p>Status: ${racer.pending ? "Pending" : "Assigned"}</p>
                 <p>Race started: ${racer.race_start ? new Date(racer.race_start).toLocaleTimeString() : "Pending"}</p>
                 <p>Elapsed time: ${elapsedTime} seconds</p>
                 <p>Remaining credits: ${remainingCredits} seconds</p>
                 
                 ${!racer.pending ? `
                 <div class="pod-info">
                     <h4>Pod Information</h4>
                     <p>Winner pod: ${racer.winner || "Not assigned yet"}</p>
                     <p>Pods raced: ${racer.pods_raced && racer.pods_raced.length ? racer.pods_raced.join(", ") : "None"}</p>
                 </div>
                 ` : ''}
             </div>
         `;
     });
     
     userCardsDiv.innerHTML = cardsHtml;
 }
 
 function updateButtonState() {
     /**
      * Enable/disable the Close button based on active races.
      */
     document.getElementById("removeOnButton").disabled = Object.keys(racers).length === 0;
 }
 
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
         
         // Update local state if this user is in our racers list
         if (userId in racers) {
             racers[userId].credits = credits;
             updateUserCards();
         }
     } catch (error) {
         appendDebug(`Error assigning credits: ${error.message}`);
     }
 }
 
 // Update user cards every second to show elapsed time and remaining credits
 setInterval(() => {
     if (Object.keys(racers).length > 0) {
         updateUserCards();
     }
 }, 1000);
 
 document.addEventListener("DOMContentLoaded", function() {
     /**
      * Initialize event listeners for buttons.
      */
     document.getElementById("startButton").addEventListener("click", sendStartRequest);
     document.getElementById("removeOnButton").addEventListener("click", sendCloseRequest);
     document.getElementById("assignCreditsButton").addEventListener("click", assignCredits);
     updateButtonState();
     updateUserCards();
 });
