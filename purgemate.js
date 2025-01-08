(function () {
    let isRunning = false;
    let uiVisible = false;

    function getCurrentChannelId() {
        const match = window.location.href.match(/channels\/(\d+|@me)\/(\d+)/);
        return match ? match[2] : '';
    }

    function getCurrentUserId() {
        try {
            const iframe = document.createElement('iframe');
            document.body.appendChild(iframe);
            const userId = iframe.contentWindow.localStorage.user_id_cache;
            document.body.removeChild(iframe);
            return JSON.parse(userId);
        } catch {
            return '';
        }
    }

    function getAuthToken() {
        try {
            const token = (webpackChunkdiscord_app.push([[''], {}, e => {
                m = [];
                for (let c in e.c) m.push(e.c[c]);
            }]), m).find(m => m?.exports?.default?.getToken !== void 0).exports.default.getToken();

            if (!token) {
                throw new Error("Authorization token not found.");
            }

            return token;
        } catch (err) {
            console.error("Unable to retrieve the authorization token.", err);
            return '';
        }
    }

    const detectedChannelId = getCurrentChannelId();
    const detectedUserId = getCurrentUserId();
    const detectedAuthToken = getAuthToken();

    const uiHtml = `
        <div id="messageDeletionUI" style="display:none;position:fixed;top:10px;left:10px;z-index:1000;padding:20px;background:#2c2f33;color:#fff;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.3);width:350px;font-family:sans-serif;">
            <h3 style="margin:0 0 15px;font-size:20px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">Discord Message Deletion</h3>
            <div style="margin-bottom:15px;">
                <label for="tokenInput" style="display:block;margin-bottom:8px;font-size:14px;">Authorization Token:</label>
                <input id="tokenInput" type="text" style="width:95%;padding:10px;border-radius:5px;border:1px solid #444;background:#23272a;color:#fff;" value="${detectedAuthToken}" placeholder="Enter your token">
            </div>
            <div style="margin-bottom:15px;">
                <label for="channelInput" style="display:block;margin-bottom:8px;font-size:14px;">Channel ID:</label>
                <input id="channelInput" type="text" style="width:95%;padding:10px;border-radius:5px;border:1px solid #444;background:#23272a;color:#fff;" value="${detectedChannelId}" placeholder="Enter the channel ID">
            </div>
            <div style="margin-bottom:15px;">
                <label for="userInput" style="display:block;margin-bottom:8px;font-size:14px;">Your User ID:</label>
                <input id="userInput" type="text" style="width:95%;padding:10px;border-radius:5px;border:1px solid #444;background:#23272a;color:#fff;" value="${detectedUserId}" placeholder="Enter your user ID">
            </div>
            <div style="margin-bottom:20px;">
                <label for="delayInput" style="display:block;margin-bottom:8px;font-size:14px;">Delay Between Deletes (ms):</label>
                <input id="delayInput" type="number" value="1000" style="width:95%;padding:10px;border-radius:5px;border:1px solid #444;background:#23272a;color:#fff;" placeholder="Delay in ms">
            </div>
            <button id="startDeletionButton" style="width:100%;padding:12px;background:#43b581;color:#fff;border:none;border-radius:5px;font-size:14px;font-weight:bold;cursor:pointer;transition:background 0.3s;margin-bottom:10px;">Start Deleting</button>
            <button id="stopDeletionButton" style="width:100%;padding:12px;background:#f04747;color:#fff;border:none;border-radius:5px;font-size:14px;font-weight:bold;cursor:pointer;transition:background 0.3s;margin-bottom:10px;" disabled>Stop Deleting</button>
            <button id="closeUI" style="width:100%;padding:12px;background:#7289da;color:#fff;border:none;border-radius:5px;font-size:14px;font-weight:bold;cursor:pointer;transition:background 0.3s;">Close</button>
        </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = uiHtml;
    document.body.appendChild(container);

    const createCustomButton = () => {
        const toolbar = document.querySelector('[class*="toolbar"]');
        if (toolbar) {
            const newButton = document.createElement('div');
            newButton.innerHTML = `
                <button id="customToggleUI" style="background:#5865F2;color:white;border:none;padding:8px 12px;border-radius:5px;font-size:14px;font-weight:bold;cursor:pointer;">
                    PurgeMate
                </button>
            `;
            toolbar.appendChild(newButton);

            document.getElementById('customToggleUI').addEventListener('click', () => {
                const ui = document.getElementById('messageDeletionUI');
                uiVisible = !uiVisible;
                ui.style.display = uiVisible ? 'block' : 'none';
            });
        } else {
            console.error("Toolbar not found. Cannot add custom button.");
        }
    };

    async function deleteMessages() {
        const authorizationToken = document.getElementById('tokenInput').value.trim();
        const channelId = document.getElementById('channelInput').value.trim();
        const userId = document.getElementById('userInput').value.trim();
        const delayBetweenDeletes = parseInt(document.getElementById('delayInput').value.trim()) || 1000;

        if (!authorizationToken || !channelId || !userId) {
            alert("Please provide the Authorization Token, Channel ID, and User ID.");
            return;
        }

        isRunning = true;
        document.getElementById('startDeletionButton').disabled = true;
        document.getElementById('stopDeletionButton').disabled = false;

        let beforeMessageId = null;
        let totalDeleted = 0;

        console.log("Starting message deletion...");

        async function fetchMessages(before = null) {
            const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=50${before ? `&before=${before}` : ''}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    "authorization": authorizationToken,
                }
            });

            if (!response.ok) {
                console.error("Error fetching messages:", response.statusText, await response.text());
                return [];
            }

            const messages = await response.json();
            console.log("Fetched messages:", messages);
            return messages;
        }

        async function deleteMessage(messageId) {
            const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    "authorization": authorizationToken,
                }
            });

            if (!response.ok) {
                console.error(`Failed to delete message ${messageId}:`, response.statusText, await response.text());
                return false;
            }

            console.log(`Deleted message ${messageId}`);
            return true;
        }

        while (isRunning) {
            const messages = await fetchMessages(beforeMessageId);
            if (messages.length === 0) {
                console.log("No more messages to delete.");
                break;
            }

            for (const message of messages) {
                if (!isRunning) break;
                if (message.author.id !== userId) {
                    console.log(`Skipping message ${message.id} (not authored by you).`);
                    continue;
                }

                console.log(`Deleting message: ${message.id}, Content: "${message.content}"`);
                const success = await deleteMessage(message.id);
                if (success) {
                    totalDeleted++;
                }

                await new Promise(resolve => setTimeout(resolve, delayBetweenDeletes));
            }

            beforeMessageId = messages[messages.length - 1]?.id;
        }

        isRunning = false;
        console.log(`Finished! Deleted a total of ${totalDeleted} messages.`);
        alert(`Finished! Deleted a total of ${totalDeleted} messages.`);
        document.getElementById('startDeletionButton').disabled = false;
        document.getElementById('stopDeletionButton').disabled = true;
    }

    document.getElementById('startDeletionButton').addEventListener('click', () => {
        if (!isRunning) deleteMessages();
    });

    document.getElementById('stopDeletionButton').addEventListener('click', () => {
        isRunning = false;
        document.getElementById('startDeletionButton').disabled = false;
        document.getElementById('stopDeletionButton').disabled = true;
        console.log("Stopped message deletion.");
    });

    document.getElementById('closeUI').addEventListener('click', () => {
        isRunning = false;
        const ui = document.getElementById('messageDeletionUI');
        ui.style.display = 'none';
        uiVisible = false;
        console.log("Closed the UI and stopped the script.");
    });
	
	 createCustomButton();
})();
