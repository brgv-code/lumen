/** What the server said about signups when it sent this page (a meta tag on / and /login). */
export const signupsPausedOnLoad = () => document.querySelector('meta[name="lumen-signups"]')?.getAttribute("content") === "paused";
