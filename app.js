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

// Helper function to get Twitch OAuth token
async function getTwitchToken() {
    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            }
        });
        return response.data.access_token;
    } catch (err) {
        console.error('Error getting Twitch token:', err.response.data);
        throw err;
    }
}

// Step 1: Endpoint to start OAuth flow
app.get('/follow_verify', (req, res) => {
    const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/check_follow`);
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=user:read:follows`;
    res.redirect(authUrl);
});

// Step 1.5: OAuth callback and follow check
app.get('/check_follow', async (req, res) => {
    const code = req.query.code;

    if (!code) return res.status(400).send('Missing code in request');

    try {
        // Exchange code for a token
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: `${req.protocol}://${req.get('host')}/check_follow`
            }
        });

        const { access_token, user_id } = tokenResponse.data;

        // Check if the user follows CarlSagan42
        const followsResponse = await axios.get(`https://api.twitch.tv/helix/users/follows`, {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${access_token}`
            },
            params: { to_id: CARLSAGAN42_ID, from_id: user_id }
        });

        const follow = followsResponse.data.data[0];
        if (!follow) return res.status(200).send({ success: false, message: "You do not follow CarlSagan42." });

        const followDate = new Date(follow.followed_at);
        const thirtyDaysLater = new Date(followDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (Date.now() < thirtyDaysLater) {
            return res.status(200).send({
                success: false,
                message: `You must follow CarlSagan42 until ${thirtyDaysLater.toDateString()} to be verified.`
            });
        }

        // Notify Discord
        await axios.post(DISCORD_WEBHOOK, {
            content: `User <@${user_id}> is verified and has been granted access to chat.`
        });

        res.status(200).send({ success: true, message: "Verification successful!" });
    } catch (err) {
        console.error('Error during follow verification:', err.response.data);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
