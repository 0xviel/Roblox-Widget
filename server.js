const http = require('http');
const url = require('url');
const config = require('./config');

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

async function exchangeCode(code) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });

  return await fetchJson('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
}

async function getRobloxUserFromUsername(username) {
  const data = await fetchJson('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
  });

  if (!data.data || data.data.length === 0) {
    throw new Error('Username Roblox tidak ditemukan');
  }

  return data.data[0];
}

async function getRobloxUserDetail(userId) {
  return await fetchJson(`https://users.roblox.com/v1/users/${userId}`);
}

async function getRobloxAvatarImage(userId) {
  const data = await fetchJson(
    `https://thumbnails.roblox.com/v1/users/avatar` +
      `?userIds=${userId}` +
      `&size=720x720` +
      `&format=Png` +
      `&isCircular=false`
  );

  return data.data?.[0]?.imageUrl || '';
}

async function getRobloxFriendsCount(userId) {
  const data = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
  return data.count ?? 0;
}

async function getRobloxFollowersCount(userId) {
  const data = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
  return data.count ?? 0;
}

async function getRobloxFollowingCount(userId) {
  const data = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`);
  return data.count ?? 0;
}

async function getRobloxGroupsCount(userId) {
  try {
    const data = await fetchJson(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    return data.data?.length ?? 0;
  } catch {
    return 0;
  }
}

async function getRobloxFavoriteGamesCount(userId) {
  try {
    let count = 0;
    let cursor = '';
    let page = 0;

    do {
      const query = new URLSearchParams({
        limit: '50',
        sortOrder: 'Desc',
      });

      if (cursor) query.set('cursor', cursor);

      const data = await fetchJson(
        `https://games.roblox.com/v2/users/${userId}/favorite/games?${query.toString()}`
      );

      count += data.data?.length ?? 0;
      cursor = data.nextPageCursor || '';
      page++;

      if (page >= 20) break;
    } while (cursor);

    return count;
  } catch {
    return 0;
  }
}

function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function getYearFromDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return String(date.getFullYear());
}

async function buildDiscordPayloadFromRoblox(username) {
  const basicUser = await getRobloxUserFromUsername(username);
  const robloxUserId = basicUser.id;

  const [
    detail,
    avatarUrl,
    friendsCount,
    followersCount,
    followingCount,
    groupsCount,
    favoriteGamesCount,
  ] = await Promise.all([
    getRobloxUserDetail(robloxUserId),
    getRobloxAvatarImage(robloxUserId),
    getRobloxFriendsCount(robloxUserId),
    getRobloxFollowersCount(robloxUserId),
    getRobloxFollowingCount(robloxUserId),
    getRobloxGroupsCount(robloxUserId),
    getRobloxFavoriteGamesCount(robloxUserId),
  ]);

  return {
    roblox: {
      id: robloxUserId,
      username: detail.name,
      displayName: detail.displayName,
      description: detail.description,
      created: detail.created,
      avatarUrl,
      friendsCount,
      followersCount,
      followingCount,
      groupsCount,
      favoriteGamesCount,
    },

    payload: {
      data: {
        dynamic: [
          {
            type: 3,
            name: 'PROFILE',
            value: {
              url: avatarUrl,
            },
          },
          {
            type: 1,
            name: 'USERNAME',
            value: safeText(detail.name),
          },
          {
            type: 1,
            name: 'NAME',
            value: safeText(detail.displayName),
          },
          {
            type: 1,
            name: 'DESCRIPTION',
            value: safeText(detail.description),
          },
          {
            type: 1,
            name: 'FRIENDS',
            value: String(friendsCount),
          },
          {
            type: 1,
            name: 'FOLLOWERS',
            value: String(followersCount),
          },
          {
            type: 1,
            name: 'FOLLOWING',
            value: String(followingCount),
          },
          {
            type: 1,
            name: 'GROUP',
            value: String(groupsCount),
          },
          {
            type: 1,
            name: 'FAV',
            value: String(favoriteGamesCount),
          },
          {
            type: 1,
            name: 'DATE',
            value: getYearFromDate(detail.created),
          },
        ],
      },
    },
  };
}

async function updateDiscordProfile(discordUserId, payload) {
  const res = await fetch(
    `https://discord.com/api/v9/applications/${config.discordApplicationId}/users/${discordUserId}/identities/0/profile`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${config.botToken}`,
        'User-Agent': 'DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)',
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Discord HTTP ${res.status}: ${text}`);
  }

  return text || 'success';
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Roblox to Discord Widget Updater</title>
</head>
<body>
  <h1>Roblox to Discord Widget Updater</h1>

  <label>
    Roblox Username:
    <input id="robloxUsername" placeholder="Klama910" />
  </label>

  <br/><br/>

  <button onclick="updateProfile()">Update Discord Widget</button>

  <pre id="result"></pre>

  <script>
    async function updateProfile() {
      const robloxUsername = document.getElementById("robloxUsername").value.trim();
      const pre = document.getElementById("result");

      if (!robloxUsername) {
        pre.textContent = "Masukkan username Roblox dulu.";
        return;
      }

      pre.textContent = "Mengambil data Roblox dan update Discord...";

      try {
        const res = await fetch("/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ robloxUsername })
        });

        const data = await res.text();

        try {
          pre.textContent = JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          pre.textContent = data;
        }
      } catch (e) {
        pre.textContent = "Error: " + e.message;
      }
    }
  </script>
</body>
</html>
    `);
    return;
  }

  if (pathname === '/oauth2') {
    const { code } = parsed.query;

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing code parameter' }));
      return;
    }

    try {
      const data = await exchangeCode(code);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }, null, 2));
    }

    return;
  }

  if (pathname === '/update-profile' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const { robloxUsername } = JSON.parse(body);

        if (!robloxUsername) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing robloxUsername' }, null, 2));
          return;
        }

        const { roblox, payload } = await buildDiscordPayloadFromRoblox(robloxUsername);

        const discordResult = await updateDiscordProfile(config.userId, payload);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            {
              status: 'success',
              discordUserId: config.userId,
              roblox,
              payload,
              discordResult,
            },
            null,
            2
          )
        );
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }, null, 2));
      }
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
