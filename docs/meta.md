# Notes from the Meta docs
Reminders to get access to the Graph API

## Auth

https://developers.facebook.com/docs/instagram-platform/reference/access_token#curl-example

```curl
curl -X GET "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&&client_secret=eb87G...&access_token=IGQVJ..
{
  "access_token": "lZAfb2dhVW...",
  "token_type": "bearer",
  "expires_in": 5184000
}
```

🔹 Token Types in the Instagram Graph API

Short-Lived User Access Token

Valid for 1 hour.

You get it through OAuth or via the Graph API Explorer.

Long-Lived User Access Token

Valid for 60 days.

Obtained by exchanging the short-lived token.

Can be refreshed to get another 60-day token.

Page Access Token

Generated using the long-lived user token.

Lets you access the Page (and thus the linked IG Business account).

Has the same expiry as the long-lived user token.

## Post insights

https://developers.facebook.com/docs/instagram-platform/reference/instagram-media

Response fields that are useful
