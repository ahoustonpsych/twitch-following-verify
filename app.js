const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Environment variables
const PORT = process.env.PORT || 8080;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const CARLSAGAN42_ID = '20702886'; // Replace with CarlSagan42's Twitch User ID

// Helper function to check if a user follows CarlSagan42
async function checkFollow(accessToken, userId) {
    try {
        const response = await axios.get('https://api.twitch.tv/helix/channels/followed', {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`
            },
            params: { broadcaster_id: CARLSAGAN42_ID, user_id: userId }
        });

        const followData = response.data.data[0];
        return followData || null;
    } catch (err) {
        console.error('Error checking follow:', err.response?.data || err.message);
        throw err;
    }
}

// Step 1: Endpoint to start OAuth flow
app.get('/follow_verify', (req, res) => {
    const redirectUri = encodeURIComponent(`https://${req.get('host')}/auth_redirect`);
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=user:read:follows`;
    res.redirect(authUrl);
});

// Step 2: Redirect URI for Twitch OAuth
// app.get('/auth_redirect', async (req, res) => {
//     const code = req.query.code;
//
//     if (!code) {
//         return res.status(400).send('Missing authorization code from Twitch.');
//     }
//
//     try {
//         // Exchange code for access token
//         const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
//             params: {
//                 client_id: TWITCH_CLIENT_ID,
//                 client_secret: TWITCH_CLIENT_SECRET,
//                 code: code,
//                 grant_type: 'authorization_code',
//                 redirect_uri: `https://${req.get('host')}/auth_redirect`
//             }
//         });
//
//         const { access_token, user_id } = tokenResponse.data;
//
//         // Check if the user follows CarlSagan42
//         const followData = await checkFollow(access_token, user_id);
//
//         if (!followData) {
//             return res.status(200).send(`<h1>Verification Failed</h1><p>You do not follow CarlSagan42 on Twitch.</p>`);
//         }
//
//         const followDate = new Date(followData.followed_at);
//         const thirtyDaysLater = new Date(followDate.getTime() + 30 * 24 * 60 * 60 * 1000);
//
//         if (Date.now() < thirtyDaysLater) {
//             return res.status(200).send(`
//                 <h1>Verification Failed</h1>
//                 <p>You started following CarlSagan42 on ${followDate.toDateString()}.</p>
//                 <p>You must follow for at least 30 days (until ${thirtyDaysLater.toDateString()}) to be verified.</p>
//             `);
//         }
//
//         // Notify Discord
//         await axios.post(DISCORD_WEBHOOK, {
//             content: `User <@${user_id}> is verified and has been granted access to chat.`
//         });
//
//         res.status(200).send(`<h1>Verification Successful</h1><p>Welcome! You have been verified successfully and can now chat on Discord.</p>`);
//     } catch (err) {
//         console.error('Error during auth redirect:', err.response?.data || err.message);
//         res.status(500).send('<h1>Error</h1><p>Something went wrong during the verification process.</p>');
//     }
// });

app.get('/auth_redirect', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('Missing authorization code from Twitch.');
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: `https://${req.get('host')}/auth_redirect`
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // Fetch user details to get user_id
        const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const userId = userResponse.data.data[0].id;

        // Check if the user follows CarlSagan42
        const followData = await checkFollow(accessToken, userId);

        if (!followData) {
            return res.status(200).send(`<h1>Verification Failed</h1><p>You do not follow CarlSagan42 on Twitch.</p>`);
        }

        const followDate = new Date(followData.followed_at);
        const thirtyDaysLater = new Date(followDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (Date.now() < thirtyDaysLater) {
            return res.status(200).send(`
                <h1>Verification Failed</h1>
                <p>You started following CarlSagan42 on ${followDate.toDateString()}.</p>
                <p>You must follow for at least 30 days (until ${thirtyDaysLater.toDateString()}) to be verified.</p>
            `);
        }

        if (Date.now() >= thirtyDaysLater) {
            const daysFollowed = Math.floor((Date.now() - followDate.getTime()) / (1000 * 60 * 60 * 24));

            await axios.post(DISCORD_WEBHOOK, {
                content: `User <@${userId}> is verified and has been granted access to chat.`
            });

            return res.status(200).send(`
                <h1>Verification Successful</h1>
                <p>Welcome! You have been verified successfully and can now chat on Discord.</p>
                <p>You have been following CarlSagan42 for ${daysFollowed} days.</p>
            `);
        }
    } catch (err) {
        console.error('Error during auth redirect:', err.response?.data || err.message);
        res.status(500).send('<h1>Error</h1><p>Something went wrong during the verification process.</p>');
    }
});

app.get('/discord_redirect', (req, res) => {
    // Extract information from the query parameters
    const { code, state, error, error_description } = req.query;

    if (error) {
        // If there's an error in the redirect, display it
        return res.status(400).send(`
            <h1>Error</h1>
            <p>${error}: ${error_description}</p>
        `);
    }

    if (code) {
        // Display the code and state (if available)
        return res.status(200).send(`
            <h1>Discord OAuth Redirect</h1>
            <p><strong>Authorization Code:</strong> ${code}</p>
            ${state ? `<p><strong>State:</strong> ${state}</p>` : ''}
            <p>You can now use this code to exchange for a token in your backend logic.</p>
        `);
    }

    // If no expected parameters are present
    return res.status(400).send(`
        <h1>Invalid Request</h1>
        <p>No relevant data was received from Discord.</p>
    `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
