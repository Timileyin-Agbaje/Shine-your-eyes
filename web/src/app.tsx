import { APP_NAME } from "@sye/core";
import { strings } from "./strings.ts";

export function App() {
  return (
    <main class="screen">
      <img class="logo" src="/icon.svg" alt="" width={72} height={72} />
      <h1>{APP_NAME}</h1>
      <p class="lead">{strings.tagline}</p>
      <p class="muted">{strings.comingSoon}</p>
    </main>
  );
}
