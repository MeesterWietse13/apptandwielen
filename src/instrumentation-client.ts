// Sommige browserhulpmiddelen wijzigen de verborgen Next.js-metadatacontainer
// voordat React start. Herstel alleen die bekende wijziging om een onterechte
// hydration-melding te vermijden.
const webSprinterRoot = document.getElementById("webSprinterRoot");

if (webSprinterRoot?.parentElement?.tagName === "HEAD") {
  webSprinterRoot.removeAttribute("id");
  webSprinterRoot.hidden = true;
}
