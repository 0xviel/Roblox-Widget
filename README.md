# Roblox-Widget
Roblox Board Widget for Discord


# Guide
1. Make app in discord developer and register to sdk-game
2. Open the editor widget in discord developer.
   You can watch this [Youtube](https://youtu.be/Yq0vDExfVC8?si=heGg2buZaQ_I2477)
3. Edit widget with json payload like this
   Just take the "name" data, the value you fill in is up to you.

   For the icon upload itself to the asset check the Asset folder
   ```json
{
  "data": {
    "dynamic": [
      {
        "type": 3,
        "name": "PROFILE",
        "value": {
          "url": "<URL to PROFILE.png>"
        }
      },
      {
        "type": 1,
        "name": "USERNAME",
        "value": "Klama910"
      },
      {
        "type": 1,
        "name": "NAME",
        "value": "Re46"
      },
      {
        "type": 1,
        "name": "DESCRIPTION",
        "value": "test"
      },
      {
        "type": 1,
        "name": "FRIENDS",
        "value": "41"
      },
      {
        "type": 1,
        "name": "FOLLOWERS",
        "value": "1"
      },
      {
        "type": 1,
        "name": "FOLLOWING",
        "value": "0"
      },
      {
        "type": 1,
        "name": "GROUP",
        "value": "11"
      },
      {
        "type": 1,
        "name": "FAV",
        "value": "6"
      },
      {
        "type": 1,
        "name": "DATE",
        "value": "2025"
      }
    ]
  }
}
   ```
4. Save and publish
