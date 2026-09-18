# Frallan

En gullig uppgiftsapp för de yngsta, med en kiwifågel eller en räv som kompis.

Appen är en webbapp (PWA). Öppna den i webbläsaren och lägg till den på
hemskärmen, så får den egen ikon och startar i helskärm.

* Väldigt korta texter, max tre ord, utan bisatser
* Högtalarknapp som läser upp varje uppgift på svenska
* Stora tryckytor och stor text
* Maten följer djuret: kiwifågeln äter larver, räven äter möss
* Nivåer, prylar och en unge att se fram emot

## Köra lokalt

```
python3 -m http.server 8000
```

Öppna sedan http://localhost:8000

## Servern

Appen fungerar helt på egen hand, men skickar också upp dagens läge till en
liten Cloudflare Worker i `cloudflare-worker/`. Det är den som gör att
föräldrapanelen kan visa Olles dag och lägga till engångsuppgifter.

Driftsättning, en gång:

```
cd cloudflare-worker
npm install
npx wrangler kv namespace create PUSH_KV     # klistra in id i wrangler.toml
npx wrangler secret put ADMIN_TOKEN          # samma nyckel som de andra apparna
npx wrangler deploy
```

Går workern inte att nå händer ingenting, appen fungerar precis som förut.
Notiser finns inte än, men workern tar redan emot en prenumeration den dagen
appen får en klockknapp.
